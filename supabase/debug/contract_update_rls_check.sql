-- Debug: contracts UPDATE vs SELECT visibility (run in Supabase SQL editor as authenticated user)
-- 1) Replace the contract id below.
-- 2) Compare SELECT visibility and UPDATE permission under current RLS.

-- Optional helper: inspect current auth identity in SQL editor
select auth.uid() as auth_uid;

-- Replace value:
-- \set contract_id '00000000-0000-0000-0000-000000000000'

-- A) Is row visible for SELECT policies?
select id, company_id, user_id, status, notes
from public.contracts
where id = :'contract_id';

-- B) Can row be updated (noop update)?
update public.contracts
set notes = notes
where id = :'contract_id'
returning id, company_id, user_id, status, notes;

-- C) Inspect contracts policies in runtime DB
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'contracts'
order by policyname;
