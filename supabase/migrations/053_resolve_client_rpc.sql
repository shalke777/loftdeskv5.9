-- =============================================================================
-- 053_resolve_client_rpc.sql
--
-- Defines resolve_my_client_account() — a SECURITY DEFINER function called by
-- backend.ts resolveSupabaseSession() in the parallel session bootstrap fetch.
--
-- Why this is needed:
--   backend.ts calls supabase.rpc('resolve_my_client_account').maybeSingle()
--   alongside the company_members query. Without this function defined in the
--   database the RPC call returns a PostgreSQL error on every page load for
--   authenticated sessions, adding noise to Supabase logs and causing a
--   discarded silent fallback for every operator session as well.
--
-- Behaviour:
--   - Returns the client_accounts row for the currently authenticated user.
--   - Returns 0 rows when called by an operator (no matching client_accounts).
--   - SECURITY DEFINER + search_path = public prevents search_path injection.
--   - STABLE so the query planner can cache within a transaction.
--
-- No data migration required — pure function definition.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_my_client_account()
RETURNS SETOF public.client_accounts
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.client_accounts
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute to all authenticated Supabase users.
-- RLS policies on client_accounts tables govern what data is visible after the
-- function returns rows — the GRANT here only controls call permission.
GRANT EXECUTE ON FUNCTION public.resolve_my_client_account() TO authenticated;

COMMIT;
