-- 016_release_views_and_portal_guards.sql

create or replace view v_release_company_health as
select
  c.id as company_id,
  c.name as company_name,
  c.plan,
  count(distinct cm.user_id) as members_count,
  count(distinct ci.id) filter (where ci.status = 'pending') as pending_invitations
from companies c
left join company_members cm on cm.company_id = c.id
left join company_invitations ci on ci.company_id = c.id
group by c.id, c.name, c.plan;

comment on view v_release_company_health is 'Workspace health view used in LoftDesk v5.2 release pack';
