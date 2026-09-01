-- ============================================================
--  Ventura — real, append-only security audit trail
--  Run this in the Supabase SQL Editor (Project > SQL Editor > New Query)
-- ============================================================
--
-- Why this file exists: the app's UI (homepage, /audit-logs) claims an
-- "immutable" / "append-only, cannot be modified or deleted" audit log, but
-- until this migration the only implementations were (a) a per-user
-- `user_metadata._activity_log` array capped at 100 entries and editable by
-- anyone holding the service-role key, and (b) a client-side localStorage
-- array capped at 500 entries that any browser devtools session can rewrite
-- with one `localStorage.setItem()` call. Neither is immutable. This table
-- is the real one — see src/lib/auditServer.ts for the write path.
--
-- Tenancy note: this app's actual multi-tenant boundary is
-- `user_metadata._company.admin_id` (see api/invite/join.ts), NOT the
-- `workspaces`/`profiles.workspace_id` schema defined in seed.sql — nothing
-- in the running app reads those tables. `tenant_id` below is the owning
-- admin's auth.users.id, consistent with how the rest of the app already
-- scopes team membership, invites, and connections.

create extension if not exists "pgcrypto";

create table if not exists security_audit_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  actor_id    uuid,
  actor_email text,
  event       text not null,
  resource    text,
  detail      text,
  severity    text not null default 'info' check (severity in ('info','warning','critical')),
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index if not exists security_audit_log_tenant_idx
  on security_audit_log (tenant_id, created_at desc);

alter table security_audit_log enable row level security;

-- Deliberately zero policies. Postgres RLS defaults to deny-all for every
-- role once RLS is enabled, including `authenticated` — so the anon and
-- publishable keys used by the browser have no access whatsoever, not even
-- SELECT. All reads and writes go through Next.js API routes
-- (src/pages/api/audit/log.ts, src/pages/api/audit/list.ts) using the
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS server-side by design.
--
-- That is what makes this table genuinely append-only in practice: no
-- UPDATE or DELETE endpoint exists anywhere in the app, so the only
-- operation any client — including a fully compromised browser session —
-- can ever trigger against this table is an INSERT of a new row via
-- writeAuditEvent(). If a future change needs direct browser access to this
-- table, add an explicit SELECT-only policy scoped to tenant_id; never add
-- UPDATE or DELETE policies for the authenticated role.

revoke update, delete on security_audit_log from authenticated, anon;
