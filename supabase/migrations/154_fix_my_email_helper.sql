-- =============================================================================
-- Migration 154: Fix 42501 "permission denied for table users" in RLS policies
-- =============================================================================
-- Sprint A hotfix — same pattern as migration 153.
--
-- Root cause:
--   Migrations 143 and 148 embed inside their RLS policies:
--       SELECT email FROM auth.users WHERE id = auth.uid()
--   The `authenticated` Postgres role has NO SELECT privilege on auth.users.
--   Every time PostgREST evaluates these policies, Postgres raises
--   42501 "permission denied for table users".
--
--   This breaks:
--     • POST /company_invitations with .select('*, companies(name)')
--       (settings.api.ts:108 — inviteMember flow)
--     • pendingInvitationsByEmail (invited users on login)
--     • AcceptInvitationPage pre-check
--
-- Fix:
--   1. Create my_email() SECURITY DEFINER helper that returns the caller's email
--      without exposing auth.users to authenticated role.
--   2. Rewrite the two affected policies to use my_email() instead of the
--      inline SELECT FROM auth.users.
--
-- Safety:
--   • SECURITY DEFINER is anchored to auth.uid() — caller can only read THEIR
--     OWN email. No cross-user exposure.
--   • Functionally identical to the previous policies; only the access path
--     to the email value changes.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. my_email() — SECURITY DEFINER helper, bypasses auth.users RLS permission
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT email::text
  FROM   auth.users
  WHERE  id = auth.uid()
  LIMIT  1
$$;

ALTER FUNCTION public.my_email() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.my_email() TO authenticated;

COMMENT ON FUNCTION public.my_email() IS
  'Migration 154: SECURITY DEFINER helper. Returns auth.users.email for the '
  'currently authenticated caller. Used by RLS policies that need to match '
  'invitations by email without granting authenticated role SELECT on auth.users.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Rewrite company_invitations_select_by_email (was migration 143)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS company_invitations_select_by_email ON public.company_invitations;

CREATE POLICY company_invitations_select_by_email
  ON public.company_invitations
  FOR SELECT
  USING (email = public.my_email());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Rewrite companies_select_for_invited (was migration 148)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS companies_select_for_invited ON public.companies;

CREATE POLICY companies_select_for_invited
  ON public.companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id
      FROM   public.company_invitations
      WHERE  email      = public.my_email()
        AND  status     = 'pending'
        AND  expires_at > now()
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
