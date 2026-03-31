-- Migration 086: ai_questions and ai_risks — structured output from ai_analysis_runs
-- Questions: operator must answer before scope is finalised.
-- Risks: flagged hazards / technical concerns. Both allow operator annotation updates.

CREATE TABLE IF NOT EXISTS public.ai_questions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           UUID        NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
  company_id       UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  text             TEXT        NOT NULL,
  severity         TEXT        NOT NULL DEFAULT 'important_for_accuracy'
                               CHECK (severity IN (
                                 'critical_for_scope',
                                 'important_for_accuracy',
                                 'optional_detail'
                               )),
  category         TEXT,
  answer_type      TEXT        NOT NULL DEFAULT 'text'
                               CHECK (answer_type IN ('text', 'yesno', 'choice', 'number')),
  options          JSONB,                        -- [{value, label}, ...] for choice type

  status           TEXT        NOT NULL DEFAULT 'unanswered'
                               CHECK (status IN ('unanswered', 'answered', 'skipped')),
  operator_answer  TEXT,

  sort_order       INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_questions_run_id_idx
  ON public.ai_questions (run_id);

CREATE INDEX IF NOT EXISTS ai_questions_company_project_idx
  ON public.ai_questions (company_id, project_id);

ALTER TABLE public.ai_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_questions_select"
  ON public.ai_questions FOR SELECT
  USING (company_id = my_company_id());

CREATE POLICY "ai_questions_insert"
  ON public.ai_questions FOR INSERT
  WITH CHECK (company_id = my_company_id());

-- Intentionally no UPDATE policy: operator answers are recorded via ai_review_actions
-- (action_type = 'answered', review_payload contains the answer).
-- ai_questions rows are immutable from the client perspective.

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_risks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           UUID        NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
  company_id       UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  title            TEXT        NOT NULL,
  description      TEXT,
  severity         TEXT        NOT NULL DEFAULT 'medium'
                               CHECK (severity IN ('high', 'medium', 'low')),
  risk_type        TEXT        NOT NULL DEFAULT 'scope'
                               CHECK (risk_type IN (
                                 'scope',
                                 'technical',
                                 'timeline',
                                 'compliance'
                               )),

  status           TEXT        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'acknowledged', 'resolved')),
  operator_notes   TEXT,

  sort_order       INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_risks_run_id_idx
  ON public.ai_risks (run_id);

CREATE INDEX IF NOT EXISTS ai_risks_company_project_idx
  ON public.ai_risks (company_id, project_id);

ALTER TABLE public.ai_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_risks_select"
  ON public.ai_risks FOR SELECT
  USING (company_id = my_company_id());

CREATE POLICY "ai_risks_insert"
  ON public.ai_risks FOR INSERT
  WITH CHECK (company_id = my_company_id());

-- Intentionally no UPDATE policy: risk acknowledgments are recorded via ai_review_actions
-- (action_type = 'acknowledged' or 'resolved', review_payload contains operator notes).
-- ai_risks rows are immutable from the client perspective.

NOTIFY pgrst, 'reload schema';
