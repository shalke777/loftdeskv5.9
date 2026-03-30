-- =============================================================================
-- Migration 080: Restore SECURITY DEFINER on my_company_id() and my_role()
-- =============================================================================
--
-- ROOT CAUSE (P0 regression introduced by migration repair session):
--
-- supabase db push (first attempt, 2026-03-30) saw migrations 019-078 as
-- untracked and re-ran migrations 000-018 against production.
--
-- Migration 001 re-created my_company_id() and my_role() WITHOUT SECURITY
-- DEFINER — resetting the fix that migration 023 had previously applied.
--
-- Migration 002 then re-created company_members.members_select as:
--   USING (company_id = my_company_id())
--
-- Migration 023 (the original fix) was NOT re-run (it's in the 019+ group
-- that failed/stopped at migration 019 "policy cd_select already exists").
--
-- Result:
--   my_company_id() (non-SECURITY DEFINER) queries company_members
--   → triggers company_members RLS policy: USING (company_id = my_company_id())
--   → calls my_company_id() again
--   → queries company_members again
--   → RLS fires again
--   → infinite recursion → stack depth limit exceeded (54001)
--
-- This broke ALL queries routing through my_company_id():
--   invoices, projects, estimates, contracts, company_members, companies, etc.
--
-- When company_members SELECT returns 500, memberRow = null in
-- resolveSupabaseSession(), the user falls through to the client_accounts
-- check and gets mapped to role='client' → ClientShell renders.
--
-- Fix (mirrors migration 023 exactly):
--   1. Restore my_company_id() as SECURITY DEFINER + SET search_path = public
--   2. Restore my_role() as SECURITY DEFINER + SET search_path = public
--   3. Restore company_members.members_select to USING (user_id = auth.uid())
--      (direct auth check — no function call, no possible recursion)
--
-- These three changes are minimal, safe, and idempotent.
-- No data migration. No policy changes on other tables.
-- Previously-correct tables (companies_select, invoices_select, etc.) rely on
-- my_company_id() — they become safe again once the function is SECURITY DEFINER.
-- =============================================================================

-- ── 1. Restore my_company_id() as SECURITY DEFINER ───────────────────────────

CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.my_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_company_id() TO anon;

-- ── 2. Restore my_role() as SECURITY DEFINER ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.company_members WHERE user_id = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role() TO anon;

-- ── 3. Restore company_members.members_select to direct auth.uid() check ─────
-- Direct check: no function call, zero recursion risk.

DROP POLICY IF EXISTS "members_select" ON public.company_members;
CREATE POLICY "members_select" ON public.company_members
  FOR SELECT USING (user_id = auth.uid());

-- ── 4. Safety: also restore members_insert to direct check ───────────────────
-- Migration 023 also set this. Make sure it's correct.

DROP POLICY IF EXISTS "members_insert" ON public.company_members;
CREATE POLICY "members_insert" ON public.company_members
  FOR INSERT WITH CHECK (user_id = auth.uid());
