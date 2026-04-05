-- =============================================================================
-- 106_ai_governance_fields.sql
-- =============================================================================
-- Sprint F: Add governance columns to ai_analysis_runs and project_analysis_jobs
-- for better audit trail, cost visibility, and failure classification.
--
-- New columns on ai_analysis_runs:
--   retry_count          — how many OpenAI retries occurred (0 = first attempt)
--   timeout_occurred     — whether any request timed out
--   request_duration_ms  — total OpenAI request time (including retries)
--   parse_path           — 'text' | 'vision' | 'hybrid' — how input was processed
--   input_token_count    — estimated input tokens (from payload size)
--   output_token_count   — estimated output tokens (from response size)
--   draft_created        — whether an estimate draft was created from this run
--
-- New columns on project_analysis_jobs:
--   retry_count, timeout_occurred, request_duration_ms, parse_path
--
-- New table: ai_assistant_queries — audit log for Sprint E assistant usage
-- =============================================================================

-- ── ai_analysis_runs governance columns ─────────────────────────────────────

ALTER TABLE public.ai_analysis_runs
  ADD COLUMN IF NOT EXISTS retry_count          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timeout_occurred     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS request_duration_ms  INTEGER,
  ADD COLUMN IF NOT EXISTS parse_path           TEXT,
  ADD COLUMN IF NOT EXISTS input_token_count    INTEGER,
  ADD COLUMN IF NOT EXISTS output_token_count   INTEGER,
  ADD COLUMN IF NOT EXISTS draft_created        BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.ai_analysis_runs.retry_count         IS 'Number of OpenAI retry attempts (0 = success on first try)';
COMMENT ON COLUMN public.ai_analysis_runs.timeout_occurred    IS 'True if any OpenAI request timed out during this run';
COMMENT ON COLUMN public.ai_analysis_runs.request_duration_ms IS 'Total OpenAI API call duration in milliseconds (including retries)';
COMMENT ON COLUMN public.ai_analysis_runs.parse_path          IS 'How input was processed: text, vision, hybrid';
COMMENT ON COLUMN public.ai_analysis_runs.input_token_count   IS 'Estimated input token count (chars/4 heuristic)';
COMMENT ON COLUMN public.ai_analysis_runs.output_token_count  IS 'Estimated output token count (chars/4 heuristic)';
COMMENT ON COLUMN public.ai_analysis_runs.draft_created       IS 'Whether an estimate draft was created from this run';

-- ── project_analysis_jobs governance columns ────────────────────────────────

ALTER TABLE public.project_analysis_jobs
  ADD COLUMN IF NOT EXISTS retry_count          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timeout_occurred     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS request_duration_ms  INTEGER,
  ADD COLUMN IF NOT EXISTS parse_path           TEXT;

-- ── ai_assistant_queries — audit log for project-scoped assistant ───────────

CREATE TABLE IF NOT EXISTS public.ai_assistant_queries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_id         UUID REFERENCES public.ai_analysis_runs(id) ON DELETE SET NULL,
  user_id        UUID NOT NULL REFERENCES auth.users(id),
  question       TEXT NOT NULL,
  answer_source  TEXT NOT NULL DEFAULT 'local',  -- 'local' | 'ai'
  answer_length  INTEGER DEFAULT 0,
  model_name     TEXT,
  duration_ms    INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aaq_company_created
  ON public.ai_assistant_queries (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_aaq_run
  ON public.ai_assistant_queries (run_id);

-- RLS
ALTER TABLE public.ai_assistant_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_assistant_queries_select ON public.ai_assistant_queries
  FOR SELECT TO authenticated
  USING (company_id = my_company_id());

CREATE POLICY ai_assistant_queries_insert ON public.ai_assistant_queries
  FOR INSERT TO authenticated
  WITH CHECK (company_id = my_company_id());

GRANT SELECT, INSERT ON public.ai_assistant_queries TO authenticated;

COMMENT ON TABLE public.ai_assistant_queries IS 'Audit log for Sprint E AI assistant questions per project/run';

NOTIFY pgrst, 'reload schema';
