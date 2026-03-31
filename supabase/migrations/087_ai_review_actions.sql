-- Migration 087: ai_review_actions — immutable audit log of operator review decisions
-- INSERT + SELECT only. No UPDATE, no DELETE policies — by design.
-- Records every accept / modify / reject action on scope items, questions, risks.

CREATE TABLE IF NOT EXISTS public.ai_review_actions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_id           UUID        NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,

  -- Target: exactly one of these will be set
  scope_item_id    UUID        REFERENCES public.ai_scope_items(id),
  question_id      UUID        REFERENCES public.ai_questions(id),
  risk_id          UUID        REFERENCES public.ai_risks(id),

  action_type      TEXT        NOT NULL
                               CHECK (action_type IN (
                                 -- scope item review actions
                                 'accepted', 'modified', 'rejected',
                                 -- question review actions
                                 'answered',
                                 -- risk review actions
                                 'acknowledged', 'resolved'
                               )),

  -- Full snapshot of the item before and after review
  original_payload JSONB       NOT NULL,
  review_payload   JSONB,
  review_reason    TEXT,

  reviewed_by      UUID        NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS ai_review_actions_run_id_idx
  ON public.ai_review_actions (run_id);

CREATE INDEX IF NOT EXISTS ai_review_actions_company_project_idx
  ON public.ai_review_actions (company_id, project_id);

-- RLS: immutable audit log — INSERT and SELECT only, no UPDATE, no DELETE.
ALTER TABLE public.ai_review_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_review_actions_select"
  ON public.ai_review_actions FOR SELECT
  USING (company_id = my_company_id());

CREATE POLICY "ai_review_actions_insert"
  ON public.ai_review_actions FOR INSERT
  WITH CHECK (company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
