-- ============================================================
--  Ventura — Supabase schema + seed data
--  Run this in the Supabase SQL Editor (Project > SQL Editor > New Query)
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

-- Workspaces: user can only see their own workspace
create policy "workspace_scoped_select" on workspaces
  for select to authenticated
  using (id = auth_workspace_id());

-- Workspace users: scoped to workspace
create policy "workspace_scoped_select" on workspace_users
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Anomalies: scoped to workspace
create policy "workspace_scoped_select" on anomalies
  for select to authenticated
  using (workspace_id = auth_workspace_id());

create policy "workspace_scoped_insert" on anomalies
  for insert to authenticated
  with check (workspace_id = auth_workspace_id());

create policy "workspace_scoped_update" on anomalies
  for update to authenticated
  using (workspace_id = auth_workspace_id());

-- Workflows: scoped to workspace
create policy "workspace_scoped_select" on workflows
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Integrations: scoped to workspace
create policy "workspace_scoped_select" on integrations
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Monthly spend: scoped to workspace
create policy "workspace_scoped_select" on monthly_spend
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Category spend: scoped to workspace
create policy "workspace_scoped_select" on category_spend
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Savings opportunities: scoped to workspace
create policy "workspace_scoped_select" on savings_opportunities
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Pending approvals: scoped to workspace
create policy "workspace_scoped_select" on pending_approvals
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- AI events: scoped to workspace
create policy "workspace_scoped_select" on ai_events
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Audit events: scoped to workspace (admins only for full log)
create policy "workspace_scoped_select" on audit_events
  for select to authenticated
  using (workspace_id = auth_workspace_id());

-- Own profile: users can only read and update their own row
create policy "users read own profile"   on profiles for select to authenticated using (auth.uid() = id);
create policy "users update own profile" on profiles for update to authenticated using (auth.uid() = id);

-- ── 3. Auto-create profile on sign-up ────────────────────────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  ws_id uuid;
begin
  -- Assign to the first workspace (or extend to support multi-tenant later)
  select id into ws_id from workspaces order by created_at limit 1;

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

-- ── 4. Test user (remove before production) ─────────────────────────────────
-- Creates ghazialkhaldi45@gmail.com / password: 123
-- Also creates the auth.identities record required for email OTP to work.

do $$
declare
  new_uid  uuid := gen_random_uuid();
  user_uid uuid;
begin
  select id into user_uid from auth.users where email = 'ghazialkhaldi45@gmail.com';

  if user_uid is null then
    insert into auth.users (
      id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      aud, role, raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) values (
      new_uid, 'ghazialkhaldi45@gmail.com',
      crypt('123', gen_salt('bf')),
      now(), now(), now(),
      'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Ghazi Alkhaldi"}',
      false
    );
    user_uid := new_uid;
  end if;

  -- auth.identities is required for Supabase email OTP to work.
  -- Without this record, signInWithOtp silently fails.
  insert into auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    user_uid,
    user_uid,
    jsonb_build_object(
      'sub',            user_uid::text,
      'email',          'ghazialkhaldi45@gmail.com',
      'email_verified', true,
      'provider_id',    'ghazialkhaldi45@gmail.com'
    ),
    'email',
    now(), now(), now()
  ) on conflict do nothing;

end $$;

-- ── 5. Seed data ─────────────────────────────────────────────────────────────

-- Use a fixed UUID so all FK references stay consistent
do $seed$
declare
  ws uuid := '00000000-0000-0000-0000-000000000001';
begin

-- Workspace
insert into workspaces (id, name, industry, plan, fiscal_year, employees, annual_budget, ytd_spend, ytd_budget, savings_identified)
values (ws, 'YourCo Inc.', 'B2B Software', 'Enterprise', '2026', 287, 4500000, 2184300, 2250000, 284600)
on conflict (id) do nothing;

-- ── Anomalies ────────────────────────────────────────────────────────────────

