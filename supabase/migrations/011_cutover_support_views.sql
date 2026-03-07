-- 011_cutover_support_views.sql
create or replace view company_health_view as
select
  c.id as company_id,
  c.name,
  c.plan,
  count(distinct cm.user_id) as members_count,
  count(distinct cli.id) as clients_count,
  count(distinct ce.id) as estimates_count,
  count(distinct inv.id) as invoices_count,
  count(distinct pr.id) as projects_count
from companies c
left join company_members cm on cm.company_id = c.id
left join clients cli on cli.company_id = c.id
left join cost_estimates ce on ce.company_id = c.id
left join invoices inv on inv.company_id = c.id
left join projects pr on pr.company_id = c.id
group by c.id, c.name, c.plan;
