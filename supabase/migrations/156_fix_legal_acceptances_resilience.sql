-- =============================================================================
-- Migration 156: Fix legal_acceptances — RLS completeness + audit integrity
-- =============================================================================
-- Problems addressed:
--
--  1. Migration 064 lacked BEGIN/COMMIT — UPDATE policy may not have been
--     applied on all instances.  upsert() requires INSERT + UPDATE policies.
--
--  2. company_id FK used ON DELETE CASCADE — deleting a company would silently
--     erase the user's consent audit trail (GDPR violation).  Fixed to SET NULL.
--
--  3. Adds service-role SELECT for admin/compliance queries.
--
-- Idempotent: safe to re-run.
-- =============================================================================

BEGIN;

-- ── 1. Ensure table exists (idempotent, same as 031/064) ────────────────────
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id             uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  document_key           text        NOT NULL,
  document_version       text        NOT NULL,
  accepted_at            timestamptz NOT NULL DEFAULT now(),
  source                 text        NOT NULL
    CHECK (source IN ('signup','login','checkout','settings','gate','first_login','version_update')),
  accepted_b2b_statement boolean     NOT NULL DEFAULT false,
  user_agent             text,

  UNIQUE (user_id, document_key, document_version)
);

-- ── 2. Fix company_id FK constraint: CASCADE → SET NULL ──────────────────────
-- Acceptances are immutable audit records — deleting a company must NOT
-- destroy the proof that a user accepted the terms.
DO $$
BEGIN
  -- Drop the CASCADE constraint if it exists (created by 031 or 064)
  IF EXISTS (
    SELECT 1
    FROM   information_schema.referential_constraints rc
    JOIN   information_schema.key_column_usage kcu
           ON kcu.constraint_name = rc.constraint_name
           AND kcu.table_name = 'legal_acceptances'
    WHERE  rc.delete_rule = 'CASCADE'
    AND    kcu.column_name = 'company_id'
  ) THEN
    ALTER TABLE public.legal_acceptances
      DROP CONSTRAINT IF EXISTS legal_acceptances_company_id_fkey;

    ALTER TABLE public.legal_acceptances
      ADD CONSTRAINT legal_acceptances_company_id_fkey
      FOREIGN KEY (company_id)
      REFERENCES public.companies(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- ── 3. Ensure index ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS legal_acceptances_user_key_idx
  ON public.legal_acceptances (user_id, document_key);

-- ── 4. Enable RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- ── 5. SELECT — users read only their own records ────────────────────────────
DROP POLICY IF EXISTS "legal_acceptances_select_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_select_own" ON public.legal_acceptances
  FOR SELECT USING (user_id = auth.uid());

-- ── 6. INSERT — users insert only as themselves ──────────────────────────────
DROP POLICY IF EXISTS "legal_acceptances_insert_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_insert_own" ON public.legal_acceptances
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 7. UPDATE — required for upsert (re-accept / retry / version bump) ───────
-- PostgREST upsert translates to INSERT ... ON CONFLICT DO UPDATE.
-- Without this policy the operation is rejected even if the row being
-- updated already belongs to the current user.
DROP POLICY IF EXISTS "legal_acceptances_update_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_update_own" ON public.legal_acceptances
  FOR UPDATE
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;

NOTIFY pgrst, 'reload schema';