insert into anomalies (id, workspace_id, title, category, vendor, amount, severity, status, confidence, detected_at, description, ai_summary, risk_level, reasoning, evidence_refs, suggested_actions, audit_trail) values
('ANO-001', ws, 'Duplicate invoice — Salesforce Enterprise', 'SaaS Tools', 'Salesforce', 12400, 'HIGH', 'Open', 94, '2026-06-18',
 'Two invoices for the same billing period (May 2026) were routed through separate AP channels and nearly processed for payment.',
 'Salesforce issued duplicate invoice #SF-2026-0441 and #SF-2026-0441B for the same Enterprise license term.',
 'High', 'Vendor invoice number patterns, GL coding, and line-item descriptions are identical.',
 '["Invoice #SF-2026-0441 (NetSuite AP queue, staged 2026-06-16)","Invoice #SF-2026-0441B (Procurement portal, received 2026-06-18)","Contract #ENT-22481 — single annual billing term"]',
 '[{"label":"Void duplicate invoice #SF-2026-0441B","type":"void","risk":"Low"},{"label":"Flag vendor account for duplicate-check rule","type":"rule","risk":"Low"},{"label":"Notify AP team lead","type":"notify","risk":"None"}]',
 '[{"ts":"2026-06-18 09:14","actor":"Ventura AI","action":"Anomaly detected via invoice pattern match","note":"Confidence 94%"},{"ts":"2026-06-18 11:30","actor":"Alex Torres","action":"Opened anomaly for review"}]'
),
('ANO-002', ws, 'Off-hours approval — AWS infrastructure spend', 'Cloud Infrastructure', 'Amazon Web Services', 45200, 'CRITICAL', 'Under Review', 87, '2026-06-20',
 'A $45,200 AWS spend approval was submitted and countersigned at 2:47 AM on a Sunday.',
 'Approval event for PO-2026-0318 ($45,200 AWS infrastructure expansion) was executed outside of the approver''s 98th-percentile working hours.',
 'Critical', 'Behavioral baseline deviation. 100% of prior 247 approvals from this user occurred Mon–Fri, 08:00–18:30 PT.',
 '["Approval timestamp: 2026-06-22 02:47 AM PT (Sunday)","Approver: David Kim (VP Engineering)","No MFA challenge logged for this approval session","User login IP: 185.220.101.42 (Tor exit node)"]',
 '[{"label":"Freeze PO-2026-0318 pending identity verification","type":"freeze","risk":"Medium"},{"label":"Require David Kim to re-authenticate and re-confirm","type":"reauth","risk":"Low"},{"label":"Escalate to CISO and CFO immediately","type":"escalate","risk":"None"}]',
 '[{"ts":"2026-06-22 02:47","actor":"David Kim","action":"Approved PO-2026-0318","note":"Off-hours, unusual IP"},{"ts":"2026-06-22 07:30","actor":"Ventura AI","action":"Behavioral anomaly flagged — CRITICAL severity"},{"ts":"2026-06-22 08:02","actor":"Alex Torres","action":"Escalated to security review"},{"ts":"2026-06-22 08:45","actor":"James Okafor (CISO)","action":"Security investigation opened"}]'
),
('ANO-003', ws, 'Vendor spend spike — Acme Consulting', 'Professional Services', 'Acme Consulting LLC', 28750, 'HIGH', 'Open', 91, '2026-06-17',
 'Acme Consulting billing has increased 312% vs. the prior quarter with no corresponding change order or project expansion on file.',
 'Q1 2026 spend with Acme Consulting was $6,980. Q2 2026 spend (through June 17) is $28,750 — a 312% increase.',
 'High', 'Spend trajectory deviates from baseline by more than 3 standard deviations.',
 '["SOW-2025-0087 — quarterly cap: $9,500","Q1 2026 invoices: $6,980 total (within cap)","Q2 2026 invoices to date: $28,750 (312% above cap)"]',
 '[{"label":"Request change order documentation from vendor","type":"request","risk":"Low"},{"label":"Hold remaining invoices pending authorization","type":"hold","risk":"Medium"},{"label":"Notify VP of Engineering (contract owner)","type":"notify","risk":"None"}]',
 '[{"ts":"2026-06-17 11:20","actor":"Ventura AI","action":"Spend spike detected vs. SOW cap","note":"+312% vs. baseline"}]'
),
('ANO-004', ws, 'Expense reimbursement without receipts', 'Travel & Entertainment', 'Employee — Jordan Matthews', 8240, 'MEDIUM', 'Open', 99, '2026-06-19',
 '$8,240 in expense reimbursements submitted without any attached receipts. Company policy requires documentation for all claims over $25.',
 'Expense report EXP-2026-0892 submitted by Jordan Matthews contains 14 line items totaling $8,240. Zero receipts attached.',
 'Medium', 'Document attachment count: 0 out of 14 required. Policy violation is deterministic — 100% confidence.',
 '["Expense report EXP-2026-0892 — 14 line items, $8,240 total","Company T&E Policy v4.2, Section 3.1: receipts required for all claims >$25","Attachment count: 0 documents"]',
 '[{"label":"Return expense report to employee for documentation","type":"return","risk":"Low"},{"label":"Block reimbursement pending receipt upload","type":"hold","risk":"Low"}]',
 '[{"ts":"2026-06-19 14:05","actor":"Ventura AI","action":"Policy violation detected — zero receipts on $8,240 claim"},{"ts":"2026-06-19 14:06","actor":"System","action":"Claim flagged in AP queue, reimbursement blocked"}]'
),
('ANO-005', ws, 'Duplicate SaaS subscription — Figma', 'SaaS Tools', 'Figma Inc.', 1800, 'LOW', 'Resolved', 99, '2026-05-30',
 'Two active Figma subscriptions detected: one on the corporate card, one via a personal card expensed monthly.',
 'Two Figma Professional subscriptions were active simultaneously: one on the corporate Amex and one on personal card expensed via EXP-2026-0741.',
 'Low', 'Subscription fingerprinting matched identical product SKU, same user email domain, and overlapping billing periods.',
 '["Corporate Amex charge: Figma Professional $150/mo (active since Jan 2026)","Expense claim EXP-2026-0741: Figma Professional $150/mo via personal card"]',
 '[{"label":"Cancel personal-card subscription (completed)","type":"cancel","risk":"None"},{"label":"Block future personal-card SaaS reimbursements without IT approval","type":"rule","risk":"Low"}]',
 '[{"ts":"2026-05-30 10:00","actor":"Ventura AI","action":"Duplicate subscription detected"},{"ts":"2026-05-31 09:05","actor":"Alex Torres","action":"Marked as Resolved","note":"Savings: $1,800/yr"}]'
),
('ANO-006', ws, 'Travel expense exceeds policy limit', 'Travel & Entertainment', 'Employee — Marcus Reid', 4500, 'MEDIUM', 'Under Review', 97, '2026-06-21',
 'Single hotel stay billed at $1,500/night for 3 nights. Company policy caps hotel reimbursements at $350/night in domestic markets.',
 'Expense report EXP-2026-0901 includes $4,500 hotel charge (The St. Regis San Francisco, 3 nights). Policy cap: $350/night.',
 'Medium', 'Policy rule comparison is deterministic. Hotel spend $1,500/night > policy cap $350/night.',
 '["Expense EXP-2026-0901 — The St. Regis SF, Jun 18–21, $4,500","T&E Policy v4.2 Section 4.3: domestic hotel max $350/night","Manager pre-approval waiver: not found in system"]',
 '[{"label":"Reimburse policy-compliant amount ($1,050)","type":"partial","risk":"Low"},{"label":"Request manager pre-approval waiver documentation","type":"request","risk":"None"}]',
 '[{"ts":"2026-06-21 08:30","actor":"Ventura AI","action":"Policy violation detected — hotel rate $1,500/night vs. $350 cap"},{"ts":"2026-06-22 10:00","actor":"Lisa Tran (Finance Mgr)","action":"Under review — checking for approved event exception"}]'
),
('ANO-007', ws, 'Payment to inactive vendor', 'Professional Services', 'Axiom Data Solutions', 15600, 'HIGH', 'Open', 88, '2026-06-16',
 'Axiom Data Solutions has been flagged as inactive in the vendor master since Q4 2025. A $15,600 invoice bypassed the inactive vendor check.',
 'Vendor Axiom Data Solutions (VND-0441) was deactivated in NetSuite on 2025-11-14 following contract expiration.',
 'High', 'Vendor status in master data: Inactive since 2025-11-14. Invoice entered manually, bypassing automated vendor status validation.',
 '["Vendor VND-0441 — deactivated 2025-11-14","Invoice #AXM-2026-0042 — received 2026-06-15, $15,600","AP entry timestamp: 2026-06-15 16:43 — manual override by AP clerk"]',
 '[{"label":"Block payment pending vendor reactivation review","type":"block","risk":"Low"},{"label":"Investigate manual AP override","type":"audit","risk":"None"},{"label":"Strengthen inactive vendor validation rule in ERP","type":"rule","risk":"Low"}]',
 '[{"ts":"2026-06-16 07:00","actor":"Ventura AI","action":"Inactive vendor detected — VND-0441"},{"ts":"2026-06-16 07:01","actor":"System","action":"Payment blocked, Finance notified"}]'
),
('ANO-008', ws, 'Untracked software license exposure', 'SaaS Tools', 'Various', 67200, 'CRITICAL', 'Open', 78, '2026-06-14',
 'Audit of IT asset records revealed 47 software licenses totaling $67,200 annually that are not captured in the approved SaaS inventory.',
 'Cross-referencing bank feed, corporate card transactions, and IT asset management system identified 47 active software subscriptions not registered in the approved SaaS inventory.',
 'Critical', 'Pattern matching across payment records and IT CMDB identified subscription charges not mapped to any approved tool.',
 '["47 unregistered subscriptions identified across Amex, Visa, and bank feed","IT Asset Management system (Snipe-IT): 213 approved tools on record","Top unregistered vendors: Notion ($4,200), Loom ($3,600), Linear ($2,400)"]',
 '[{"label":"Generate full unregistered subscription report","type":"report","risk":"None"},{"label":"Require IT approval workflow for all new SaaS purchases","type":"policy","risk":"Low"},{"label":"Consolidate or cancel duplicate/unused tools","type":"action","risk":"Medium"}]',
 '[{"ts":"2026-06-14 06:00","actor":"Ventura AI","action":"Shadow IT audit completed — 47 unregistered licenses"},{"ts":"2026-06-14 08:00","actor":"Alex Torres","action":"Escalated to IT Operations and CISO"}]'
),
('ANO-009', ws, 'Marketing overspend vs. budget', 'Marketing', 'Multiple — Marketing Vendors', 89400, 'HIGH', 'Under Review', 99, '2026-06-22',
 'Q2 2026 marketing spend reached $89,400 against a budget of $63,500 — a 40.8% overrun. No budget amendment or CFO override on file.',
 'Marketing department Q2 spend totaled $89,400, exceeding the approved Q2 budget of $63,500 by $25,900 (40.8%).',
 'High', 'Budget variance is deterministic: $89,400 actual vs. $63,500 approved.',
 '["Q2 2026 Marketing budget: $63,500 (approved 2026-03-31)","Q2 2026 Marketing actual: $89,400","Overspend: $25,900 (40.8%)","Top overspend vendors: Google Ads (+$12,000), HubSpot (+$7,400), Webflow (+$4,200)"]',
 '[{"label":"Request CFO retroactive budget amendment","type":"request","risk":"Low"},{"label":"Freeze additional marketing spend until approved","type":"freeze","risk":"Medium"},{"label":"Notify CMO and Finance Director","type":"notify","risk":"None"}]',
 '[{"ts":"2026-06-22 09:00","actor":"Ventura AI","action":"Budget overrun detected — Q2 Marketing +40.8%"},{"ts":"2026-06-22 10:15","actor":"Lisa Tran","action":"Under review — requesting CMO explanation"}]'
),
('ANO-010', ws, 'Duplicate payroll submission', 'Payroll', 'ADP (via HR)', 22100, 'CRITICAL', 'Resolved', 99, '2026-06-10',
 'The June 1st payroll cycle was submitted twice due to a system timeout and manual retry. The duplicate was caught pre-payment.',
 'A system timeout during ADP payroll submission caused an HR coordinator to manually resubmit the payroll run.',
 'Critical', 'Exact match on payroll batch ID, period dates, total amount, and employee count.',
 '["Payroll Batch #PR-2026-06-01A — submitted 2026-06-01 09:14","Payroll Batch #PR-2026-06-01B — submitted 2026-06-01 10:01 (duplicate)","Both batches: 287 employees, $22,100 net payroll","ADP confirmation: second batch blocked before ACH processing"]',
 '[{"label":"Confirmed resolved — duplicate batch cancelled","type":"resolved","risk":"None"},{"label":"Add idempotency check to payroll submission workflow","type":"rule","risk":"None"}]',
 '[{"ts":"2026-06-01 10:02","actor":"Ventura AI","action":"Duplicate payroll batch detected — CRITICAL, blocking second submission"},{"ts":"2026-06-10 09:00","actor":"Alex Torres","action":"Marked as Resolved","note":"Post-incident review complete"}]'
),
('ANO-011', ws, 'AWS Reserved Instance underutilization', 'Cloud Infrastructure', 'Amazon Web Services', 34800, 'MEDIUM', 'Open', 82, '2026-06-13',
 '18 Reserved Instances (1-year term) purchased in March 2026 are running at less than 20% utilization. Annualized waste estimated at $34,800.',
 '18 EC2 Reserved Instances (r5.2xlarge, us-west-2) were purchased in March 2026 for $52,200/yr. Current average utilization: 16.4%.',
 'Medium', 'AWS Cost Explorer data shows average utilization of 16.4% over the past 90 days.',
 '["18x r5.2xlarge Reserved Instances — purchased 2026-03-01 ($52,200/yr)","AWS Cost Explorer: avg utilization 16.4% (Apr–Jun 2026)","Break-even utilization: 40%","Estimated annual waste: $34,800"]',
 '[{"label":"List unused RIs on AWS Reserved Instance Marketplace","type":"action","risk":"Low"},{"label":"Migrate workloads to use reserved capacity","type":"action","risk":"Medium"},{"label":"Engage AWS TAM for capacity review","type":"request","risk":"None"}]',
 '[{"ts":"2026-06-13 06:00","actor":"Ventura AI","action":"RI underutilization detected — 16.4% avg over 90 days"}]'
),
('ANO-012', ws, 'Subscription renewal — no usage data', 'SaaS Tools', 'Lattice (HR Platform)', 9600, 'LOW', 'Open', 85, '2026-06-11',
 'Lattice annual subscription renewed at $9,600 with no usage data available for the prior 6 months.',
 'Lattice HR Platform renewed automatically for $9,600 (annual) on 2026-06-01. No usage metrics were tracked in the prior 6 months.',
 'Low', 'Renewal completed without usage verification. IT asset system shows last active login: 2025-12-14 — no activity in 6 months.',
 '["Lattice renewal: $9,600/yr, auto-renewed 2026-06-01","Last active Lattice login across all users: 2025-12-14","IT CMDB utilization flag: no activity > 90 days"]',
 '[{"label":"Survey HR team on Lattice usage and value","type":"request","risk":"None"},{"label":"Consider cancellation at next renewal cycle","type":"flag","risk":"Low"}]',
 '[{"ts":"2026-06-11 08:00","actor":"Ventura AI","action":"Low-usage renewal detected — 0 logins in 6 months"}]'
),
('ANO-013', ws, 'Vendor payment outside approval threshold', 'Professional Services', 'Brightline Legal Partners', 52000, 'HIGH', 'Open', 93, '2026-06-15',
 '$52,000 payment to Brightline Legal Partners was processed without CFO approval. Company policy requires CFO sign-off for payments exceeding $25,000.',
 'Invoice #BLP-2026-0187 for $52,000 (legal retainer services) was approved by the Finance Director without escalating to the CFO.',
 'High', 'Purchase Authority Matrix v2.1: single vendor payments >$25,000 require CFO approval.',
 '["Invoice #BLP-2026-0187 — $52,000, Brightline Legal Partners","Approved by: Lisa Tran (Finance Director) — 2026-06-14","CFO approval: not obtained","Purchase Authority Matrix v2.1, Section 2.4: CFO required for >$25,000"]',
 '[{"label":"Request retroactive CFO approval","type":"request","risk":"Low"},{"label":"Notify internal audit committee","type":"notify","risk":"None"},{"label":"Update approval workflow to enforce PAM thresholds","type":"rule","risk":"Low"}]',
 '[{"ts":"2026-06-15 11:00","actor":"Ventura AI","action":"Authority threshold violation detected — CFO approval required"},{"ts":"2026-06-15 11:02","actor":"System","action":"Finance Director and CFO notified"}]'
),
('ANO-014', ws, 'Corporate card misuse — personal charges', 'Travel & Entertainment', 'Employee — Priya Nair', 2840, 'MEDIUM', 'Under Review', 91, '2026-06-20',
 'Analysis of corporate card statement identified $2,840 in charges at retailers and entertainment venues inconsistent with business travel.',
 'Corporate card statement for Priya Nair contains $2,840 in charges categorized as personal: Best Buy, AMC Theatres, Pottery Barn, Spa services.',
 'Medium', 'Merchant Category Codes (MCCs) for flagged charges are outside approved business categories.',
 '["Corporate card #...7721 (Priya Nair)","Best Buy charge: $640 — MCC 5731 (Electronics)","AMC Theatres: $180 — MCC 7832","Pottery Barn: $1,240 — MCC 5719","Spa services: $780 — MCC 7299"]',
 '[{"label":"Request employee explanation for each charge","type":"request","risk":"None"},{"label":"Initiate HR policy review with employee","type":"hr","risk":"Low"},{"label":"Recover funds if charges confirmed personal","type":"recover","risk":"Medium"}]',
 '[{"ts":"2026-06-20 07:00","actor":"Ventura AI","action":"Personal MCC charges detected on corporate card"},{"ts":"2026-06-21 09:30","actor":"Lisa Tran","action":"Under review — HR notified"}]'
),
('ANO-015', ws, 'Stale PO — vendor invoice mismatch', 'Cloud Infrastructure', 'Cloudflare Inc.', 18500, 'MEDIUM', 'Open', 86, '2026-06-12',
 'Purchase order PO-2026-0241 ($18,500) for Cloudflare does not match the most recent invoice amount of $21,750. Unexplained variance of $3,250.',
 'PO-2026-0241 was raised for Cloudflare Enterprise plan at $18,500. Cloudflare''s June invoice is $21,750. The $3,250 variance is unexplained.',
 'Medium', 'Three-way match failure: PO amount $18,500 ≠ Invoice amount $21,750. No change order found.',
 '["PO-2026-0241 — Cloudflare Enterprise, $18,500","Invoice #CF-INV-2026-0612 — $21,750","Variance: $3,250 (17.6%)","Change order repository: no PO amendment on file"]',
 '[{"label":"Request Cloudflare invoice breakdown for $3,250 delta","type":"request","risk":"None"},{"label":"Raise PO amendment if variance is legitimate","type":"amend","risk":"Low"},{"label":"Hold payment pending three-way match resolution","type":"hold","risk":"Low"}]',
 '[{"ts":"2026-06-12 08:00","actor":"Ventura AI","action":"Three-way match failure detected — $3,250 variance"},{"ts":"2026-06-12 08:01","actor":"System","action":"AP queue hold applied"}]'
)
on conflict (id) do nothing;

