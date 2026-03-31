-- Migration 085: ai_scope_items — persisted scope items from an ai_analysis_runs record
-- Denormalised with company_id + project_id for efficient RLS queries.
-- Operators can update review_status. No DELETE policy — soft-reject via review_status.

CREATE TABLE IF NOT EXISTS public.ai_scope_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           UUID        NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
  company_id       UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Item description
  library_id       TEXT,                         -- matching bathroom library key (nullable)
  title            TEXT,                         -- short display label
  description      TEXT        NOT NULL,
  category         TEXT        NOT NULL,

  -- Quantities and pricing
  unit             TEXT,
  quantity_suggested NUMERIC(10, 3),
  price_suggested_by_ai NUMERIC(12, 2),         -- always null from AI (reserved for future)

  -- Confidence and ordering
  confidence       NUMERIC(5, 2),
  sort_order       INT         NOT NULL DEFAULT 0,

  -- Source classification
  source_kind      TEXT
                   CHECK (source_kind IN (
                     'direct_detected',
                     'dependency_inferred',
                     'confirmation_needed'
                   )),
  scope_layer      TEXT
                   CHECK (scope_layer IN (
                     'EXECUTION_SCOPE',
                     'HIDDEN_PROBABLE_SCOPE'
                   )),

  -- Operator review
  review_status    TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (review_status IN (
                                 'pending',
                                 'accepted',
                                 'modified',
                                 'rejected'
                               )),
  quantity_final               NUMERIC(10, 3),
  price_confirmed_by_operator  NUMERIC(12, 2),
  missing_price                BOOLEAN NOT NULL DEFAULT false,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS ai_scope_items_run_id_idx
  ON public.ai_scope_items (run_id);

CREATE INDEX IF NOT EXISTS ai_scope_items_company_project_idx
  ON public.ai_scope_items (company_id, project_id);

-- RLS
ALTER TABLE public.ai_scope_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_scope_items_select"
  ON public.ai_scope_items FOR SELECT
  USING (company_id = my_company_id());

CREATE POLICY "ai_scope_items_insert"
  ON public.ai_scope_items FOR INSERT
  WITH CHECK (company_id = my_company_id());

-- Operators can update review decisions on their own company's items
CREATE POLICY "ai_scope_items_update"
  ON public.ai_scope_items FOR UPDATE
  USING (company_id = my_company_id())
  WITH CHECK (company_id = my_company_id());

NOTIFY pgrst, 'reload schema';
