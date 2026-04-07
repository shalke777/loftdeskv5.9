-- Migration 113: F1 Memory System — project_memory_entries table + ai_context on projects

-- L1: context summary on projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS ai_context_summary text,
  ADD COLUMN IF NOT EXISTS ai_context_updated_at timestamptz;

-- L2: structured memory entries per project
CREATE TABLE IF NOT EXISTS project_memory_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  memory_type   text NOT NULL CHECK (memory_type IN ('decision', 'preference', 'event', 'issue', 'amount')),
  topic         text NOT NULL DEFAULT '',
  content       text NOT NULL,
  source_type   text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'voice_note', 'client_decision', 'chat')),
  source_id     uuid,
  contradiction_of uuid REFERENCES project_memory_entries(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pme_company_idx   ON project_memory_entries(company_id);
CREATE INDEX IF NOT EXISTS pme_project_idx   ON project_memory_entries(project_id);
CREATE INDEX IF NOT EXISTS pme_type_idx      ON project_memory_entries(project_id, memory_type);
CREATE INDEX IF NOT EXISTS pme_created_idx   ON project_memory_entries(project_id, created_at DESC);

ALTER TABLE project_memory_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operator_pme_select" ON project_memory_entries;
DROP POLICY IF EXISTS "operator_pme_insert" ON project_memory_entries;
DROP POLICY IF EXISTS "operator_pme_delete" ON project_memory_entries;

CREATE POLICY "operator_pme_select" ON project_memory_entries
  FOR SELECT USING (company_id = my_company_id());

CREATE POLICY "operator_pme_insert" ON project_memory_entries
  FOR INSERT WITH CHECK (company_id = my_company_id());

CREATE POLICY "operator_pme_delete" ON project_memory_entries
  FOR DELETE USING (company_id = my_company_id());
