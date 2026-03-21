-- =============================================================================
-- Migration 056: Reconcile contracts.project_id (repo/production schema drift)
-- =============================================================================
-- HISTORY:
--   contracts.project_id was added directly in production outside the repo
--   migration chain. This migration reconciles the drift so that fresh installs
--   and staging environments match production.
--
-- What this does:
--   1. ADD COLUMN IF NOT EXISTS — no-op on production, fixes fresh installs
--   2. Index IF NOT EXISTS — idempotent
--   3. Backfill project_id from cost_estimates where currently NULL
--
-- Safety:
--   - Every statement uses IF NOT EXISTS or a WHERE NULL guard
--   - No data is deleted or modified destructively
--   - Safe to run on production (all steps are no-ops or pure additions)
-- =============================================================================

-- ── 1. Column ─────────────────────────────────────────────────────────────────
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS project_id uuid
    REFERENCES public.projects(id)
    ON DELETE SET NULL;

-- ── 2. Index ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS contracts_project_id_idx
  ON public.contracts (project_id)
  WHERE project_id IS NOT NULL;

-- ── 3. Backfill from estimate chain ───────────────────────────────────────────
-- Fills project_id on contracts that have estimate_id pointing to an estimate
-- that already has project_id set. Only touches rows where project_id IS NULL.
-- Idempotent: re-running produces no additional changes.
UPDATE public.contracts c
SET    project_id = ce.project_id
FROM   public.cost_estimates ce
WHERE  c.estimate_id  = ce.id
  AND  ce.project_id  IS NOT NULL
  AND  c.project_id   IS NULL;
