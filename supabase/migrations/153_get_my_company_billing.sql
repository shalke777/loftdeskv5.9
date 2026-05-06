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
-- Returns the FULL companies row (RETURNS SETOF companies) for the caller's
-- active membership. Using SETOF companies means ALL columns are returned —
-- no DTO reduction, no field omissions, future columns included automatically.
-- Fields include: id, name, nip, plan, plan_source, ksef_env, ksef_nip,
-- ksef_token, address, postal_code, city, iban, phone, email, website,
-- owner_user_id, logo_url, stripe_customer_id, stripe_subscription_id,
-- subscription_status, subscription_current_period_end, trial_ends_at,
-- billing_email, doc_number_config, created_at.
--
-- SECURITY DEFINER is safe: identity verified via auth.uid() + company_members.
-- A user can only ever see their own company row.
--
-- DROP old narrowly-typed version first so CREATE OR REPLACE doesn't fail
-- on a return-type mismatch if it was partially applied before.
DROP FUNCTION IF EXISTS public.get_my_company_billing();

CREATE OR REPLACE FUNCTION public.get_my_company_billing()
RETURNS SETOF public.companies
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
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
  'Migration 153 (updated): SECURITY DEFINER billing resolver. '
  'Returns FULL companies row (SETOF companies) for the caller''s active '
  'membership without requiring companies RLS policies. '
  'SECURITY DEFINER is safe: auth.uid() + company_members ensures '
  'a user can only see their own company. All columns returned — no DTO filtering.';

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
