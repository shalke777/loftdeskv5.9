-- ============================================================
-- LOFTDESK — SUPABASE SCHEMA v3
-- Uruchom w: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES (extends auth.users) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  full_name   TEXT,
  company     TEXT,
  nip         TEXT,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','business')),
  ksef_token  TEXT,
  ksef_nip    TEXT,
  ksef_env    TEXT NOT NULL DEFAULT 'test' CHECK (ksef_env IN ('test','prod')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CLIENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  nip        TEXT,
  address    TEXT,
  email      TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PROJECTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  number     TEXT NOT NULL,
  name       TEXT NOT NULL,
  client_id  UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'offer' CHECK (status IN ('offer','active','done','cancelled')),
  start_date DATE,
  end_date   DATE,
  address    TEXT,
  budget     NUMERIC(14,2),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── COST ESTIMATES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_estimates (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  number      TEXT NOT NULL,
  name        TEXT NOT NULL,
  client_id   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id  UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected')),
  total_net   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_gross NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── COST ESTIMATE ITEMS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_estimate_items (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cost_estimate_id UUID REFERENCES public.cost_estimates(id) ON DELETE CASCADE NOT NULL,
  description      TEXT NOT NULL,
  unit             TEXT NOT NULL DEFAULT 'm²',
  quantity         NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INVOICES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  number      TEXT NOT NULL,
  client_id   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id  UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','overdue')),
  issue_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date    DATE,
  ksef_status TEXT CHECK (ksef_status IN ('ksef_sent','ksef_pending','ksef_error')),
  ksef_ref    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INVOICE ITEMS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id  UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'kpl',
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate    INTEGER NOT NULL DEFAULT 23,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CONTRACTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contracts (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  number     TEXT NOT NULL,
  client_id  UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'unsigned' CHECK (status IN ('unsigned','signed')),
  sign_date  DATE,
  value      NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_user      ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user     ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_client   ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_ce_user           ON public.cost_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_ce_client         ON public.cost_estimates(client_id);
CREATE INDEX IF NOT EXISTS idx_ce_project        ON public.cost_estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_cei_ce            ON public.cost_estimate_items(cost_estimate_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user     ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client   ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_contracts_user    ON public.contracts(user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles','clients','projects','cost_estimates','invoices','contracts']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_%I ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_updated_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, company, nip, plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'company', ''),
    COALESCE(NEW.raw_user_meta_data->>'nip', ''),
    'free'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY — PEŁNA IZOLACJA PER USER
-- ============================================================
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_estimates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts       ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- CLIENTS
DROP POLICY IF EXISTS "clients_all" ON public.clients;
CREATE POLICY "clients_all" ON public.clients FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PROJECTS
DROP POLICY IF EXISTS "projects_all" ON public.projects;
CREATE POLICY "projects_all" ON public.projects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- COST_ESTIMATES
DROP POLICY IF EXISTS "ce_all" ON public.cost_estimates;
CREATE POLICY "ce_all" ON public.cost_estimates FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- COST_ESTIMATE_ITEMS (dziedziczą przez JOIN)
DROP POLICY IF EXISTS "cei_select" ON public.cost_estimate_items;
DROP POLICY IF EXISTS "cei_insert" ON public.cost_estimate_items;
DROP POLICY IF EXISTS "cei_update" ON public.cost_estimate_items;
DROP POLICY IF EXISTS "cei_delete" ON public.cost_estimate_items;
CREATE POLICY "cei_select" ON public.cost_estimate_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND ce.user_id = auth.uid()));
CREATE POLICY "cei_insert" ON public.cost_estimate_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND ce.user_id = auth.uid()));
CREATE POLICY "cei_update" ON public.cost_estimate_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND ce.user_id = auth.uid()));
CREATE POLICY "cei_delete" ON public.cost_estimate_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND ce.user_id = auth.uid()));

-- INVOICES
DROP POLICY IF EXISTS "invoices_all" ON public.invoices;
CREATE POLICY "invoices_all" ON public.invoices FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- INVOICE_ITEMS
DROP POLICY IF EXISTS "ii_select" ON public.invoice_items;
DROP POLICY IF EXISTS "ii_insert" ON public.invoice_items;
DROP POLICY IF EXISTS "ii_update" ON public.invoice_items;
DROP POLICY IF EXISTS "ii_delete" ON public.invoice_items;
CREATE POLICY "ii_select" ON public.invoice_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));
CREATE POLICY "ii_insert" ON public.invoice_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));
CREATE POLICY "ii_update" ON public.invoice_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));
CREATE POLICY "ii_delete" ON public.invoice_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));

-- CONTRACTS
DROP POLICY IF EXISTS "contracts_all" ON public.contracts;
CREATE POLICY "contracts_all" ON public.contracts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- HELPER VIEW — liczniki na dashboard
-- ============================================================
CREATE OR REPLACE VIEW public.user_stats AS
SELECT
  auth.uid() AS user_id,
  (SELECT COUNT(*) FROM public.clients       WHERE user_id = auth.uid()) AS clients_count,
  (SELECT COUNT(*) FROM public.projects      WHERE user_id = auth.uid()) AS projects_count,
  (SELECT COUNT(*) FROM public.cost_estimates WHERE user_id = auth.uid()) AS ce_count,
  (SELECT COUNT(*) FROM public.invoices      WHERE user_id = auth.uid()) AS invoices_count,
  (SELECT COALESCE(SUM(total_gross),0) FROM public.cost_estimates WHERE user_id = auth.uid()) AS ce_total_gross,
  (SELECT COALESCE(SUM(i.quantity * i.unit_price),0) FROM public.invoice_items i JOIN public.invoices inv ON inv.id = i.invoice_id WHERE inv.user_id = auth.uid() AND inv.status = 'paid') AS revenue_paid,
  (SELECT COALESCE(SUM(i.quantity * i.unit_price),0) FROM public.invoice_items i JOIN public.invoices inv ON inv.id = i.invoice_id WHERE inv.user_id = auth.uid() AND inv.status = 'unpaid') AS revenue_unpaid;

-- ============================================================
-- PLAN LIMITS ENFORCEMENT FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_plan_limit(p_user_id UUID, p_table TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan TEXT; v_count INT; v_limit INT;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;
  IF v_plan IN ('pro','business') THEN RETURN TRUE; END IF;
  -- Free plan limits
  EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE user_id = $1', p_table) INTO v_count USING p_user_id;
  v_limit := CASE p_table
    WHEN 'invoices'       THEN 5
    WHEN 'contracts'      THEN 3
    WHEN 'clients'        THEN 10
    WHEN 'projects'       THEN 3
    WHEN 'cost_estimates' THEN 5
    ELSE 9999
  END;
  RETURN v_count < v_limit;
END;
$$;

-- ============================================================
-- DONE ✓
-- ============================================================
