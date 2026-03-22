-- =============================================================================
-- Migration 061: Fix delete_project_hard — remove references to dropped tables
--
-- Migration 060 created the function referencing two tables that were already
-- dropped in earlier migrations:
--   • project_portal_sessions — dropped in migration 050/058
--   • project_portal_tokens   — dropped in migration 051
--
-- PL/pgSQL resolves table references at runtime, so the function was created
-- successfully but threw "relation does not exist" on every call.
--
-- This migration replaces the function body with the corrected deletion order.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_project_hard(
  p_project_id uuid,
  p_company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security: verify caller's company owns this project
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Project not found or access denied (id=%, company=%)',
      p_project_id, p_company_id;
  END IF;

  -- 1. Project threads (RESTRICT FK; project_messages auto-cascade from threads)
  DELETE FROM public.project_threads WHERE project_id = p_project_id;

  -- 2. Cost approvals (RESTRICT FK; satisfies trigger guard check)
  DELETE FROM public.cost_approvals WHERE project_id = p_project_id;

  -- 3. Timeline events (RESTRICT FK)
  DELETE FROM public.project_timeline_events WHERE project_id = p_project_id;

  -- 4. Expense invoices (in trigger guard → explicit delete for full cleanup)
  DELETE FROM public.expense_invoices WHERE project_id = p_project_id;

  -- 5. Financial documents: invoices first (may reference contracts via contract_id)
  DELETE FROM public.invoices WHERE project_id = p_project_id;

  -- 6. Contracts (invoices already removed so no RESTRICT from invoices.contract_id)
  DELETE FROM public.contracts WHERE project_id = p_project_id;

  -- 7. Cost estimates
  DELETE FROM public.cost_estimates WHERE project_id = p_project_id;

  -- 8. Legacy conversations
  DELETE FROM public.conversations WHERE project_id = p_project_id;

  -- 9. Delete the project itself
  --    trg_projects_prevent_delete now passes: threads/approvals/expenses cleared
  --    ON DELETE CASCADE auto-cleans: project_documents, project_client_access,
  --      client_decisions, handover_protocols, project_photo_docs, technical_standards
  DELETE FROM public.projects
  WHERE id = p_project_id AND company_id = p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project_hard(uuid, uuid) TO authenticated;

COMMIT;
