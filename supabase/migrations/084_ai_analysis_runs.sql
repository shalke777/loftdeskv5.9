-- Migration 084: ai_analysis_runs — one row per AI analysis session
-- Tracks lifecycle: draft → processing → completed / failed
-- company_id is always derived from the operator's JWT, never from request payload.

CREATE TABLE IF NOT EXISTS public.ai_analysis_runs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by       UUID        NOT NULL REFERENCES auth.users(id),

  -- Status lifecycle
  status           TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'processing', 'completed', 'failed')),

  -- P0 scope: bathroom and wc only
  room_type        TEXT        NOT NULL
                               CHECK (room_type IN ('bathroom', 'wc')),

  -- Input capture (nullable — stored for context/replay)
  text_description TEXT,
  clarification    JSONB,
  dimensions_json  JSONB,
  notes            TEXT,

  -- Output summary
  input_summary    TEXT,         -- brief human-readable summary of what was submitted
  missing_data     BOOLEAN       NOT NULL DEFAULT false,
  confidence_summary NUMERIC(5, 2),

  -- Model tracking
  model_name       TEXT,

  -- Lifecycle timestamps
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  -- Error details (when status = 'failed')
  error_code       TEXT,
  error_message    TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.ai_analysis_runs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_analysis_runs_updated_at
  BEFORE UPDATE ON public.ai_analysis_runs
  FOR EACH ROW EXECUTE FUNCTION public.ai_analysis_runs_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS ai_analysis_runs_company_id_idx
  ON public.ai_analysis_runs (company_id);

CREATE INDEX IF NOT EXISTS ai_analysis_runs_project_id_idx
  ON public.ai_analysis_runs (project_id);

CREATE INDEX IF NOT EXISTS ai_analysis_runs_company_created_idx
  ON public.ai_analysis_runs (company_id, created_at DESC);

-- RLS: operators read and create their own company's runs.
-- Status updates are done via service role from Netlify Function.
ALTER TABLE public.ai_analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_analysis_runs_select"
  ON public.ai_analysis_runs FOR SELECT
  USING (company_id = my_company_id());

CREATE POLICY "ai_analysis_runs_insert"
  ON public.ai_analysis_runs FOR INSERT
  WITH CHECK (company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