-- ── Workflows ────────────────────────────────────────────────────────────────

insert into workflows (id, workspace_id, name, status, avg_days, sla_days, bottleneck_stage, bottleneck_days, in_progress, overdue, description, steps) values
('WF-001', ws, 'Vendor Invoice Approval (>$10K)', 'Bottleneck', 8.2, 5, 'CFO signature', 4.1, 12, 5,
 'Multi-step approval for vendor invoices exceeding $10,000. Requires Finance Manager and CFO sign-off.',
 '[{"name":"AP Entry & Coding","avgDays":0.4,"owner":"AP Team","status":"ok"},{"name":"Finance Manager Review","avgDays":1.8,"owner":"Lisa Tran","status":"ok"},{"name":"Budget Validation","avgDays":1.9,"owner":"Finance Analyst","status":"slow"},{"name":"CFO Signature","avgDays":4.1,"owner":"Michael Park (CFO)","status":"stuck"}]'),
('WF-002', ws, 'Vendor Onboarding', 'Bottleneck', 14.1, 7, 'Legal review', 6.3, 7, 4,
 'End-to-end vendor onboarding: vendor validation, contract review, legal sign-off, AP system setup.',
 '[{"name":"Vendor Application & Screening","avgDays":1.2,"owner":"Procurement","status":"ok"},{"name":"Finance Credit Check","avgDays":0.8,"owner":"Finance Analyst","status":"ok"},{"name":"Legal Review & NDA","avgDays":6.3,"owner":"Legal (Brightline)","status":"stuck"},{"name":"AP System Setup","avgDays":0.6,"owner":"AP Team","status":"ok"},{"name":"Final Approval","avgDays":5.2,"owner":"VP Engineering / CFO","status":"slow"}]'),
