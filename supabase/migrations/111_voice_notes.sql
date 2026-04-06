CREATE TABLE IF NOT EXISTS voice_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  title       text NOT NULL DEFAULT '',
  transcript  text NOT NULL DEFAULT '',
  audio_url   text,
  status      text NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'processing', 'processed', 'error')),
  extracted_result jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_notes_company_idx ON voice_notes(company_id);
CREATE INDEX IF NOT EXISTS voice_notes_project_idx ON voice_notes(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS voice_notes_status_idx ON voice_notes(company_id, status);

ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operator_voice_notes_select" ON voice_notes;
DROP POLICY IF EXISTS "operator_voice_notes_insert" ON voice_notes;
DROP POLICY IF EXISTS "operator_voice_notes_update" ON voice_notes;
DROP POLICY IF EXISTS "operator_voice_notes_delete" ON voice_notes;

CREATE POLICY "operator_voice_notes_select" ON voice_notes
  FOR SELECT USING (company_id = my_company_id());

CREATE POLICY "operator_voice_notes_insert" ON voice_notes
  FOR INSERT WITH CHECK (company_id = my_company_id());

CREATE POLICY "operator_voice_notes_update" ON voice_notes
  FOR UPDATE USING (company_id = my_company_id());

CREATE POLICY "operator_voice_notes_delete" ON voice_notes
  FOR DELETE USING (company_id = my_company_id());
