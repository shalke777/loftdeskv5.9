-- Migration 022: Complete RLS migration to multi-tenant (company_id) for all tables
-- Migration 002 only converted clients and cost_estimates.
-- invoices, contracts, projects still had v3 user_id policies.
-- Items tables still checked parent user_id.

-- ══════════════════════════════════════════════════════════
-- INVOICES — switch from user_id to company_id
-- ══════════════════════════════════════════════════════════
drop policy if exists "invoices_all" on invoices;
drop policy if exists "invoices_select" on invoices;
drop policy if exists "invoices_insert" on invoices;
drop policy if exists "invoices_update" on invoices;
drop policy if exists "invoices_delete" on invoices;

create policy "invoices_select" on invoices
  for select using (company_id = my_company_id());

create policy "invoices_insert" on invoices
  for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

create policy "invoices_update" on invoices
  for update using (company_id = my_company_id())
  with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

create policy "invoices_delete" on invoices
  for delete using (company_id = my_company_id() and my_role() in ('owner','admin'));

-- ══════════════════════════════════════════════════════════
-- CONTRACTS — switch from user_id to company_id
-- ══════════════════════════════════════════════════════════
drop policy if exists "contracts_all" on contracts;
drop policy if exists "contracts_select" on contracts;
drop policy if exists "contracts_insert" on contracts;
drop policy if exists "contracts_update" on contracts;
drop policy if exists "contracts_delete" on contracts;

create policy "contracts_select" on contracts
  for select using (company_id = my_company_id());

create policy "contracts_insert" on contracts
  for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

create policy "contracts_update" on contracts
  for update using (company_id = my_company_id())
  with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

create policy "contracts_delete" on contracts
  for delete using (company_id = my_company_id() and my_role() in ('owner','admin'));

-- ══════════════════════════════════════════════════════════
-- PROJECTS — switch from user_id to company_id
-- ══════════════════════════════════════════════════════════
drop policy if exists "projects_all" on projects;
drop policy if exists "projects_select" on projects;
drop policy if exists "projects_insert" on projects;
drop policy if exists "projects_update" on projects;
drop policy if exists "projects_delete" on projects;

create policy "projects_select" on projects
  for select using (company_id = my_company_id());

create policy "projects_insert" on projects
  for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

create policy "projects_update" on projects
  for update using (company_id = my_company_id())
  with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

create policy "projects_delete" on projects
  for delete using (company_id = my_company_id() and my_role() in ('owner','admin'));

-- ══════════════════════════════════════════════════════════
-- COST_ESTIMATE_ITEMS — check parent's company_id instead of user_id
-- ══════════════════════════════════════════════════════════
drop policy if exists "cei_select" on cost_estimate_items;
drop policy if exists "cei_insert" on cost_estimate_items;
drop policy if exists "cei_update" on cost_estimate_items;
drop policy if exists "cei_delete" on cost_estimate_items;

create policy "cei_select" on cost_estimate_items for select
  using (exists (select 1 from cost_estimates ce where ce.id = cost_estimate_id and ce.company_id = my_company_id()));

create policy "cei_insert" on cost_estimate_items for insert
  with check (exists (select 1 from cost_estimates ce where ce.id = cost_estimate_id and ce.company_id = my_company_id()));

create policy "cei_update" on cost_estimate_items for update
  using (exists (select 1 from cost_estimates ce where ce.id = cost_estimate_id and ce.company_id = my_company_id()));

create policy "cei_delete" on cost_estimate_items for delete
  using (exists (select 1 from cost_estimates ce where ce.id = cost_estimate_id and ce.company_id = my_company_id()));

-- ══════════════════════════════════════════════════════════
-- INVOICE_ITEMS — check parent's company_id instead of user_id
-- ══════════════════════════════════════════════════════════
drop policy if exists "ii_select" on invoice_items;
drop policy if exists "ii_insert" on invoice_items;
drop policy if exists "ii_update" on invoice_items;
drop policy if exists "ii_delete" on invoice_items;

create policy "ii_select" on invoice_items for select
  using (exists (select 1 from invoices i where i.id = invoice_id and i.company_id = my_company_id()));

create policy "ii_insert" on invoice_items for insert
  with check (exists (select 1 from invoices i where i.id = invoice_id and i.company_id = my_company_id()));

create policy "ii_update" on invoice_items for update
  using (exists (select 1 from invoices i where i.id = invoice_id and i.company_id = my_company_id()));

create policy "ii_delete" on invoice_items for delete
  using (exists (select 1 from invoices i where i.id = invoice_id and i.company_id = my_company_id()));
