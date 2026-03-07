-- LoftDesk v4.7 seed / backfill helper
-- This script is safe for local development.

-- Krok 1: Utwórz firmy z profili użytkowników (jeśli jeszcze nie mają)
do $$
declare
  p record;
  new_company_id uuid;
begin
  for p in
    select id, email, full_name, company, nip, plan
    from public.profiles
    where not exists (
      select 1 from public.company_members cm where cm.user_id = profiles.id
    )
  loop
    new_company_id := gen_random_uuid();

    insert into public.companies (id, name, nip, plan)
    values (
      new_company_id,
      coalesce(nullif(p.company, ''), nullif(p.full_name, ''), split_part(p.email, '@', 1)),
      nullif(p.nip, ''),
      coalesce(p.plan, 'free')
    );

    insert into public.company_members (company_id, user_id, role)
    values (new_company_id, p.id, 'owner');
  end loop;
end $$;

update public.clients cl
set company_id = cm.company_id
from public.company_members cm
where cl.company_id is null and cl.user_id = cm.user_id;

update public.projects pr
set company_id = cm.company_id
from public.company_members cm
where pr.company_id is null and pr.user_id = cm.user_id;

update public.cost_estimates ce
set company_id = cm.company_id
from public.company_members cm
where ce.company_id is null and ce.user_id = cm.user_id;

update public.invoices i
set company_id = cm.company_id
from public.company_members cm
where i.company_id is null and i.user_id = cm.user_id;

update public.contracts c
set company_id = cm.company_id
from public.company_members cm
where c.company_id is null and c.user_id = cm.user_id;
