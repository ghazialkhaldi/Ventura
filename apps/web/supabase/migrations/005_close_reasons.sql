-- Why a finding was closed: a real issue, something known or expected, or a
-- false alarm. Status alone cannot tell those apart, and the difference is what
-- later ranking of findings has to learn from.
--
-- Reasons are checked by the API. The app works without this migration: until
-- it has run, the reason is written into the decision's note instead.
--
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.

alter table findings add column if not exists close_reason text;
alter table finding_events add column if not exists reason text;

notify pgrst, 'reload schema';
