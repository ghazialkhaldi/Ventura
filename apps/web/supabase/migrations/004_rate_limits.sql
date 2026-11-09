-- Rate limits that hold across serverless instances.
--
-- Sign-in codes, signup codes and invite joins are limited per account and per
-- address. Counting in one server's memory does nothing on Vercel, where each
-- request can land on a different instance, so the counts live here.
--
-- Reached only through the app's API routes with the service-role key. Row
-- level security is on with no policies, so the browser's keys can read or
-- write none of it.
--
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.

create table if not exists rate_limit_events (
  id         bigint generated always as identity primary key,
  key        text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_key_time on rate_limit_events (key, created_at desc);
alter table rate_limit_events enable row level security;
