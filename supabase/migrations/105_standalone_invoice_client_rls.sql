-- =============================================================================
-- Migration 105: Standalone invoice visibility for client portal
-- =============================================================================
--
-- PROBLEM:
--   Invoices created without a project (project_id IS NULL) are invisible
--   to clients in the portal. The inv_client_select policy (migration 042)
--   requires project_id IS NOT NULL.
--
--   Additionally, my_client_invoice_ids() (migration 104) only returns
--   project-scoped invoices — so invoice_items for standalone invoices
--   are also invisible.
--
-- DATA MODEL:
--   invoices.client_id  → clients.id  (operator's contact record)
--   client_accounts.client_record_id → clients.id  (auth user → contact)
--   Chain: auth.uid() → client_accounts → client_record_id → clients.id
--
-- FIX:
--   1. Create my_client_record_ids() — returns clients.id values for the
--      authenticated client user
--   2. Add inv_client_select_standalone policy on invoices
--   3. Extend my_client_invoice_ids() to include standalone invoices
--      (this automatically fixes invoice_items via ii_client_select)
--
-- SAFETY:
--   - Operator policies unaffected (they use company_id checks)
--   - Project-scoped client access unaffected
--   - Only adds new visibility for standalone invoices matched by client_id
-- =============================================================================

-- ── 1. Helper: clients.id values linked to the current auth user ────────────

CREATE OR REPLACE FUNCTION public.my_client_record_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ca.client_record_id
  FROM   public.client_accounts ca
  WHERE  ca.auth_user_id = auth.uid()
  AND    ca.client_record_id IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.my_client_record_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_client_record_ids() TO anon;

-- ── 2. Policy: standalone invoices visible to client by client_id ───────────

DROP POLICY IF EXISTS "inv_client_select_standalone" ON public.invoices;
CREATE POLICY "inv_client_select_standalone" ON public.invoices
  FOR SELECT
  USING (
    my_app_role() = 'client'
    AND project_id IS NULL
    AND client_id IS NOT NULL
    AND client_id IN (SELECT my_client_record_ids())
  );

-- ── 3. Extend my_client_invoice_ids() to include standalone invoices ────────
-- This function is used by ii_client_select (migration 104) on invoice_items.
-- Adding standalone invoices here means invoice items are also visible.

CREATE OR REPLACE FUNCTION public.my_client_invoice_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Project-scoped invoices (original logic from migration 104)
  SELECT i.id
  FROM   public.invoices i
  WHERE  i.project_id IS NOT NULL
  AND    i.project_id IN (SELECT public.my_client_project_ids())
  UNION
  -- Standalone invoices matched by client_id
  SELECT i.id
  FROM   public.invoices i
  WHERE  i.project_id IS NULL
  AND    i.client_id IS NOT NULL
  AND    i.client_id IN (SELECT public.my_client_record_ids())
$$;
