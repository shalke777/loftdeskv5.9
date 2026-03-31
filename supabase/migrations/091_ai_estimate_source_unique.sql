-- =============================================================================
-- 091_ai_estimate_source_unique.sql
-- =============================================================================
-- Enforces one-estimate-per-AI-run at the database level.
-- This is the single source of truth for duplicate prevention.
-- The UI guard in AiRunReviewPanel is a secondary safeguard only.
--
-- Rationale: a session-level state variable is insufficient because the same
-- operator can open the review panel in a second browser tab or after a hard
-- refresh and trigger a second INSERT before the first one is visible in the UI.
-- The partial unique index makes the DB reject any duplicate with a 23505 error
-- (unique_violation), which the mutation handler surface to the user as a friendly
-- message.
--
-- ON DELETE SET NULL on ai_source_run_id (migration 090) means deleting a run
-- does NOT delete the estimate — it just nulls the link, so the constraint stays
-- safe.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uidx_cost_estimates_ai_source_run_id
  ON public.cost_estimates (ai_source_run_id)
  WHERE ai_source_run_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
