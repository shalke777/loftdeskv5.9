-- Snapshot przed cutover v3 -> v4
begin;

select now() as snapshot_started_at;
select count(*) as profiles_count from profiles;
select count(*) as companies_count from companies;
select count(*) as company_members_count from company_members;
select count(*) as clients_count from clients;
select count(*) as estimates_count from cost_estimates;
select count(*) as invoices_count from invoices;
select count(*) as contracts_count from contracts;
select count(*) as projects_count from projects;
select count(*) as portal_tokens_count from client_portal_tokens;

commit;
