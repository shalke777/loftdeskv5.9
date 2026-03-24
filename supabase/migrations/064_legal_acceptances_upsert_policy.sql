-- =============================================================================
-- Migration 064: Ensure legal_acceptances table + complete RLS policies
--
-- Migration 031 defined this table but was never applied to production.
-- This migration is idempotent: creates the table IF NOT EXISTS, then
-- ensures all three policies (SELECT, INSERT, UPDATE) are present.
--
-- The UPDATE policy is required because the frontend uses .upsert() with
-- onConflict: 'user_id,document_key,document_version'. PostgREST needs
-- both INSERT and UPDATE policies for upsert operations.
-- =============================================================================

-- ── 1. Create table if missing ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id             uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  document_key           text        NOT NULL,
  document_version       text        NOT NULL,
  accepted_at            timestamptz NOT NULL DEFAULT now(),
  source                 text        NOT NULL
    CHECK (source IN ('signup','login','checkout','settings','gate','first_login','version_update')),
  accepted_b2b_statement boolean     NOT NULL DEFAULT false,
  user_agent             text,

  UNIQUE (user_id, document_key, document_version)
);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_key_idx
  ON public.legal_acceptances (user_id, document_key);

-- ── 2. Enable RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- ── 3. SELECT — users read only their own records ───────────────────────────
DROP POLICY IF EXISTS "legal_acceptances_select_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_select_own" ON public.legal_acceptances
  FOR SELECT USING (user_id = auth.uid());

-- ── 4. INSERT — users insert only as themselves ─────────────────────────────
DROP POLICY IF EXISTS "legal_acceptances_insert_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_insert_own" ON public.legal_acceptances
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 5. UPDATE — needed for upsert path (re-accept / retry) ─────────────────
DROP POLICY IF EXISTS "legal_acceptances_update_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_update_own" ON public.legal_acceptances
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
