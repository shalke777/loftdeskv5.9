-- =============================================================================
-- Migration 031: Legal document acceptances
-- Stores user acknowledgements of Terms, Privacy Policy, DPA, and B2B statement.
-- Unique per (user_id, document_key, document_version) — no duplicate rows for the
-- same version; a new version triggers a fresh row with a new accepted_at.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id           uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  document_key         text        NOT NULL,
  document_version     text        NOT NULL,
  accepted_at          timestamptz NOT NULL DEFAULT now(),
  source               text        NOT NULL
    CHECK (source IN ('signup','login','checkout','settings','gate')),
  accepted_b2b_statement boolean   NOT NULL DEFAULT false,
  user_agent           text,

  UNIQUE (user_id, document_key, document_version)
);

-- Index for the most common query: "has this user accepted these versions?"
CREATE INDEX IF NOT EXISTS legal_acceptances_user_key_idx
  ON public.legal_acceptances (user_id, document_key);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Users may only read their own acceptance records
DROP POLICY IF EXISTS "legal_acceptances_select_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_select_own" ON public.legal_acceptances
  FOR SELECT USING (user_id = auth.uid());

-- Users may only insert rows for themselves
DROP POLICY IF EXISTS "legal_acceptances_insert_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_insert_own" ON public.legal_acceptances
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- No update or delete — acceptances are immutable records
-- (a new version of a document produces a new row, old rows stay for audit)

COMMIT;
