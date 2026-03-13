-- =============================================================================
-- Migration 040: client_accounts + project_client_access
-- LoftDesk v6.0 — "One App / Two Roles"
-- =============================================================================
-- Klient uzyskuje STAŁE KONTO (auth.users) połączone z client_accounts.
-- Dostęp do projektów pochodzi WYŁĄCZNIE z project_client_access.
-- Token portalu to tylko zaproszenie / entry point — nie zastępuje access table.
-- =============================================================================

-- ── 1. client_accounts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_accounts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  auth_user_id     uuid                 REFERENCES auth.users(id)        ON DELETE SET NULL,
  email            text        NOT NULL,
  full_name        text,
  phone            text,
  client_record_id uuid                 REFERENCES public.clients(id)    ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- (company_id, email) para musi być unikalna
  UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_client_accounts_auth_user  ON public.client_accounts (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_client_accounts_company    ON public.client_accounts (company_id);
CREATE INDEX IF NOT EXISTS idx_client_accounts_email      ON public.client_accounts (lower(email));

ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;

-- Operator widzi konta klientów swojej firmy
DROP POLICY IF EXISTS "ca_operator_select" ON public.client_accounts;
CREATE POLICY "ca_operator_select" ON public.client_accounts
  FOR SELECT USING (company_id = my_company_id());

DROP POLICY IF EXISTS "ca_operator_insert" ON public.client_accounts;
CREATE POLICY "ca_operator_insert" ON public.client_accounts
  FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));

DROP POLICY IF EXISTS "ca_operator_update" ON public.client_accounts;
CREATE POLICY "ca_operator_update" ON public.client_accounts
  FOR UPDATE
  USING  (company_id = my_company_id())
  WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));

-- Klient widzi i aktualizuje TYLKO swój własny rekord
DROP POLICY IF EXISTS "ca_client_select_own" ON public.client_accounts;
CREATE POLICY "ca_client_select_own" ON public.client_accounts
  FOR SELECT USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "ca_client_update_own" ON public.client_accounts;
CREATE POLICY "ca_client_update_own" ON public.client_accounts
  FOR UPDATE
  USING  (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());


-- ── 2. project_client_access ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_client_access (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid        NOT NULL REFERENCES public.projects(id)        ON DELETE CASCADE,
  client_account_id uuid        NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  granted_by        uuid                 REFERENCES auth.users(id)             ON DELETE SET NULL,
  granted_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (project_id, client_account_id)
);

CREATE INDEX IF NOT EXISTS idx_pca_project ON public.project_client_access (project_id);
CREATE INDEX IF NOT EXISTS idx_pca_account ON public.project_client_access (client_account_id);

ALTER TABLE public.project_client_access ENABLE ROW LEVEL SECURITY;

-- Operator zarządza dostępem dla projektów swojej firmy
DROP POLICY IF EXISTS "pca_operator_select" ON public.project_client_access;
CREATE POLICY "pca_operator_select" ON public.project_client_access
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.company_id = my_company_id())
  );

DROP POLICY IF EXISTS "pca_operator_insert" ON public.project_client_access;
CREATE POLICY "pca_operator_insert" ON public.project_client_access
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.company_id = my_company_id())
    AND my_role() IN ('owner','admin','manager')
  );

DROP POLICY IF EXISTS "pca_operator_delete" ON public.project_client_access;
CREATE POLICY "pca_operator_delete" ON public.project_client_access
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.company_id = my_company_id())
    AND my_role() IN ('owner','admin','manager')
  );

-- Klient widzi tylko swoje wpisy dostępu
DROP POLICY IF EXISTS "pca_client_select" ON public.project_client_access;
CREATE POLICY "pca_client_select" ON public.project_client_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.client_accounts ca
      WHERE ca.id = client_account_id AND ca.auth_user_id = auth.uid()
    )
  );
