-- Migration 023: Fix infinite recursion in my_company_id() / my_role()
-- Problem: These functions query company_members, but company_members RLS
-- calls my_company_id() → infinite recursion → stack depth exceeded (54001)
-- Fix: Make both functions SECURITY DEFINER so they bypass RLS

create or replace function my_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from company_members where user_id = auth.uid() limit 1
$$;

create or replace function my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from company_members where user_id = auth.uid() limit 1
$$;

-- Also fix company_members RLS to use direct auth.uid() check (no function call)
-- so it's doubly safe
drop policy if exists "members_select" on company_members;
create policy "members_select" on company_members
  for select using (user_id = auth.uid());

drop policy if exists "members_insert" on company_members;
create policy "members_insert" on company_members
  for insert with check (user_id = auth.uid());

-- Grant execute to authenticated and anon (PostgREST needs this for RPC)
grant execute on function public.my_company_id() to authenticated;
grant execute on function public.my_company_id() to anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_role() to anon;
grant execute on function public.bootstrap_my_company(text, text) to authenticated;
