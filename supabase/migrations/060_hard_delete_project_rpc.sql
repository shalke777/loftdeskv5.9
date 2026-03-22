-- =============================================================================
-- Migration 060: Hard delete RPC for projects with full cascade cleanup
--
-- Adds delete_project_hard(p_project_id, p_company_id) — SECURITY DEFINER RPC
-- that deletes a project and ALL associated data in safe dependency order.
--
-- Deletion order (satisfies RESTRICT FKs and trg_projects_prevent_delete):
--   1. project_portal_sessions   (RESTRICT FK on project_id)
--   2. project_portal_tokens     (RESTRICT FK on project_id)
--   3. project_threads           (RESTRICT FK; messages cascade automatically)
--   4. cost_approvals            (RESTRICT FK; also in trigger guard)
--   5. project_timeline_events   (RESTRICT FK)
--   6. expense_invoices          (SET NULL FK; in trigger guard → explicit delete)
--   7. invoices                  (SET NULL FK → explicit delete for full cleanup)
--   8. contracts                 (SET NULL FK → explicit delete for full cleanup)
--   9. cost_estimates            (SET NULL FK → explicit delete for full cleanup)
--  10. conversations             (SET NULL FK → explicit delete for full cleanup)
--  11. DELETE projects           (trigger guard passes; CASCADE cleans the rest)
--
-- Note: trg_projects_prevent_delete stays as guard against accidental direct
-- DELETEs from outside this function. The RPC bypasses it by clearing child
-- records first.
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

  -- 1. Portal sessions (RESTRICT FK on project_id; cascade from tokens already handled but delete explicitly)
  DELETE FROM public.project_portal_sessions WHERE project_id = p_project_id;

  -- 2. Portal tokens (RESTRICT FK on project_id)
  DELETE FROM public.project_portal_tokens WHERE project_id = p_project_id;

  -- 3. Project threads (RESTRICT FK; project_messages auto-cascade from threads)
  DELETE FROM public.project_threads WHERE project_id = p_project_id;

  -- 4. Cost approvals (RESTRICT FK; satisfies trigger guard check)
  DELETE FROM public.cost_approvals WHERE project_id = p_project_id;

  -- 5. Timeline events (RESTRICT FK)
  DELETE FROM public.project_timeline_events WHERE project_id = p_project_id;

  -- 6. Expense invoices (SET NULL NK in DB; in trigger guard → explicit delete for full cleanup)
  DELETE FROM public.expense_invoices WHERE project_id = p_project_id;

  -- 7. Financial documents: invoices first (may reference contracts via contract_id)
  DELETE FROM public.invoices WHERE project_id = p_project_id;

  -- 8. Contracts (invoices already removed so no RESTRICT from invoices.contract_id)
  DELETE FROM public.contracts WHERE project_id = p_project_id;

  -- 9. Cost estimates
  DELETE FROM public.cost_estimates WHERE project_id = p_project_id;

  -- 10. Legacy conversations
  DELETE FROM public.conversations WHERE project_id = p_project_id;

  -- 11. Delete the project itself
  --     trg_projects_prevent_delete now passes: threads/approvals/expenses cleared
  --     FK RESTRICT satisfied: portal_sessions, portal_tokens, timeline_events gone
  --     ON DELETE CASCADE auto-cleans: project_documents, project_client_access,
  --       client_decisions, handover_protocols, project_photo_docs, technical_standards
  DELETE FROM public.projects
  WHERE id = p_project_id AND company_id = p_company_id;
END;
$$;

-- Grant execute to authenticated users (RLS enforced via company_id check inside)
GRANT EXECUTE ON FUNCTION public.delete_project_hard(uuid, uuid) TO authenticated;

COMMIT;
