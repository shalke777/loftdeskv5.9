-- =============================================================================
-- 089_ai_input_assets.sql
-- =============================================================================
-- Records files uploaded to the ai-inputs bucket that were used as inputs
-- for an AI analysis run. Provides an immutable audit trail of what the
-- model received. Rows are written by the backend (service role) after
-- persist — clients can only SELECT from their company.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_input_assets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid        NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
  company_id        uuid        NOT NULL,
  project_id        uuid        NOT NULL,
  storage_path      text        NOT NULL UNIQUE,
  original_filename text        NOT NULL,
  mime_type         text        NOT NULL,
  file_size         bigint      NOT NULL,
  status            text        NOT NULL DEFAULT 'uploaded'
                                  CHECK (status IN ('uploaded', 'failed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Lookup by run
CREATE INDEX IF NOT EXISTS ai_input_assets_run_id_idx
  ON public.ai_input_assets (run_id);

-- Lookup by company + project (for future asset browser)
CREATE INDEX IF NOT EXISTS ai_input_assets_company_project_idx
  ON public.ai_input_assets (company_id, project_id);

-- RLS
ALTER TABLE public.ai_input_assets ENABLE ROW LEVEL SECURITY;

-- Authenticated operators read their own company assets
CREATE POLICY "company members can read their ai input assets"
  ON public.ai_input_assets
  FOR SELECT
  USING (company_id = my_company_id());

-- No direct client INSERT / UPDATE / DELETE.
-- The backend uses the service role client and bypasses RLS.

NOTIFY pgrst, 'reload schema';
