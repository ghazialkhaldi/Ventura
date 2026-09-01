-- ============================================================
--  Ventura — Supabase schema (real schema, no fake data)
--  Run this in the Supabase SQL Editor (Project > SQL Editor > New Query)
--
--  This file creates tables, RLS policies, and the sign-up trigger only.
--  It inserts zero rows of data. If you want a populated demo workspace to
--  look at, run demo-data.sql separately AFTER this — it's clearly marked
--  and easy to delete later (see the cleanup query at the top of that file).
-- ============================================================

-- ── 0. Extensions ────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── 1. Tables ────────────────────────────────────────────────────────────────

-- Workspace (one per company)
create table if not exists workspaces (
  id          uuid    default gen_random_uuid() primary key,
  name        text    not null,
  industry    text,
  plan        text    default 'Enterprise',
  fiscal_year text,
  employees   int,
  annual_budget   bigint,
  ytd_spend       bigint,
  ytd_budget      bigint,
  savings_identified bigint,
  timezone    text    default 'America/Los_Angeles',
  created_at  timestamptz default now()
);

-- User profiles (extends auth.users)
create table if not exists profiles (
  id           uuid references auth.users on delete cascade primary key,
  email        text not null,
  full_name    text,
  role         text default 'Admin',
  workspace_id uuid references workspaces,
  created_at   timestamptz default now()
);

-- Workspace members (the people shown in Settings > Team)
create table if not exists workspace_users (
  id           text primary key,
  workspace_id uuid references workspaces on delete cascade,
  name         text not null,
  email        text not null,
  role         text not null,
  status       text default 'Active',
  last_login   text,
  mfa          boolean default false,
  created_at   timestamptz default now()
);

-- Anomalies
create table if not exists anomalies (
  id                 text primary key,
  workspace_id       uuid references workspaces on delete cascade,
  title              text not null,
  category           text,
  vendor             text,
  amount             numeric(14,2) default 0,
  severity           text not null check (severity in ('CRITICAL','HIGH','MEDIUM','LOW')),
  status             text default 'Open',
  confidence         int  default 0,
  detected_at        date,
  description        text,
  ai_summary         text,
  risk_level         text,
  reasoning          text,
  evidence_refs      jsonb default '[]',
  suggested_actions  jsonb default '[]',
  audit_trail        jsonb default '[]',
  created_at         timestamptz default now()
);

-- Workflows
create table if not exists workflows (
  id               text primary key,
  workspace_id     uuid references workspaces on delete cascade,
  name             text not null,
  status           text not null,
  avg_days         numeric(5,1),
  sla_days         int,
  bottleneck_stage text,
  bottleneck_days  numeric(5,1),
  in_progress      int default 0,
  overdue          int default 0,
  description      text,
  steps            jsonb default '[]',
  created_at       timestamptz default now()
);

-- Integrations
create table if not exists integrations (
  id           text primary key,
  workspace_id uuid references workspaces on delete cascade,
  name         text not null,
  type         text,
  status       text default 'Disconnected',
  last_sync    text,
  records_sync int default 0,
  description  text,
  auth_method  text,
  created_at   timestamptz default now()
);

-- Monthly spend
create table if not exists monthly_spend (
  id           uuid default gen_random_uuid() primary key,
  workspace_id uuid references workspaces on delete cascade,
  month        text not null,
  spend        bigint not null,
  budget       bigint,
  created_at   timestamptz default now()
);

-- Category spend
create table if not exists category_spend (
  id           uuid default gen_random_uuid() primary key,
  workspace_id uuid references workspaces on delete cascade,
  name         text not null,
  value        bigint not null,
  color        text,
  pct          numeric(5,1),
  created_at   timestamptz default now()
);

-- Savings opportunities
create table if not exists savings_opportunities (
  id              text primary key,
  workspace_id    uuid references workspaces on delete cascade,
  title           text not null,
  category        text,
  annual_savings  int,
  effort          text,
  status          text default 'Identified',
  created_at      timestamptz default now()
);

-- Pending approvals
create table if not exists pending_approvals (
  id           text primary key,
  workspace_id uuid references workspaces on delete cascade,
  title        text not null,
  amount       numeric(14,2),
  waiting      text,
  days_waiting int,
  anomaly_id   text references anomalies(id),
  created_at   timestamptz default now()
);

-- AI governance events
create table if not exists ai_events (
  id            text primary key,
  workspace_id  uuid references workspaces on delete cascade,
  ts            text not null,
  task_type     text not null,
  model         text,
  confidence    int,
  risk_tier     text,
  status        text,
  cost_estimate numeric(8,4),
  anomaly_id    text references anomalies(id),
  actor_email   text,
  created_at    timestamptz default now()
);

-- Audit events
create table if not exists audit_events (
  id           text primary key,
  workspace_id uuid references workspaces on delete cascade,
  ts           text not null,
  actor        text not null,
  actor_email  text,
  event_type   text,
  resource     text,
  detail       text,
  ip_address   text,
  severity     text default 'info',
  created_at   timestamptz default now()
);

-- ── 2. Row-Level Security ────────────────────────────────────────────────────

