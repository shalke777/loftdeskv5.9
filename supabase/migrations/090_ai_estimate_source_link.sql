-- =============================================================================
-- 090_ai_estimate_source_link.sql
-- =============================================================================
-- Adds ai_source_run_id to cost_estimates — records which AI analysis run
-- produced this estimate draft.  Nullable — existing estimates are unaffected.
-- Used for the Sprint 4 AI → Estimate draft bridge.
-- =============================================================================

ALTER TABLE public.cost_estimates
  ADD COLUMN IF NOT EXISTS ai_source_run_id UUID
    REFERENCES public.ai_analysis_runs(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cost_estimates_ai_source_run_id_idx
  ON public.cost_estimates (ai_source_run_id)
  WHERE ai_source_run_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
