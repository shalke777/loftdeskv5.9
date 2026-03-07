alter table if exists companies enable row level security;
alter table if exists company_members enable row level security;
alter table if exists clients enable row level security;
alter table if exists cost_estimates enable row level security;

drop policy if exists "companies_select" on companies;
create policy "companies_select" on companies
  for select using (id = my_company_id());

drop policy if exists "members_select" on company_members;
create policy "members_select" on company_members
  for select using (company_id = my_company_id());

drop policy if exists "clients_select" on clients;
create policy "clients_select" on clients
  for select using (company_id = my_company_id());

drop policy if exists "clients_insert" on clients;
create policy "clients_insert" on clients
  for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

drop policy if exists "clients_update" on clients;
create policy "clients_update" on clients
  for update using (company_id = my_company_id())
  with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

drop policy if exists "clients_delete" on clients;
create policy "clients_delete" on clients
  for delete using (company_id = my_company_id() and my_role() in ('owner','admin'));

drop policy if exists "estimates_select" on cost_estimates;
create policy "estimates_select" on cost_estimates
  for select using (company_id = my_company_id());

drop policy if exists "estimates_insert" on cost_estimates;
create policy "estimates_insert" on cost_estimates
  for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

drop policy if exists "estimates_update" on cost_estimates;
create policy "estimates_update" on cost_estimates
  for update using (company_id = my_company_id())
  with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

drop policy if exists "estimates_delete" on cost_estimates;
create policy "estimates_delete" on cost_estimates
  for delete using (company_id = my_company_id() and my_role() in ('owner','admin'));
