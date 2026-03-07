-- v4.7 full-domain RLS coverage for company-first mode

alter table if exists public.projects enable row level security;
alter table if exists public.invoices enable row level security;
alter table if exists public.contracts enable row level security;
alter table if exists public.audit_logs enable row level security;
alter table if exists public.client_tokens enable row level security;
alter table if exists public.portal_messages enable row level security;
alter table if exists public.invoice_items enable row level security;
alter table if exists public.cost_estimate_items enable row level security;

drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects for select using (company_id = my_company_id());
drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));
drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects for update using (company_id = my_company_id()) with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));
drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete" on public.projects for delete using (company_id = my_company_id() and my_role() in ('owner','admin'));

drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select" on public.invoices for select using (company_id = my_company_id());
drop policy if exists "invoices_insert" on public.invoices;
create policy "invoices_insert" on public.invoices for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager','accountant'));
drop policy if exists "invoices_update" on public.invoices;
create policy "invoices_update" on public.invoices for update using (company_id = my_company_id()) with check (company_id = my_company_id() and my_role() in ('owner','admin','manager','accountant'));
drop policy if exists "invoices_delete" on public.invoices;
create policy "invoices_delete" on public.invoices for delete using (company_id = my_company_id() and my_role() in ('owner','admin'));

drop policy if exists "contracts_select" on public.contracts;
create policy "contracts_select" on public.contracts for select using (company_id = my_company_id());
drop policy if exists "contracts_insert" on public.contracts;
create policy "contracts_insert" on public.contracts for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));
drop policy if exists "contracts_update" on public.contracts;
create policy "contracts_update" on public.contracts for update using (company_id = my_company_id()) with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));
drop policy if exists "contracts_delete" on public.contracts;
create policy "contracts_delete" on public.contracts for delete using (company_id = my_company_id() and my_role() in ('owner','admin'));

drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs for select using (company_id = my_company_id());

drop policy if exists "client_tokens_select" on public.client_tokens;
create policy "client_tokens_select" on public.client_tokens for select using (company_id = my_company_id());
drop policy if exists "client_tokens_insert" on public.client_tokens;
create policy "client_tokens_insert" on public.client_tokens for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));
drop policy if exists "client_tokens_update" on public.client_tokens;
create policy "client_tokens_update" on public.client_tokens for update using (company_id = my_company_id()) with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

drop policy if exists "portal_messages_select" on public.portal_messages;
create policy "portal_messages_select" on public.portal_messages
for select using (exists (select 1 from public.client_tokens ct where ct.id = token_id and ct.company_id = my_company_id()));
drop policy if exists "portal_messages_insert_company" on public.portal_messages;
create policy "portal_messages_insert_company" on public.portal_messages
for insert with check (exists (select 1 from public.client_tokens ct where ct.id = token_id and ct.company_id = my_company_id()) and my_role() in ('owner','admin','manager'));

drop policy if exists "invoice_items_select" on public.invoice_items;
create policy "invoice_items_select" on public.invoice_items
for select using (exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = my_company_id()));
drop policy if exists "invoice_items_insert" on public.invoice_items;
create policy "invoice_items_insert" on public.invoice_items
for insert with check (exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = my_company_id() and my_role() in ('owner','admin','manager','accountant')));
drop policy if exists "invoice_items_update" on public.invoice_items;
create policy "invoice_items_update" on public.invoice_items
for update using (exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = my_company_id())) with check (exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = my_company_id() and my_role() in ('owner','admin','manager','accountant')));
drop policy if exists "invoice_items_delete" on public.invoice_items;
create policy "invoice_items_delete" on public.invoice_items
for delete using (exists (select 1 from public.invoices i where i.id = invoice_id and i.company_id = my_company_id() and my_role() in ('owner','admin')));

drop policy if exists "cost_estimate_items_select_v47" on public.cost_estimate_items;
create policy "cost_estimate_items_select_v47" on public.cost_estimate_items
for select using (exists (select 1 from public.cost_estimates ce where ce.id = cost_estimate_id and ce.company_id = my_company_id()));
drop policy if exists "cost_estimate_items_insert_v47" on public.cost_estimate_items;
create policy "cost_estimate_items_insert_v47" on public.cost_estimate_items
for insert with check (exists (select 1 from public.cost_estimates ce where ce.id = cost_estimate_id and ce.company_id = my_company_id() and my_role() in ('owner','admin','manager')));
drop policy if exists "cost_estimate_items_update_v47" on public.cost_estimate_items;
create policy "cost_estimate_items_update_v47" on public.cost_estimate_items
for update using (exists (select 1 from public.cost_estimates ce where ce.id = cost_estimate_id and ce.company_id = my_company_id())) with check (exists (select 1 from public.cost_estimates ce where ce.id = cost_estimate_id and ce.company_id = my_company_id() and my_role() in ('owner','admin','manager')));
drop policy if exists "cost_estimate_items_delete_v47" on public.cost_estimate_items;
create policy "cost_estimate_items_delete_v47" on public.cost_estimate_items
for delete using (exists (select 1 from public.cost_estimates ce where ce.id = cost_estimate_id and ce.company_id = my_company_id() and my_role() in ('owner','admin')));
