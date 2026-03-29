-- v4.7 full-domain RLS coverage for company-first mode

alter table if exists public.projects enable row level security;
alter table if exists public.invoices enable row level security;
alter table if exists public.contracts enable row level security;
alter table if exists public.audit_logs enable row level security;
alter table if exists public.client_tokens enable row level security;
alter table if exists public.portal_messages enable row level security;
alter table if exists public.invoice_items enable row level security;
alter table if exists public.cost_estimate_items enable row level security;

-- ─── projects ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "projects_select" ON public.projects;
    CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (company_id = my_company_id());
    DROP POLICY IF EXISTS "projects_insert" ON public.projects;
    CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));
    DROP POLICY IF EXISTS "projects_update" ON public.projects;
    CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));
    DROP POLICY IF EXISTS "projects_delete" ON public.projects;
    CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (company_id = my_company_id() AND my_role() IN ('owner','admin'));
  END IF;
END
$$;

-- ─── invoices ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
    CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING (company_id = my_company_id());
    DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
    CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager','accountant'));
    DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
    CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager','accountant'));
    DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
    CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE USING (company_id = my_company_id() AND my_role() IN ('owner','admin'));
  END IF;
END
$$;

-- ─── contracts ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.contracts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
    CREATE POLICY "contracts_select" ON public.contracts FOR SELECT USING (company_id = my_company_id());
    DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
    CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));
    DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
    CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));
    DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
    CREATE POLICY "contracts_delete" ON public.contracts FOR DELETE USING (company_id = my_company_id() AND my_role() IN ('owner','admin'));
  END IF;
END
$$;

-- ─── audit_logs — guaranteed by 003 ──────────────────────────────────────────
drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs for select using (company_id = my_company_id());

-- ─── client_tokens — guaranteed by 004 ───────────────────────────────────────
drop policy if exists "client_tokens_select" on public.client_tokens;
create policy "client_tokens_select" on public.client_tokens for select using (company_id = my_company_id());
drop policy if exists "client_tokens_insert" on public.client_tokens;
create policy "client_tokens_insert" on public.client_tokens for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));
drop policy if exists "client_tokens_update" on public.client_tokens;
create policy "client_tokens_update" on public.client_tokens for update using (company_id = my_company_id()) with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

-- ─── portal_messages — guaranteed by 004 ─────────────────────────────────────
drop policy if exists "portal_messages_select" on public.portal_messages;
create policy "portal_messages_select" on public.portal_messages
for select using (exists (select 1 from public.client_tokens ct where ct.id = token_id and ct.company_id = my_company_id()));
drop policy if exists "portal_messages_insert_company" on public.portal_messages;
create policy "portal_messages_insert_company" on public.portal_messages
for insert with check (exists (select 1 from public.client_tokens ct where ct.id = token_id and ct.company_id = my_company_id()) and my_role() in ('owner','admin','manager'));

-- ─── invoice_items ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.invoice_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "invoice_items_select" ON public.invoice_items;
    CREATE POLICY "invoice_items_select" ON public.invoice_items
      FOR SELECT USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.company_id = my_company_id()));
    DROP POLICY IF EXISTS "invoice_items_insert" ON public.invoice_items;
    CREATE POLICY "invoice_items_insert" ON public.invoice_items
      FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.company_id = my_company_id() AND my_role() IN ('owner','admin','manager','accountant')));
    DROP POLICY IF EXISTS "invoice_items_update" ON public.invoice_items;
    CREATE POLICY "invoice_items_update" ON public.invoice_items
      FOR UPDATE USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.company_id = my_company_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.company_id = my_company_id() AND my_role() IN ('owner','admin','manager','accountant')));
    DROP POLICY IF EXISTS "invoice_items_delete" ON public.invoice_items;
    CREATE POLICY "invoice_items_delete" ON public.invoice_items
      FOR DELETE USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.company_id = my_company_id() AND my_role() IN ('owner','admin')));
  END IF;
END
$$;

-- ─── cost_estimate_items ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.cost_estimate_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "cost_estimate_items_select_v47" ON public.cost_estimate_items;
    CREATE POLICY "cost_estimate_items_select_v47" ON public.cost_estimate_items
      FOR SELECT USING (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND ce.company_id = my_company_id()));
    DROP POLICY IF EXISTS "cost_estimate_items_insert_v47" ON public.cost_estimate_items;
    CREATE POLICY "cost_estimate_items_insert_v47" ON public.cost_estimate_items
      FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND ce.company_id = my_company_id() AND my_role() IN ('owner','admin','manager')));
    DROP POLICY IF EXISTS "cost_estimate_items_update_v47" ON public.cost_estimate_items;
    CREATE POLICY "cost_estimate_items_update_v47" ON public.cost_estimate_items
      FOR UPDATE USING (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND ce.company_id = my_company_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND ce.company_id = my_company_id() AND my_role() IN ('owner','admin','manager')));
    DROP POLICY IF EXISTS "cost_estimate_items_delete_v47" ON public.cost_estimate_items;
    CREATE POLICY "cost_estimate_items_delete_v47" ON public.cost_estimate_items
      FOR DELETE USING (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND ce.company_id = my_company_id() AND my_role() IN ('owner','admin')));
  END IF;
END
$$;
