-- =============================================================================
-- Migration 104: Fix client portal RLS for invoice_items & cost_estimate_items
-- =============================================================================
--
-- ROOT CAUSE:
--   The ii_client_select policy on invoice_items uses a subquery:
--     invoice_id IN (SELECT id FROM invoices WHERE project_id IN (...))
--   This subquery on `invoices` is itself subject to RLS.
--   In PostgreSQL, policy USING-clause subqueries evaluate under the current
--   user's permissions. For a client user, the invoices RLS chain adds
--   overhead and can silently return empty results in nested PostgREST joins.
--
-- FIX:
--   Create SECURITY DEFINER helper functions that bypass RLS on invoices
--   and cost_estimates when resolving which IDs belong to the client's
--   projects. Then rewrite the item-level policies to use these helpers.
--
--   This is safe because the helpers are scoped to auth.uid() via
--   my_client_project_ids() — a client can only see their own items.
--
-- AFFECTED TABLES:
--   - invoice_items (ii_client_select)
--   - cost_estimate_items (cei_client_select)
-- =============================================================================

-- ── 1. Helper: invoice IDs visible to the current client ────────────────────

CREATE OR REPLACE FUNCTION public.my_client_invoice_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT i.id
  FROM   public.invoices i
  WHERE  i.project_id IS NOT NULL
  AND    i.project_id IN (SELECT public.my_client_project_ids())
$$;

GRANT EXECUTE ON FUNCTION public.my_client_invoice_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_client_invoice_ids() TO anon;

-- ── 2. Helper: cost_estimate IDs visible to the current client ──────────────

CREATE OR REPLACE FUNCTION public.my_client_estimate_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ce.id
  FROM   public.cost_estimates ce
  WHERE  ce.project_id IS NOT NULL
  AND    ce.project_id IN (SELECT public.my_client_project_ids())
$$;

GRANT EXECUTE ON FUNCTION public.my_client_estimate_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_client_estimate_ids() TO anon;

-- ── 3. Rewrite ii_client_select on invoice_items ────────────────────────────

DROP POLICY IF EXISTS "ii_client_select" ON public.invoice_items;
CREATE POLICY "ii_client_select" ON public.invoice_items
  FOR SELECT
  USING (
    my_app_role() = 'client'
    AND invoice_id IN (SELECT my_client_invoice_ids())
  );

-- ── 4. Rewrite cei_client_select on cost_estimate_items ─────────────────────

DROP POLICY IF EXISTS "cei_client_select" ON public.cost_estimate_items;
CREATE POLICY "cei_client_select" ON public.cost_estimate_items
  FOR SELECT
  USING (
    my_app_role() = 'client'
    AND cost_estimate_id IN (SELECT my_client_estimate_ids())
  );
