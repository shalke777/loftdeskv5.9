-- =============================================================================
-- 093_ai_analysis_bundles.sql
-- =============================================================================
-- Composite Project Analysis — P1 Foundation
-- A bundle is a collection of assets submitted together for project-level
-- analysis. Bundles are higher-level than P0 ai_analysis_runs (which are
-- single-session, single-room). A bundle can contain PDFs, photos, renders,
-- text notes and is not scoped to a single room type.
--
-- Design rules:
--   - ADDITIVE ONLY — zero changes to 083-092 tables
--   - ai_analysis_runs (P0) remain frozen and untouched
--   - A bundle may optionally reference a P0 run (run_id nullable) for bridge
--   - company_id always derived from JWT, never from payload
--   - RLS mandatory
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_analysis_bundles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id    uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by    uuid        NOT NULL REFERENCES auth.users(id),

  -- Human-readable label (optional, operator-assigned)
  label         text,

  -- Lifecycle
  -- pending      → assets uploaded, not yet submitted for extraction
  -- processing   → extraction in progress
  -- partial      → some assets extracted, some failed/pending
  -- ready        → all assets extracted, bundle ready for fusion
  -- failed       → unrecoverable error
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'partial', 'ready', 'failed')),

  -- Summary counters (denormalized for fast reads — updated by service role)
  asset_count       integer NOT NULL DEFAULT 0,
  extracted_count   integer NOT NULL DEFAULT 0,
  failed_count      integer NOT NULL DEFAULT 0,

  -- Global confidence across all extracted assets (0.00–1.00)
  -- Null until at least one extraction completes
  confidence_summary numeric(4, 2),

  -- Marks whether this bundle has missing critical data
  missing_data  boolean     NOT NULL DEFAULT false,

  -- Error summary (when status = 'failed')
  error_message text,

  -- Lifecycle timestamps
  submitted_at  timestamptz,
  completed_at  timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.ai_analysis_bundles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_analysis_bundles_updated_at
  BEFORE UPDATE ON public.ai_analysis_bundles
  FOR EACH ROW EXECUTE FUNCTION public.ai_analysis_bundles_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS ai_analysis_bundles_company_id_idx
  ON public.ai_analysis_bundles (company_id);

CREATE INDEX IF NOT EXISTS ai_analysis_bundles_project_id_idx
  ON public.ai_analysis_bundles (project_id);

CREATE INDEX IF NOT EXISTS ai_analysis_bundles_company_created_idx
  ON public.ai_analysis_bundles (company_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_analysis_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_analysis_bundles_select"
  ON public.ai_analysis_bundles FOR SELECT
  USING (company_id = my_company_id());

CREATE POLICY "ai_analysis_bundles_insert"
  ON public.ai_analysis_bundles FOR INSERT
  WITH CHECK (company_id = my_company_id());

-- Status/counter updates done by service role (bypasses RLS)

NOTIFY pgrst, 'reload schema';
