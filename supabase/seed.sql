-- LoftDesk v4.7 seed / backfill helper
-- This script is safe for local development.

insert into public.companies (id, owner_user_id, name, nip, plan)
select
  gen_random_uuid(),
  p.id,
  coalesce(nullif(p.company, ''), nullif(p.full_name, ''), split_part(p.email, '@', 1)),
  nullif(p.nip, ''),
  coalesce(p.plan, 'free')
from public.profiles p
where not exists (
  select 1
  from public.company_members cm
  where cm.user_id = p.id
);

insert into public.company_members (company_id, user_id, role)
select c.id, c.owner_user_id, 'owner'
from public.companies c
where c.owner_user_id is not null
  and not exists (
    select 1
    from public.company_members cm
    where cm.company_id = c.id and cm.user_id = c.owner_user_id
  );

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
