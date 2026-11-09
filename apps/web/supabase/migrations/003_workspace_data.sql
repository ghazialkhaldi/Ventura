-- Workspace data: integrations, uploaded registers, findings and the review
-- record, stored per workspace (tenant) instead of in one browser.
--
-- Every table is reached only through the app's API routes, which check the
-- signed-in user's workspace and use the service-role key. Row level security
-- is enabled with no policies, so the browser's anon and authenticated keys
-- can read or write none of it directly.
--
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.

create extension if not exists pgcrypto;

-- ── Integrations ────────────────────────────────────────────────────────────
-- One row per connected system per workspace. Tokens are AES-256-GCM
-- ciphertext (TOKEN_ENCRYPTION_KEY); the database never holds them in clear.
create table if not exists integration_connections (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             text not null,
  provider              text not null,                 -- 'plaid' | 'quickbooks' | 'xero' | 'gusto'
  status                text not null default 'connected', -- 'connected' | 'error' | 'revoked'
  external_account_id   text,                          -- QuickBooks realmId, Xero tenantId, Plaid item_id, Gusto company uuid
  external_account_name text,
  access_token_enc      text,
  access_token_iv       text,
  access_token_tag      text,
  refresh_token_enc     text,
  refresh_token_iv      text,
  refresh_token_tag     text,
  expires_at            timestamptz,
  sync_cursor           text,                          -- Plaid transactions/sync cursor
  last_synced_at        timestamptz,
  last_error            text,
  connected_by          uuid,
  connected_by_email    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, provider, external_account_id)
);
create index if not exists integration_connections_tenant on integration_connections (tenant_id);
alter table integration_connections enable row level security;

-- ── Registers ───────────────────────────────────────────────────────────────
-- One row per upload or sync: what came in, from where, and its summary.
create table if not exists datasets (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,
  source_key      text not null,                       -- one per upload or connection; a re-sync replaces its rows
  source          text not null,                       -- 'upload' | 'plaid' | 'quickbooks' | 'xero' | 'gusto'
  name            text not null,                       -- file name or connection name
  row_count       integer not null default 0,
  summary         jsonb not null default '{}'::jsonb,  -- totals, top vendors, categories, months, date range
  column_mapping  jsonb,
  created_by      uuid,
  created_by_email text,
  created_at      timestamptz not null default now()
);
create unique index if not exists datasets_tenant_source on datasets (tenant_id, source_key);
create index if not exists datasets_tenant on datasets (tenant_id, created_at desc);
alter table datasets enable row level security;

create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  dataset_id  uuid not null references datasets (id) on delete cascade,
  row_ref     text not null,                           -- the id findings cite as evidence
  row_index   integer,
  date        date,
  vendor      text not null default '',
  amount      numeric(14, 2) not null,
  direction   text not null default 'debit',           -- 'debit' spend | 'credit' refund, rebate, reversal
  description text,
  category    text,
  account     text,
  period      text,
  unique (dataset_id, row_ref)
);
create index if not exists transactions_tenant_date on transactions (tenant_id, date);
create index if not exists transactions_tenant_vendor on transactions (tenant_id, vendor);
alter table transactions enable row level security;

-- ── Findings and the review record ──────────────────────────────────────────
create table if not exists findings (
  tenant_id     text not null,
  id            text not null,                         -- 'ANO-…', stable per workspace
  dataset_id    uuid references datasets (id) on delete set null,
  type          text not null,
  severity      text not null,
  confidence    integer not null,
  status        text not null default 'Open',          -- 'Open' | 'Under Review' | 'Resolved' | 'Dismissed'
  title         text not null,
  vendor        text,
  amount        numeric(14, 2),
  category      text,
  description   text,
  reasoning     text,
  row_refs      text[] not null default '{}',
  also_matched  jsonb,
  detected_at   timestamptz not null default now(),
  decided_by    uuid,
  decided_by_email text,
  decided_at    timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index if not exists findings_tenant_status on findings (tenant_id, status);
alter table findings enable row level security;

-- Append-only: who changed what about a finding, and when. Never updated or
-- deleted by the app; this is the record an auditor reads.
create table if not exists finding_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  finding_id  text not null,
  actor_id    uuid,
  actor_email text,
  action      text not null,                           -- 'status_changed' | 'note_added' | 'raised'
  from_status text,
  to_status   text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists finding_events_finding on finding_events (tenant_id, finding_id, created_at);
alter table finding_events enable row level security;

create or replace function finding_events_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'finding_events is append-only';
end $$;
drop trigger if exists finding_events_no_update on finding_events;
create trigger finding_events_no_update before update or delete on finding_events
  for each row execute function finding_events_append_only();

-- ── Workspace settings ──────────────────────────────────────────────────────
create table if not exists workspace_settings (
  tenant_id         text primary key,
  approval_limit    numeric(14, 2),                    -- the dual-approval limit; null uses the default
  detection_config  jsonb not null default '{}'::jsonb,
  updated_by        uuid,
  updated_at        timestamptz not null default now()
);
alter table workspace_settings enable row level security;
