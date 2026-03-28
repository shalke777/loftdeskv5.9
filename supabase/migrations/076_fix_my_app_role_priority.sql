-- =============================================================================
-- 076_fix_my_app_role_priority.sql
-- =============================================================================
-- Root cause for signature_requests INSERT blocker (and operator_notifications):
--
-- my_app_role() (migration 042) checks client_accounts FIRST.
-- If an operator also has a client_accounts row (e.g. they accepted an
-- invitation with their own email, or tested their own portal), the function
-- returns 'client', blocking all policies that use:
--   my_app_role() NOT IN ('client', 'anonymous')
--
-- Old tables (estimates, contracts, projects) use my_role() which reads only
-- company_members — unaffected. New tables (signature_*, notifications) use
-- my_app_role() — all blocked for operators who have client_accounts entries.
--
-- Fix: mirror the same priority logic backend.ts applies in JavaScript:
--   - If in company_members AND (no client_accounts OR same company_id) → operator
--   - If in client_accounts with DIFFERENT company_id (ghost bootstrap) → client
--   - If no company_members only client_accounts → client
--   - Fallback → anonymous
--
-- This is a pure function replace, no table or policy changes needed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.my_app_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Operator takes precedence if in company_members AND
    -- there is no client_accounts entry for a DIFFERENT company.
    -- (Operator who tested their own portal → same company_id in both → stays operator)
    (SELECT cm.role
     FROM   public.company_members cm
     WHERE  cm.user_id = auth.uid()
     AND    NOT EXISTS (
       SELECT 1
       FROM   public.client_accounts ca
       WHERE  ca.auth_user_id = auth.uid()
       AND    ca.company_id != cm.company_id
     )
     LIMIT 1),
    -- Falls through to client check only if above returned NULL:
    -- (a) no company_members row, OR
    -- (b) has company_members but client_accounts has a different company (ghost bootstrap)
    (SELECT 'client'
     FROM   public.client_accounts
     WHERE  auth_user_id = auth.uid()
     LIMIT 1),
    -- Final fallback
    'anonymous'
  )
$$;

GRANT EXECUTE ON FUNCTION public.my_app_role() TO authenticated, anon;
