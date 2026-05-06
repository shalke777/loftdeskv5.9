-- =============================================================================
-- Migration 153: SECURITY DEFINER function for billing plan resolution
-- =============================================================================
-- Root cause: companies table SELECT is returning 403 (Forbidden) for
-- authenticated operators when the RLS policy companies_select_for_members
-- (migrations 151/152) has not yet been applied to the live DB.
--
-- This function bypasses RLS entirely — it runs as the postgres owner and
-- always returns the company row for the caller's active membership.
--
-- Frontend code calls: supabase.rpc('get_my_company_billing')
-- instead of: supabase.from('companies').select('*').eq('id', companyId)
--
-- Also adds plan_source column if not yet present (may be missing on older DBs).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ensure plan_source column exists
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_source TEXT DEFAULT 'stripe';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_my_company_billing() — SECURITY DEFINER, bypasses RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns the company row for the currently logged-in user's newest membership.
-- Uses SECURITY DEFINER so RLS on companies is bypassed completely.
-- This is intentional — the function still verifies identity via auth.uid()
-- and company_members, so no unauthorized access is possible.
CREATE OR REPLACE FUNCTION public.get_my_company_billing()
RETURNS TABLE (
  id                              uuid,
  name                            text,
  plan                            text,
  plan_source                     text,
  subscription_status             text,
  trial_ends_at                   timestamptz,
  subscription_current_period_end timestamptz,
  ksef_token                      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    COALESCE(c.plan, 'free')        AS plan,
    COALESCE(c.plan_source, 'stripe') AS plan_source,
    c.subscription_status,
    c.trial_ends_at,
    c.subscription_current_period_end,
    c.ksef_token
  FROM public.companies c
  WHERE c.id = (
    SELECT company_id
    FROM   public.company_members
    WHERE  user_id = auth.uid()
    ORDER BY created_at DESC
    LIMIT 1
  );
$$;

ALTER FUNCTION public.get_my_company_billing() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_my_company_billing() TO authenticated;

COMMENT ON FUNCTION public.get_my_company_billing() IS
  'Migration 153: SECURITY DEFINER billing resolver. Returns company row for '
  'the caller''s active membership without requiring companies RLS policies. '
  'SECURITY DEFINER is safe here because auth.uid() + company_members ensures '
  'a user can only see their own company.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Also re-assert companies_select_for_members (idempotent safety net)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS companies_select_for_members ON public.companies;

CREATE POLICY companies_select_for_members
  ON public.companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id
      FROM   public.company_members
      WHERE  user_id = auth.uid()
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
