-- =============================================================================
-- Migration 064: Add UPDATE policy for legal_acceptances
--
-- The frontend uses .upsert() with onConflict: 'user_id,document_key,document_version'
-- to save acceptance records. PostgREST requires BOTH INSERT and UPDATE policies
-- for upsert operations. Migration 031 only created INSERT + SELECT policies,
-- which causes a 401 when the upsert hits the UPDATE code path (e.g. user
-- re-accepts, retries, or the same version is sent again).
--
-- This adds the missing UPDATE policy so the upsert works end-to-end.
-- =============================================================================

BEGIN;

-- Users may only update their own acceptance records (needed for upsert path)
DROP POLICY IF EXISTS "legal_acceptances_update_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_update_own" ON public.legal_acceptances
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
