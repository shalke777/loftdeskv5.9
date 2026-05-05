-- =============================================================================
-- Migration 150: Fix my_company_id() to return NEWEST membership (DESC)
-- =============================================================================
--
-- Problem:
--   my_company_id() had no ORDER BY clause — it returned an arbitrary row
--   (usually the oldest/ghost bootstrap company due to heap order).
--
--   All RLS policies use:  USING (company_id = my_company_id())
--
--   After a user accepts an invitation they have 2 company_members rows:
--     1. ghost bootstrap company  (created_at T1 — oldest)
--     2. invited company          (created_at T2 — newest)
--
--   Without ORDER BY, my_company_id() returned ghost → all RLS checks against
--   invited-company data failed → user saw empty app even after accepting.
--
-- Fix:
--   Add ORDER BY created_at DESC LIMIT 1 so the NEWEST membership wins.
--
--   Frontend (backend.ts / dataScope.ts) already applies the same logic:
--     ORDER BY created_at DESC + loftdesk-company-switch-hint for initial landing.
--   This migration makes the SQL/RLS layer consistent with the frontend.
--
-- Safety:
--   • SECURITY DEFINER + SET search_path = public preserved from migration 080.
--   • No recursion risk — function bypasses RLS when reading company_members.
--   • Additive sort change only — no schema or policy changes.
--   • Single-membership users (majority): zero behavioural change.
--   • Multi-membership users: now default to newest company (correct UX).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM   public.company_members
  WHERE  user_id = auth.uid()
  ORDER  BY created_at DESC
  LIMIT  1
$$;

GRANT EXECUTE ON FUNCTION public.my_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_company_id() TO anon;

-- Reload PostgREST schema cache to pick up the function change.
NOTIFY pgrst, 'reload schema';