alter table workspaces          enable row level security;
alter table profiles            enable row level security;
alter table workspace_users     enable row level security;
alter table anomalies           enable row level security;
alter table workflows           enable row level security;
alter table integrations        enable row level security;
alter table monthly_spend       enable row level security;
alter table category_spend      enable row level security;
alter table savings_opportunities enable row level security;
alter table pending_approvals   enable row level security;
alter table ai_events           enable row level security;
alter table audit_events        enable row level security;

-- ── Row-Level Security: workspace-scoped isolation ───────────────────────────
-- Users can only access data belonging to their own workspace.
-- The profiles table maps auth.uid() → workspace_id.

-- Helper: resolve the caller's workspace_id from their profile
create or replace function auth_workspace_id()
returns uuid language sql stable security definer as $$
  select workspace_id from profiles where id = auth.uid() limit 1;
$$;

-- Every create policy below is preceded by a matching `drop policy if
-- exists` so this whole file can be re-run against a project it's already
-- been run against (unlike `create table if not exists` and `on conflict do
-- nothing`, plain `create policy` errors with "already exists" on a second
-- run — that's what caused the 42710 error when re-running this file).

-- Workspaces: user can only see their own workspace
drop policy if exists "workspace_scoped_select" on workspaces;
create policy "workspace_scoped_select" on workspaces
  for select to authenticated
  using (id = auth_workspace_id());

-- Workspace users: scoped to workspace
drop policy if exists "workspace_scoped_select" on workspace_users;
create policy "workspace_scoped_select" on workspace_users
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Anomalies: scoped to workspace
drop policy if exists "workspace_scoped_select" on anomalies;
create policy "workspace_scoped_select" on anomalies
  for select to authenticated
  using (workspace_id = auth_workspace_id());

drop policy if exists "workspace_scoped_insert" on anomalies;
create policy "workspace_scoped_insert" on anomalies
  for insert to authenticated
  with check (workspace_id = auth_workspace_id());

drop policy if exists "workspace_scoped_update" on anomalies;
create policy "workspace_scoped_update" on anomalies
  for update to authenticated
  using (workspace_id = auth_workspace_id());

-- Workflows: scoped to workspace
drop policy if exists "workspace_scoped_select" on workflows;
create policy "workspace_scoped_select" on workflows
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Integrations: scoped to workspace
drop policy if exists "workspace_scoped_select" on integrations;
create policy "workspace_scoped_select" on integrations
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Monthly spend: scoped to workspace
drop policy if exists "workspace_scoped_select" on monthly_spend;
create policy "workspace_scoped_select" on monthly_spend
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Category spend: scoped to workspace
drop policy if exists "workspace_scoped_select" on category_spend;
create policy "workspace_scoped_select" on category_spend
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Savings opportunities: scoped to workspace
drop policy if exists "workspace_scoped_select" on savings_opportunities;
create policy "workspace_scoped_select" on savings_opportunities
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Pending approvals: scoped to workspace
drop policy if exists "workspace_scoped_select" on pending_approvals;
create policy "workspace_scoped_select" on pending_approvals
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- AI events: scoped to workspace
drop policy if exists "workspace_scoped_select" on ai_events;
create policy "workspace_scoped_select" on ai_events
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Audit events: scoped to workspace (admins only for full log)
drop policy if exists "workspace_scoped_select" on audit_events;
create policy "workspace_scoped_select" on audit_events
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Own profile: users can only read and update their own row
drop policy if exists "users read own profile" on profiles;
create policy "users read own profile"   on profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "users update own profile" on profiles;
create policy "users update own profile" on profiles for update to authenticated using (auth.uid() = id);

-- ── 3. Auto-create profile on sign-up ────────────────────────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  ws_id uuid;
begin
  -- Every new sign-up gets its OWN workspace. The previous version of this
  -- trigger did `select id into ws_id from workspaces order by created_at
  -- limit 1` — i.e. every single new company that ever signed up got
  -- attached to whichever workspace happened to be created first. Past the
  -- very first customer, that merges every subsequent company's anomalies,
  -- vendors, and audit history into one shared tenant, visible to anyone
  -- the workspace-scoped RLS policies above trust as a member. That RLS
  -- (workspace_id = auth_workspace_id()) only isolates tenants correctly if
  -- each tenant actually has a distinct workspace_id — this trigger is what
  -- was supposed to guarantee that, and didn't.
  insert into workspaces (name)
  values (coalesce(nullif(split_part(new.email, '@', 2), ''), 'Workspace — ' || new.id))
  returning id into ws_id;

  insert into profiles (id, email, full_name, workspace_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    ws_id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── 4. Test user — REMOVED ───────────────────────────────────────────────────
-- This section used to create a live login (a real personal Gmail address)
-- with the password "123" hashed and inserted directly into auth.users,
-- bypassing Supabase Auth's normal password-strength enforcement entirely.
-- Committing a working credential — for a real email address — to a SQL
-- file that a README instructs you to "run in the Supabase SQL Editor" is a
-- standing backdoor risk: it takes exactly one accidental run against a
-- shared or production project to create a trivially guessable login. It
-- was removed rather than fixed in place. If you need a seeded login for
-- local development, create one manually against your own local/dev
-- Supabase project (Authentication → Users → Add user) with a generated
-- password you don't reuse anywhere else, and never commit it here.
