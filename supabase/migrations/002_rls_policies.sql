-- ─── companies + company_members — guaranteed by 001_multi_tenant ────────────

alter table if exists companies enable row level security;
alter table if exists company_members enable row level security;

drop policy if exists "companies_select" on companies;
create policy "companies_select" on companies
  for select using (id = my_company_id());

drop policy if exists "members_select" on company_members;
create policy "members_select" on company_members
  for select using (company_id = my_company_id());

-- ─── clients — may not exist on fresh bootstrap ───────────────────────────────

alter table if exists clients enable row level security;

DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    DROP POLICY IF EXISTS "clients_select" ON clients;
    CREATE POLICY "clients_select" ON clients
      FOR SELECT USING (company_id = my_company_id());

    DROP POLICY IF EXISTS "clients_insert" ON clients;
    CREATE POLICY "clients_insert" ON clients
      FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));

    DROP POLICY IF EXISTS "clients_update" ON clients;
    CREATE POLICY "clients_update" ON clients
      FOR UPDATE USING (company_id = my_company_id())
      WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));

    DROP POLICY IF EXISTS "clients_delete" ON clients;
    CREATE POLICY "clients_delete" ON clients
      FOR DELETE USING (company_id = my_company_id() AND my_role() IN ('owner','admin'));
  END IF;
END
$$;

-- ─── cost_estimates — may not exist on fresh bootstrap ───────────────────────

alter table if exists cost_estimates enable row level security;

DO $$
BEGIN
  IF to_regclass('public.cost_estimates') IS NOT NULL THEN
    DROP POLICY IF EXISTS "estimates_select" ON cost_estimates;
    CREATE POLICY "estimates_select" ON cost_estimates
      FOR SELECT USING (company_id = my_company_id());

    DROP POLICY IF EXISTS "estimates_insert" ON cost_estimates;
    CREATE POLICY "estimates_insert" ON cost_estimates
      FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));

    DROP POLICY IF EXISTS "estimates_update" ON cost_estimates;
    CREATE POLICY "estimates_update" ON cost_estimates
      FOR UPDATE USING (company_id = my_company_id())
      WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));

    DROP POLICY IF EXISTS "estimates_delete" ON cost_estimates;
    CREATE POLICY "estimates_delete" ON cost_estimates
      FOR DELETE USING (company_id = my_company_id() AND my_role() IN ('owner','admin'));
  END IF;
END
$$;
