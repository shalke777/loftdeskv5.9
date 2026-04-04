-- =============================================================================
-- Migration 100 — project_analysis_jobs
-- =============================================================================
-- Async job table for analyze-project background processing.
-- Large files (>4 MB) are uploaded to storage and processed asynchronously
-- to avoid the 26-second Netlify Function timeout.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS project_analysis_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by      UUID        NOT NULL REFERENCES auth.users(id),
  status          TEXT        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued','processing','done','failed')),
  -- Input data
  storage_path    TEXT,
  file_type       TEXT        NOT NULL DEFAULT 'application/pdf',
  file_name       TEXT        NOT NULL DEFAULT 'project',
  context         TEXT,
  -- Output
  result_json     JSONB,
  -- Error info
  error_code      TEXT,
  error_message   TEXT,
  -- Timestamps
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for polling queries
CREATE INDEX IF NOT EXISTS idx_paj_status_company
  ON project_analysis_jobs (company_id, status)
  WHERE status IN ('queued', 'processing');

-- RLS
ALTER TABLE project_analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Company members can read their own jobs
DROP POLICY IF EXISTS "paj_select" ON project_analysis_jobs;
CREATE POLICY "paj_select" ON project_analysis_jobs
  FOR SELECT USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid()
    )
  );

-- Company members can create jobs
DROP POLICY IF EXISTS "paj_insert" ON project_analysis_jobs;
CREATE POLICY "paj_insert" ON project_analysis_jobs
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid()
    )
  );

-- No user-facing UPDATE/DELETE — only service role updates job status

COMMIT;
