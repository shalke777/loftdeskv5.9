-- =============================================================================
-- Migration 057: Widen con_client_select to use direct contracts.project_id
-- =============================================================================
-- PROBLEM:
--   Migration 042 policy "con_client_select" exposes contracts to clients only
--   via the estimate chain:
--     contracts.estimate_id → cost_estimates.id → cost_estimates.project_id
--
--   This means contracts created without an estimate (direct contracts), or
--   contracts where estimate_id = NULL, are invisible to the client even when
--   contracts.project_id is correctly set.
--
-- FIX:
--   Add a direct project_id path as the primary check.
--   Preserve the existing estimate chain as a fallback for old rows where
--   project_id is still NULL (pre-056-backfill rows or intentionally unlinked).
--
-- VERIFICATION before running:
--   Confirm production "con_client_select" still only has the estimate chain:
--     SELECT policyname, qual
--     FROM pg_catalog.pg_policies
--     WHERE schemaname = 'public' AND tablename = 'contracts';
--
--   If the policy already contains "project_id IN (SELECT my_client_project_ids())"
--   this migration is a no-op reapplication — still safe to run.
--
-- SAFETY:
--   - DROP POLICY IF EXISTS is idempotent
--   - The recreated policy is strictly additive (OR — more permissive, not less)
--   - No existing client access is revoked
-- =============================================================================

DROP POLICY IF EXISTS "con_client_select" ON public.contracts;

CREATE POLICY "con_client_select" ON public.contracts
  FOR SELECT USING (
    -- Direct path: contract.project_id is assigned and client has access to it
    (
      project_id IS NOT NULL
      AND project_id IN (SELECT my_client_project_ids())
    )
    OR
    -- Legacy path: contract linked via estimate → cost_estimates.project_id
    -- Covers old rows where project_id is still NULL but estimate_id is set
    EXISTS (
      SELECT 1 FROM public.cost_estimates ce
      WHERE ce.id        = estimate_id
        AND ce.project_id IN (SELECT my_client_project_ids())
    )
  );