('WF-003', ws, 'Employee Expense Reimbursement', 'Warning', 21.3, 10, 'Multiple handoffs (4 steps)', 7.2, 43, 18,
 'Employee T&E reimbursement from submission through manager approval, policy check, Finance sign-off, and payment.',
 '[{"name":"Submission & Receipt Upload","avgDays":0,"owner":"Employee","status":"ok"},{"name":"Manager Approval","avgDays":3.1,"owner":"Line Manager","status":"slow"},{"name":"Policy Compliance Check","avgDays":7.2,"owner":"Finance Analyst","status":"stuck"},{"name":"Finance Sign-off","avgDays":2.4,"owner":"Finance Manager","status":"ok"},{"name":"Payroll / ACH Processing","avgDays":8.6,"owner":"Payroll (ADP)","status":"slow"}]'),
('WF-004', ws, 'Software License Renewal', 'Warning', 6.4, 5, 'IT Procurement review', 2.1, 9, 3,
 'SaaS and on-prem license renewal workflow including IT utilization review, budget check, and approval.',
 '[{"name":"Renewal Notice & Intake","avgDays":0.5,"owner":"IT Operations","status":"ok"},{"name":"Utilization Review","avgDays":2.1,"owner":"IT Procurement","status":"stuck"},{"name":"Budget Approval","avgDays":1.8,"owner":"Finance Manager","status":"slow"},{"name":"Vendor Confirmation","avgDays":2.0,"owner":"Procurement","status":"ok"}]'),
