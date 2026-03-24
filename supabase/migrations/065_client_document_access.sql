-- =============================================================================
-- Migration 065: Client portal read access to project documents & photo docs
--
-- Root cause: project_documents and project_photo_docs have RLS policies
-- only for operator roles (my_company_id()). Clients logged in via the
-- portal have no SELECT access, so the Documents tab cannot show project
-- attachments or photos.
--
-- Fix: Add a client SELECT policy to each table, following the same pattern
-- used on cost_estimates, invoices, cost_approvals, etc. (migration 042).
-- Client can see rows only for projects they have access to via
-- project_client_access → my_client_project_ids().
--
-- Safety:
--   - SELECT-only: clients cannot INSERT, UPDATE, or DELETE
--   - project_documents: only non-archived rows (archived_at IS NULL)
--   - project_photo_docs: only rows with a non-null project_id
--   - Operator policies are untouched
-- =============================================================================

-- ── 1. project_documents — client read access ───────────────────────────────

DROP POLICY IF EXISTS "pd_client_select" ON public.project_documents;
CREATE POLICY "pd_client_select" ON public.project_documents
  FOR SELECT
  USING (
    archived_at IS NULL
    AND project_id IN (SELECT public.my_client_project_ids())
  );

-- ── 2. project_photo_docs — client read access ──────────────────────────────

DROP POLICY IF EXISTS "ppd_client_select" ON public.project_photo_docs;
CREATE POLICY "ppd_client_select" ON public.project_photo_docs
  FOR SELECT
  USING (
    project_id IS NOT NULL
    AND project_id IN (SELECT public.my_client_project_ids())
  );
