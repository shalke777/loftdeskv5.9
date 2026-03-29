-- =============================================================================
-- 000_base_schema.sql — LoftDesk base schema (legacy tables)
-- =============================================================================
-- Creates the core domain tables that pre-date the numbered migration chain.
-- Must run FIRST. All statements are CREATE TABLE IF NOT EXISTS so this is
-- fully idempotent on an existing production database.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── PROFILES (extends auth.users) ─────────────────────────────────────────────
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

-- ── CLIENTS ───────────────────────────────────────────────────────────────────
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

-- ── PROJECTS ──────────────────────────────────────────────────────────────────
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

-- ── COST ESTIMATES ────────────────────────────────────────────────────────────
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

-- ── COST ESTIMATE ITEMS ───────────────────────────────────────────────────────
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

-- ── INVOICES ──────────────────────────────────────────────────────────────────
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

-- ── INVOICE ITEMS ─────────────────────────────────────────────────────────────
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

-- ── CONTRACTS ─────────────────────────────────────────────────────────────────
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

-- ── INDEXES ───────────────────────────────────────────────────────────────────
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

-- ── HANDLE_UPDATED_AT TRIGGER ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles','clients','projects','cost_estimates','invoices','contracts']
  LOOP
    EXECUTE FORMAT('DROP TRIGGER IF EXISTS trg_updated_%I ON public.%I', tbl, tbl);
    EXECUTE FORMAT('CREATE TRIGGER trg_updated_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', tbl, tbl);
  END LOOP;
END $$;

-- ── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────────────────────────
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
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
