-- =============================================================================
-- 109_project_jobs_token_columns.sql
-- =============================================================================
-- Sprint H: Add token count columns to project_analysis_jobs
-- so project analysis governance data is complete (matching ai_analysis_runs).
-- =============================================================================

ALTER TABLE public.project_analysis_jobs
  ADD COLUMN IF NOT EXISTS input_token_count  integer,
  ADD COLUMN IF NOT EXISTS output_token_count integer;

COMMENT ON COLUMN public.project_analysis_jobs.input_token_count
  IS 'OpenAI input token count (real from API when available, heuristic fallback)';
COMMENT ON COLUMN public.project_analysis_jobs.output_token_count
  IS 'OpenAI output token count (real from API when available, heuristic fallback)';
