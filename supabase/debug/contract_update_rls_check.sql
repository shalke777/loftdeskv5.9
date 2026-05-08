-- Debug: contracts UPDATE vs SELECT visibility
-- Run each block separately in the Supabase SQL Editor.
--
-- BEFORE RUNNING:
--   Replace every occurrence of '00000000-0000-0000-0000-000000000000'
--   with the real contract UUID you want to test.
--
-- NOTE: The Supabase SQL Editor runs as the postgres service role by default,
--       so RLS is bypassed unless you wrap queries in set_config calls.
--       Use these queries to compare raw DB state.
--       To test RLS as an authenticated user, use the API/client directly
--       or configure a Row Level Security test via the Auth JWT debug endpoint.

-- 0) Check current user context
select auth.uid() as auth_uid, current_user, session_user;

-- A) Is the row present at all (bypasses RLS — runs as service role)?
select id, company_id, user_id, status, notes
from public.contracts
where id = '00000000-0000-0000-0000-000000000000';

-- B) Noop UPDATE to test if UPDATE succeeds (bypasses RLS — runs as service role)
update public.contracts
set notes = notes
where id = '00000000-0000-0000-0000-000000000000'
returning id, company_id, user_id, status, notes;

-- C) Active RLS policies on the contracts table
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename  = 'contracts'
order by cmd, policyname;

-- D) Does the row belong to an existing company?
--    (Helps detect dangling company_id that breaks company-based RLS)
select c.id         as contract_id,
       c.company_id,
       co.id        as company_exists
from public.contracts c
left join public.companies co on co.id = c.company_id
where c.id = '00000000-0000-0000-0000-000000000000';