('WF-005', ws, 'Budget Variance Approval', 'Critical', 11.2, 3, 'Finance Director', 7.8, 6, 6,
 'Approval flow for department spend that exceeds approved budget by >10%.',
 '[{"name":"Variance Identification","avgDays":0.2,"owner":"Ventura AI","status":"ok"},{"name":"Department Head Explanation","avgDays":1.8,"owner":"Department Head","status":"slow"},{"name":"Finance Director Review","avgDays":7.8,"owner":"Lisa Tran","status":"stuck"},{"name":"CFO Decision","avgDays":1.4,"owner":"Michael Park (CFO)","status":"ok"}]'),
('WF-006', ws, 'Contract Amendment', 'Critical', 23.4, 14, 'Legal ↔ Finance deadlock', 14.6, 3, 3,
 'Vendor contract amendments requiring joint sign-off from Legal and Finance.',
 '[{"name":"Amendment Request & Intake","avgDays":0.8,"owner":"Procurement","status":"ok"},{"name":"Commercial Terms Review (Finance)","avgDays":14.6,"owner":"Lisa Tran / CFO","status":"stuck"},{"name":"Legal Review & Red-lines","avgDays":14.6,"owner":"Legal (Brightline)","status":"stuck"},{"name":"Final Sign-off","avgDays":7.4,"owner":"CFO + Legal","status":"slow"}]'),
('WF-007', ws, 'Corporate Card Authorization', 'On Track', 2.8, 5, 'None', 0, 8, 0,
 'New corporate card issuance or limit adjustment.',
 '[{"name":"Employee Request","avgDays":0,"owner":"Employee","status":"ok"},{"name":"Manager Authorization","avgDays":0.7,"owner":"Line Manager","status":"ok"},{"name":"Finance Approval","avgDays":1.1,"owner":"Finance Manager","status":"ok"},{"name":"IT/Card Issuance","avgDays":1.0,"owner":"IT Operations","status":"ok"}]'),
('WF-008', ws, 'Refund & Credit Processing', 'On Track', 4.6, 7, 'None', 0, 4, 0,
 'Inbound vendor credits and refunds processing through AP reconciliation.',
 '[{"name":"Credit/Refund Receipt","avgDays":0.4,"owner":"AP Team","status":"ok"},{"name":"GL Reconciliation","avgDays":1.8,"owner":"Finance Analyst","status":"ok"},{"name":"Finance Sign-off","avgDays":2.4,"owner":"Finance Manager","status":"ok"}]')
on conflict (id) do nothing;

-- ── Integrations ─────────────────────────────────────────────────────────────

