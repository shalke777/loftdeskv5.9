-- LoftDesk v5.0 release support
create or replace view release_workspace_summary as
select
  c.id as company_id,
  c.name,
  c.plan,
  count(distinct cm.user_id) as members_count
from companies c
left join company_members cm on cm.company_id = c.id
group by c.id, c.name, c.plan;
