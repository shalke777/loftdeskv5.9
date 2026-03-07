create or replace function public.bootstrap_my_company(company_name text default null, company_nip text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_profile record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select company_id into v_company_id
  from public.company_members
  where user_id = v_user_id
  limit 1;

  if v_company_id is not null then
    return v_company_id;
  end if;

  select * into v_profile from public.profiles where id = v_user_id;

  insert into public.companies (owner_user_id, name, nip, plan)
  values (
    v_user_id,
    coalesce(nullif(company_name, ''), nullif(v_profile.company, ''), nullif(v_profile.full_name, ''), 'LoftDesk Workspace'),
    coalesce(nullif(company_nip, ''), nullif(v_profile.nip, '')),
    coalesce(v_profile.plan, 'free')
  )
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, v_user_id, 'owner')
  on conflict (company_id, user_id) do nothing;

  update public.clients set company_id = v_company_id where user_id = v_user_id and company_id is null;
  update public.projects set company_id = v_company_id where user_id = v_user_id and company_id is null;
  update public.cost_estimates set company_id = v_company_id where user_id = v_user_id and company_id is null;
  update public.invoices set company_id = v_company_id where user_id = v_user_id and company_id is null;
  update public.contracts set company_id = v_company_id where user_id = v_user_id and company_id is null;

  return v_company_id;
end $$;

create or replace view public.company_bootstrap_status as
select
  p.id as user_id,
  p.email,
  p.company,
  p.plan,
  exists(select 1 from public.company_members cm where cm.user_id = p.id) as has_company_membership
from public.profiles p;