insert into integrations (id, workspace_id, name, type, status, last_sync, records_sync, description, auth_method) values
('INT-001', ws, 'QuickBooks Online', 'Accounting',      'Connected',    '2026-06-23 07:42 AM', 18420, 'General ledger, chart of accounts, AP/AR transactions.',       'OAuth 2.0'),
('INT-002', ws, 'Plaid Bank Feeds',  'Bank Feed',        'Connected',    '2026-06-23 08:15 AM', 6340,  'Live bank and credit card transaction feeds for 4 accounts.',   'Plaid Link'),
('INT-003', ws, 'ADP Workforce Now', 'Payroll',          'Connected',    '2026-06-22 06:00 PM', 287,   'Payroll runs, employee headcount, reimbursements.',              'API Key + Webhook'),
('INT-004', ws, 'Salesforce CRM',    'CRM',              'Connected',    '2026-06-23 06:30 AM', 4210,  'Contract values, renewal dates, customer revenue data.',         'OAuth 2.0'),
('INT-005', ws, 'Slack Notifications','Collaboration',   'Connected',    'Real-time',           0,     'Finance alerts and anomaly notifications to #finance-ops.',     'Slack App OAuth'),
('INT-006', ws, 'CSV Import',         'Manual',          'Connected',    '2026-06-20 02:18 PM', 1240,  'Bulk transaction import via structured CSV template.',          'Manual Upload'),
('INT-007', ws, 'Document Upload',    'Document',        'Connected',    '2026-06-22 11:45 AM', 23,    'Invoice and receipt uploads for OCR extraction.',               'Secure File Upload'),
('INT-008', ws, 'Okta SSO / SCIM',   'Identity',        'Connected',    '2026-06-23 08:00 AM', 287,   'Single Sign-On and automated user provisioning/deprovisioning.','SAML 2.0 + SCIM 2.0')
on conflict (id) do nothing;

-- ── Monthly spend ─────────────────────────────────────────────────────────────

insert into monthly_spend (workspace_id, month, spend, budget) values
(ws, 'Jan', 318400, 375000),
(ws, 'Feb', 295200, 375000),
(ws, 'Mar', 342800, 375000),
(ws, 'Apr', 387100, 375000),
(ws, 'May', 412600, 375000),
(ws, 'Jun', 428200, 375000);

-- ── Category spend ────────────────────────────────────────────────────────────

insert into category_spend (workspace_id, name, value, color, pct) values
(ws, 'Cloud Infra', 1243800, '#10b981', 29.5),
(ws, 'Payroll',     1456200, '#8b5cf6', 34.5),
(ws, 'SaaS Tools',  892400,  '#06b6d4', 21.2),
(ws, 'Marketing',   284600,  '#f59e0b', 6.7),
(ws, 'Legal',       187400,  '#ef4444', 4.4),
(ws, 'T&E',         94200,   '#10b981', 2.2),
(ws, 'Office',      60040,   '#6366f1', 1.4);

-- ── Savings opportunities ─────────────────────────────────────────────────────

insert into savings_opportunities (id, workspace_id, title, category, annual_savings, effort, status) values
('SAV-001', ws, 'Unused SaaS licenses',         'SaaS Tools',           142400, 'Low',    'Identified'),
('SAV-002', ws, 'AWS RI rightsizing',            'Cloud Infrastructure',  89200, 'Medium', 'In Progress'),
('SAV-003', ws, 'Duplicate subscriptions',       'SaaS Tools',            28400, 'Low',    'Identified'),
('SAV-004', ws, 'Vendor contract renegotiation', 'Professional Services', 24600, 'High',   'Identified')
on conflict (id) do nothing;

-- ── Pending approvals ────────────────────────────────────────────────────────

insert into pending_approvals (id, workspace_id, title, amount, waiting, days_waiting, anomaly_id) values
('PA-001', ws, 'AWS infrastructure expansion (PO-2026-0318)',      45200, 'CFO',            6, 'ANO-002'),
('PA-002', ws, 'Brightline Legal retainer invoice #BLP-2026-0187', 52000, 'CFO',            3, 'ANO-013'),
('PA-003', ws, 'Acme Consulting Q3 SOW amendment',                 28750, 'VP Engineering', 2, 'ANO-003'),
('PA-004', ws, 'Q3 marketing campaign additional budget',          15000, 'CMO',            1, null),
('PA-005', ws, 'Lattice HR Platform annual renewal',                9600, 'VP HR',          8, 'ANO-012')
on conflict (id) do nothing;

-- ── AI events ─────────────────────────────────────────────────────────────────

insert into ai_events (id, workspace_id, ts, task_type, model, confidence, risk_tier, status, cost_estimate, anomaly_id, actor_email) values
('AIE-001', ws, '2026-06-23 08:42', 'Invoice anomaly detection',          'gpt-4o',      94, 'Low',    'auto-approved',  0.014, 'ANO-001', 'ventura-ai@yourco.com'),
('AIE-002', ws, '2026-06-22 07:30', 'Behavioral pattern analysis',        'gpt-4o',      87, 'High',   'human-approved', 0.042, 'ANO-002', 'alex.torres@yourco.com'),
('AIE-003', ws, '2026-06-22 09:00', 'Budget variance classification',     'gpt-4o-mini', 99, 'Low',    'auto-approved',  0.003, 'ANO-009', 'ventura-ai@yourco.com'),
('AIE-004', ws, '2026-06-21 08:30', 'T&E policy compliance check',        'gpt-4o-mini', 97, 'Low',    'auto-approved',  0.002, 'ANO-006', 'ventura-ai@yourco.com'),
('AIE-005', ws, '2026-06-20 07:00', 'Corporate card MCC analysis',        'gpt-4o',      91, 'Medium', 'human-approved', 0.028, 'ANO-014', 'lisa.tran@yourco.com'),
('AIE-006', ws, '2026-06-20 07:00', 'Vendor status validation',           'gpt-4o-mini', 88, 'Low',    'auto-approved',  0.004, 'ANO-007', 'ventura-ai@yourco.com'),
('AIE-007', ws, '2026-06-19 14:05', 'Receipt compliance audit',           'gpt-4o-mini', 99, 'Low',    'auto-approved',  0.002, 'ANO-004', 'ventura-ai@yourco.com'),
('AIE-008', ws, '2026-06-18 09:14', 'Invoice pattern match',              'gpt-4o',      94, 'Low',    'auto-approved',  0.011, 'ANO-001', 'ventura-ai@yourco.com'),
('AIE-009', ws, '2026-06-17 11:20', 'Spend spike analysis',               'gpt-4o',      91, 'Medium', 'human-approved', 0.035, 'ANO-003', 'alex.torres@yourco.com'),
('AIE-010', ws, '2026-06-16 07:00', 'Inactive vendor detection',          'gpt-4o-mini', 88, 'Low',    'auto-approved',  0.003, 'ANO-007', 'ventura-ai@yourco.com'),
('AIE-011', ws, '2026-06-15 11:00', 'Authority matrix violation check',   'gpt-4o',      93, 'High',   'blocked',        0.000, 'ANO-013', 'ventura-ai@yourco.com'),
('AIE-012', ws, '2026-06-14 06:00', 'Shadow IT license audit',            'gpt-4o',      78, 'Medium', 'human-approved', 0.052, 'ANO-008', 'james.okafor@yourco.com'),
('AIE-013', ws, '2026-06-13 06:00', 'AWS cost optimization analysis',     'gpt-4o',      82, 'Medium', 'human-approved', 0.039, 'ANO-011', 'alex.torres@yourco.com'),
('AIE-014', ws, '2026-06-12 08:00', 'Three-way match verification',       'gpt-4o-mini', 86, 'Low',    'auto-approved',  0.005, 'ANO-015', 'ventura-ai@yourco.com'),
('AIE-015', ws, '2026-06-11 08:00', 'Subscription utilization review',    'gpt-4o-mini', 85, 'Low',    'auto-approved',  0.004, 'ANO-012', 'ventura-ai@yourco.com'),
('AIE-016', ws, '2026-06-10 10:02', 'Payroll duplicate detection',        'gpt-4o',      99, 'High',   'blocked',        0.000, 'ANO-010', 'ventura-ai@yourco.com'),
('AIE-017', ws, '2026-06-09 11:00', 'Vendor spend forecast',              'gpt-4o',      74, 'Low',    'auto-approved',  0.018, null,      'ventura-ai@yourco.com'),
('AIE-018', ws, '2026-06-08 14:00', 'Savings opportunity identification', 'gpt-4o',      88, 'Low',    'auto-approved',  0.024, null,      'ventura-ai@yourco.com'),
('AIE-019', ws, '2026-06-07 09:00', 'Contract risk classification',       'gpt-4o',      81, 'Medium', 'human-approved', 0.033, null,      'lisa.tran@yourco.com'),
('AIE-020', ws, '2026-06-06 16:00', 'Monthly spend categorization',       'gpt-4o-mini', 96, 'Low',    'auto-approved',  0.006, null,      'ventura-ai@yourco.com')
on conflict (id) do nothing;

