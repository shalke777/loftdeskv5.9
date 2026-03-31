-- Migration 088: company_memory_feedback — collect-only feedback for future AI tuning
-- No auto-application logic. INSERT + SELECT only.
-- Tracks when operators override AI suggestions so patterns can be reviewed later.

CREATE TABLE IF NOT EXISTS public.company_memory_feedback (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  run_id           UUID        REFERENCES public.ai_analysis_runs(id) ON DELETE SET NULL,

  -- What kind of feedback event this is
  feedback_type    TEXT        NOT NULL DEFAULT 'scope_override'
                               CHECK (feedback_type IN (
                                 'scope_override',          -- operator changed quantity/scope
                                 'price_added',             -- operator filled in a price AI had null
                                 'item_rejected',           -- operator rejected an AI item entirely
                                 'item_added',              -- operator added an item AI missed
                                 'question_answered',       -- operator answered a structured question
                                 'risk_acknowledged'        -- operator acknowledged a risk
                               )),

  -- Full payload of the feedback event for later analysis
  feedback_payload JSONB       NOT NULL DEFAULT '{}',

  created_by       UUID        NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS company_memory_feedback_company_id_idx
  ON public.company_memory_feedback (company_id);

CREATE INDEX IF NOT EXISTS company_memory_feedback_run_id_idx
  ON public.company_memory_feedback (run_id);

-- RLS: INSERT + SELECT only — no UPDATE, no DELETE.
ALTER TABLE public.company_memory_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_memory_feedback_select"
  ON public.company_memory_feedback FOR SELECT
  USING (company_id = my_company_id());

CREATE POLICY "company_memory_feedback_insert"
  ON public.company_memory_feedback FOR INSERT
  WITH CHECK (company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
