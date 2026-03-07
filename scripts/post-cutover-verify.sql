-- Weryfikacja po cutover v3 -> v4
begin;

select now() as verification_started_at;
select count(*) filter (where company_id is null) as profiles_without_company from profiles;
select count(*) filter (where company_id is null) as clients_without_company from clients;
select count(*) filter (where company_id is null) as estimates_without_company from cost_estimates;
select count(*) filter (where company_id is null) as invoices_without_company from invoices;
select count(*) filter (where company_id is null) as contracts_without_company from contracts;
select count(*) filter (where company_id is null) as projects_without_company from projects;

select company_id, count(*) as members from company_members group by company_id order by members desc;
select status, count(*) from company_invitations group by status order by status;
select active, count(*) from client_portal_tokens group by active order by active desc;

commit;