-- ── Audit events ─────────────────────────────────────────────────────────────

insert into audit_events (id, workspace_id, ts, actor, actor_email, event_type, resource, detail, ip_address, severity) values
('AUD-001', ws, '2026-06-23 08:52', 'Alex Torres',    'alex.torres@yourco.com',  'Anomaly Review',    'ANO-002',           'Escalated to CISO — off-hours approval investigation opened',              '192.168.1.42', 'critical'),
('AUD-002', ws, '2026-06-23 08:15', 'Ventura AI',     'ventura-ai@yourco.com',   'Data Sync',         'Plaid Integration', 'Bank feed sync completed — 6,340 records ingested',                        'internal',     'info'),
('AUD-003', ws, '2026-06-23 07:42', 'Ventura AI',     'ventura-ai@yourco.com',   'Data Sync',         'QuickBooks Online', 'GL sync completed — 18,420 records, 0 errors',                             'internal',     'info'),
('AUD-004', ws, '2026-06-22 14:30', 'Lisa Tran',      'lisa.tran@yourco.com',    'Anomaly Action',    'ANO-009',           'Placed Q2 marketing additional spend on hold pending CFO review',          '192.168.1.67', 'warning'),
('AUD-005', ws, '2026-06-22 10:15', 'Lisa Tran',      'lisa.tran@yourco.com',    'Anomaly Review',    'ANO-006',           'Opened review on T&E hotel policy violation — HR notified',                '192.168.1.67', 'warning'),
('AUD-006', ws, '2026-06-22 08:45', 'James Okafor',   'james.okafor@yourco.com', 'Security Event',    'ANO-002',           'CISO opened security investigation on PO-2026-0318 approval',              '192.168.1.90', 'critical'),
('AUD-007', ws, '2026-06-22 08:02', 'Alex Torres',    'alex.torres@yourco.com',  'Anomaly Review',    'ANO-002',           'Escalated behavioral anomaly to security review',                          '192.168.1.42', 'critical'),
('AUD-008', ws, '2026-06-21 09:30', 'Lisa Tran',      'lisa.tran@yourco.com',    'Anomaly Action',    'ANO-014',           'Notified HR of potential corporate card misuse — Priya Nair',              '192.168.1.67', 'warning'),
('AUD-009', ws, '2026-06-20 09:45', 'Alex Torres',    'alex.torres@yourco.com',  'User Login',        'Auth',              'Successful login via Supabase Auth',                                       '192.168.1.42', 'info'),
('AUD-010', ws, '2026-06-20 07:00', 'Ventura AI',     'ventura-ai@yourco.com',   'Anomaly Detected',  'ANO-007',           'Inactive vendor payment attempt blocked — Axiom Data Solutions',          'internal',     'warning'),
('AUD-011', ws, '2026-06-19 14:06', 'Ventura AI',     'ventura-ai@yourco.com',   'Payment Blocked',   'EXP-2026-0892',     'Expense reimbursement blocked — zero receipts on $8,240 claim',           'internal',     'warning'),
('AUD-012', ws, '2026-06-18 11:30', 'Alex Torres',    'alex.torres@yourco.com',  'Anomaly Review',    'ANO-001',           'Opened Salesforce duplicate invoice for review',                           '192.168.1.42', 'info'),
('AUD-013', ws, '2026-06-17 11:20', 'Ventura AI',     'ventura-ai@yourco.com',   'Anomaly Detected',  'ANO-003',           'Acme Consulting 312% spend spike vs. SOW cap detected',                   'internal',     'warning'),
('AUD-014', ws, '2026-06-16 08:00', 'Alex Torres',    'alex.torres@yourco.com',  'Settings Change',   'AI Governance',     'Raised confidence threshold for auto-approval from 80% to 85%',           '192.168.1.42', 'info'),
('AUD-015', ws, '2026-06-15 11:02', 'System',         'system@yourco.com',       'Alert Sent',        'ANO-013',           'CFO and Finance Director notified of authority threshold violation',        'internal',     'warning'),
('AUD-016', ws, '2026-06-14 08:00', 'Alex Torres',    'alex.torres@yourco.com',  'Anomaly Action',    'ANO-008',           'Escalated shadow IT report to CISO — 47 unregistered licenses',           '192.168.1.42', 'critical'),
('AUD-017', ws, '2026-06-13 14:00', 'Marcus Yuen',    'marcus.yuen@yourco.com',  'User Login',        'Auth',              'Successful login via Supabase Auth',                                       '10.0.1.22',    'info'),
('AUD-018', ws, '2026-06-12 16:00', 'Lisa Tran',      'lisa.tran@yourco.com',    'Data Export',       'Audit Logs',        'Exported June audit log for board reporting — CSV download',               '192.168.1.67', 'info'),
('AUD-019', ws, '2026-06-12 08:01', 'System',         'system@yourco.com',       'Payment Blocked',   'PO-2026-0241',      'Cloudflare invoice payment held — three-way match failure $3,250 delta',  'internal',     'warning'),
('AUD-020', ws, '2026-06-10 10:03', 'System',         'system@yourco.com',       'Payment Blocked',   'PR-2026-06-01B',    'CRITICAL: Duplicate payroll batch cancelled — $22,100 payment prevented', 'internal',     'critical'),
('AUD-021', ws, '2026-06-10 09:00', 'Alex Torres',    'alex.torres@yourco.com',  'Anomaly Resolved',  'ANO-010',           'Duplicate payroll anomaly resolved — post-incident review complete',       '192.168.1.42', 'info'),
('AUD-022', ws, '2026-06-09 11:00', 'Daniel Park',    'daniel.park@yourco.com',  'Integration Event', 'ADP Integration',   'Payroll sync configuration updated — added June cycle webhook',            '10.0.1.55',    'info'),
('AUD-023', ws, '2026-06-08 10:00', 'James Okafor',   'james.okafor@yourco.com', 'Settings Change',   'Security',          'IP allowlist updated — added new VPN subnet 10.20.0.0/24',                '192.168.1.90', 'info'),
('AUD-024', ws, '2026-06-07 15:00', 'Alex Torres',    'alex.torres@yourco.com',  'User Management',   'Settings',          'New user provisioned: Jenny Liu (Finance Analyst)',                        '192.168.1.42', 'info'),
('AUD-025', ws, '2026-06-06 09:00', 'Ventura AI',     'ventura-ai@yourco.com',   'Report Generated',  'Monthly Report',    'May 2026 spend summary report generated and distributed to finance team', 'internal',     'info'),
('AUD-026', ws, '2026-06-05 16:00', 'Lisa Tran',      'lisa.tran@yourco.com',    'Anomaly Dismissed', 'ANO-OLD-003',       'Prior month flagged charge dismissed — vendor confirmed legitimate',        '192.168.1.67', 'info'),
('AUD-027', ws, '2026-06-04 11:00', 'Marcus Yuen',    'marcus.yuen@yourco.com',  'Data Import',       'CSV Import',        'May vendor ledger CSV imported — 1,240 records, 3 validation errors resolved','10.0.1.22', 'info'),
('AUD-028', ws, '2026-06-03 14:00', 'Alex Torres',    'alex.torres@yourco.com',  'Settings Change',   'Workflows',         'SLA updated for Vendor Invoice Approval from 7 days to 5 days',           '192.168.1.42', 'info'),
('AUD-029', ws, '2026-06-02 09:00', 'System',         'system@yourco.com',       'Data Sync',         'QuickBooks Online', 'Monthly GL reconciliation sync completed — May 2026 period',              'internal',     'info'),
('AUD-030', ws, '2026-06-01 10:03', 'Ventura AI',     'ventura-ai@yourco.com',   'Payment Blocked',   'PR-2026-06-01B',    'CRITICAL: Duplicate payroll batch detected and blocked before ACH processing','internal','critical')
on conflict (id) do nothing;

