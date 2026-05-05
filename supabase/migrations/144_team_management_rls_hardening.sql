-- =============================================================================
-- 144 — Team management completeness + invitation security hardening
-- =============================================================================
-- Problems fixed:
--   C-1: company_members UPDATE policy missing → cannot change roles
--   C-2: company_members DELETE policy missing → cannot remove members
--   C-3: invitation INSERT allows role='owner' → privilege escalation vector
--   C-4: my_company_id() / my_role() lack ORDER BY → non-deterministic edge case
--   M-5: my_company_id() / my_role() lack SET search_path → schema injection risk
--   M-6: company_invitations DELETE policy missing → cannot clean up invitations
--   L-3: missing index on company_members(user_id) → slow RLS on every request
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. my_role() helper — deterministic + safe search_path
--    Needed by UPDATE/DELETE policies below.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT role
  FROM public.company_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- Also harden existing my_company_id() — add ORDER BY + SET search_path
CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT company_id
  FROM public.company_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Index on company_members(user_id) — every RLS call hits this
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_company_members_user_id
  ON public.company_members (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. company_members UPDATE policy — owner only, cannot escalate to owner
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_update" ON public.company_members;
CREATE POLICY "members_update" ON public.company_members
  FOR UPDATE
  USING (
    company_id = (SELECT my_company_id())
    AND (SELECT my_role()) = 'owner'
  )
  WITH CHECK (
    company_id = (SELECT my_company_id())
    AND role != 'owner'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. company_members DELETE policy — owner only, cannot remove yourself
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_delete" ON public.company_members;
CREATE POLICY "members_delete" ON public.company_members
  FOR DELETE USING (
    company_id = (SELECT my_company_id())
    AND (SELECT my_role()) = 'owner'
    AND user_id != auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Block role='owner' in invitations — only SECURITY DEFINER can create owner
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  pol_name text;
BEGIN
  -- Detect current INSERT policy name (may differ between envs)
  SELECT policyname INTO pol_name
  FROM pg_policies
  WHERE tablename = 'company_invitations'
    AND cmd = 'INSERT'
  LIMIT 1;

  IF pol_name IS NOT NULL THEN
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.company_invitations', pol_name);
  END IF;
END $$;

CREATE POLICY "company_invitations_insert" ON public.company_invitations
  FOR INSERT WITH CHECK (
    company_id = (SELECT my_company_id())
    AND (SELECT my_role()) IN ('owner', 'admin')
    AND role != 'owner'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. company_invitations DELETE — owner/admin can clean up old invitations
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_invitations_delete" ON public.company_invitations;
CREATE POLICY "company_invitations_delete" ON public.company_invitations
  FOR DELETE USING (
    company_id = (SELECT my_company_id())
    AND (SELECT my_role()) IN ('owner', 'admin')
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
