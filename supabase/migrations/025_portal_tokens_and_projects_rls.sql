-- =============================================================================
-- Migration 025: Create client_portal_tokens + bullet-proof projects RLS
-- =============================================================================

BEGIN;

-- ─── 1. client_portal_tokens ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cost_estimate_id uuid REFERENCES cost_estimates(id) ON DELETE CASCADE,
  client_name     text NOT NULL DEFAULT 'Klient',
  token           text NOT NULL UNIQUE,
  active          boolean NOT NULL DEFAULT true,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;

-- RLS: OR-based (multi-tenant OR legacy)
DROP POLICY IF EXISTS "cpt_all" ON client_portal_tokens;
CREATE POLICY "cpt_all" ON client_portal_tokens
  FOR ALL
  USING (
    company_id = my_company_id()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    company_id = my_company_id()
    OR user_id = auth.uid()
  );

-- GRANT to API roles
GRANT SELECT, INSERT, UPDATE, DELETE ON client_portal_tokens TO authenticated;
GRANT SELECT ON client_portal_tokens TO anon;

-- ─── 2. Bullet-proof projects RLS (OR-based) ────────────────────────────────
-- Drop ALL possible policy names
DO $$
DECLARE _pol record;
BEGIN
  FOR _pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'projects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON projects', _pol.policyname);
  END LOOP;
END $$;

-- Single FOR ALL policy with OR logic
CREATE POLICY "projects_all" ON projects
  FOR ALL
  USING (
    company_id = my_company_id()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    company_id = my_company_id()
    OR user_id = auth.uid()
  );

-- ─── 3. Also fix project_documents, assignment_queue, project_notes, project_timeline
-- In case these tables exist but lack proper RLS
DO $$
DECLARE _pol record;
BEGIN
  -- project_documents
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_documents') THEN
    ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
    FOR _pol IN SELECT policyname FROM pg_policies WHERE tablename = 'project_documents' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON project_documents', _pol.policyname);
    END LOOP;
    CREATE POLICY "pd_all" ON project_documents FOR ALL
      USING (company_id = my_company_id() OR company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()))
      WITH CHECK (company_id = my_company_id() OR company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
  END IF;

  -- assignment_queue
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assignment_queue') THEN
    ALTER TABLE assignment_queue ENABLE ROW LEVEL SECURITY;
    FOR _pol IN SELECT policyname FROM pg_policies WHERE tablename = 'assignment_queue' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON assignment_queue', _pol.policyname);
    END LOOP;
    CREATE POLICY "aq_all" ON assignment_queue FOR ALL
      USING (company_id = my_company_id() OR company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()))
      WITH CHECK (company_id = my_company_id() OR company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
  END IF;
END $$;

COMMIT;