-- ── Workspace users ───────────────────────────────────────────────────────────

insert into workspace_users (id, workspace_id, name, email, role, status, last_login, mfa) values
('USR-001', ws, 'Alex Torres',    'alex.torres@yourco.com',    'Admin',           'Active',   '2026-06-23 08:52', true),
('USR-002', ws, 'Michael Park',   'michael.park@yourco.com',   'Admin',           'Active',   '2026-06-22 15:10', true),
('USR-003', ws, 'Lisa Tran',      'lisa.tran@yourco.com',      'Finance Manager', 'Active',   '2026-06-23 07:30', true),
('USR-004', ws, 'James Okafor',   'james.okafor@yourco.com',   'Admin',           'Active',   '2026-06-22 08:45', true),
('USR-005', ws, 'Marcus Yuen',    'marcus.yuen@yourco.com',    'Finance Analyst', 'Active',   '2026-06-21 14:00', true),
('USR-006', ws, 'Jenny Liu',      'jenny.liu@yourco.com',      'Finance Analyst', 'Active',   '2026-06-20 09:00', false),
('USR-007', ws, 'Daniel Park',    'daniel.park@yourco.com',    'Finance Analyst', 'Active',   '2026-06-19 11:00', true),
('USR-008', ws, 'Angela Rossi',   'angela.rossi@yourco.com',   'Read-Only',       'Active',   '2026-06-18 16:00', false),
('USR-009', ws, 'Ben Nakamura',   'ben.nakamura@yourco.com',   'Read-Only',       'Active',   '2026-06-17 10:30', false),
('USR-010', ws, 'Carla Mendes',   'carla.mendes@yourco.com',   'Finance Analyst', 'Inactive', '2026-05-14 09:00', true),
('USR-011', ws, 'Tom Ellison',    'tom.ellison@yourco.com',    'Read-Only',       'Pending',  'Never',            false),
('USR-012', ws, 'Ventura AI',     'ventura-ai@yourco.com',     'System',          'Active',   '2026-06-23 08:42', true)
on conflict (id) do nothing;

end $seed$;
