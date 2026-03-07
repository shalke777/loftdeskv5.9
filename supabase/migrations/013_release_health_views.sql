
-- v5.1 release / health support views

create or replace view public.workspace_health_overview as
select
  c.id as company_id,
  c.name,
  c.plan,
  (select count(*) from public.company_members cm where cm.company_id = c.id) as members_count,
  (select count(*) from public.company_invitations ci where ci.company_id = c.id and ci.status = 'pending') as pending_invitations
from public.companies c;
