-- =============================================================================
-- Migration 157: Ghost company cleanup — view + SECURITY DEFINER cleanup fn
-- =============================================================================
-- Context:
--   Before migration 156 + backend.ts invite-guard (same sprint), the invite
--   flow caused a race:
--
--     1. Worker opens /join/<token> → saved to localStorage → /login
--     2. signIn() triggers resolveSupabaseSession()
--     3. get_session_context() → NULL (no company_members yet)
--     4. bootstrap_my_company() fires → creates GHOST company (owner row, T1)
--     5. finalizeInviteIfNeeded() → accept_company_invitation() → real company
--        row added (worker role, T2, T2 > T1)
--     6. get_session_context ORDER BY created_at DESC → invited company wins
--
--   The ghost company (step 4) was never used but persists in DB.
--   Characteristics of a ghost company:
--     • default name 'LoftDesk Workspace' (or user's email/profile.company)
--     • zero real data (no clients, projects, invoices, contracts, estimates)
--     • owner user has a SECOND company_members row in a different company
--     • created_at < the invited company_members row
--
-- This migration:
--   A. Creates a VIEW identifying ghost company candidates (read-only, safe)
--   B. Creates a SECURITY DEFINER function for targeted cleanup
--      (must be called explicitly — no automatic DELETE)
--
-- Idempotent: safe to re-run.
-- =============================================================================

BEGIN;

-- ── A. View: ghost_companies_candidates ─────────────────────────────────────
-- Shows companies that look like bootstrap ghosts.
-- Filter logic:
--   1. User owns the company (company_members.role = 'owner')
--   2. User ALSO belongs to at least one other company (the real invited one)
--   3. The candidate company has no real data attached
--
-- This view is SELECT-only — it cannot modify anything.
-- =============================================================================

CREATE OR REPLACE VIEW public.ghost_companies_candidates AS
SELECT
  c.id                AS company_id,
  c.name              AS company_name,
  c.created_at        AS company_created_at,
  cm_owner.user_id    AS owner_user_id,
  cm_owner.created_at AS owner_membership_created_at,
  cm_real.company_id  AS real_company_id,
  cm_real.role        AS real_role,
  cm_real.created_at  AS real_membership_created_at
FROM public.companies c
  -- The suspect company: user is owner
  JOIN public.company_members cm_owner
       ON cm_owner.company_id = c.id
      AND cm_owner.role = 'owner'
  -- User also has a NEWER membership in a different company (the invited one)
  JOIN public.company_members cm_real
       ON cm_real.user_id    = cm_owner.user_id
      AND cm_real.company_id != c.id
      AND cm_real.created_at > cm_owner.created_at
-- No real data in suspect company
WHERE NOT EXISTS (SELECT 1 FROM public.clients      WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.projects     WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoices     WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.contracts    WHERE company_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.cost_estimates WHERE company_id = c.id);

COMMENT ON VIEW public.ghost_companies_candidates IS
  'Read-only view listing bootstrap ghost companies created by the '
  'invite-before-login race (pre mig-157 fix). A ghost company: user '
  'owns it, user also belongs to a newer invited company, and the ghost '
  'has zero real data. Use cleanup_ghost_company(user_id) to delete one.';

-- ── B. Function: cleanup_ghost_company(p_user_id) ───────────────────────────
-- Deletes the ghost company for a specific user after verifying it is safe.
-- Checks:
--   1. Ghost must appear in ghost_companies_candidates (all safety conditions)
--   2. User must still have a valid membership in a real (non-ghost) company
--   3. Only deletes company + company_members rows for the ghost — nothing else
--
-- SECURITY DEFINER: required because anonymous clients cannot DELETE companies.
-- Caller must be authenticated (enforced by auth.uid() check).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_ghost_company(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_ghost_id    uuid;
  v_real_id     uuid;
BEGIN
  -- Only the owner themselves (or service-role tools) may clean up their ghost.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_caller != p_user_id THEN
    RAISE EXCEPTION 'Access denied: can only clean up your own ghost company';
  END IF;

  -- Identify the ghost company for this user
  SELECT company_id, real_company_id
  INTO   v_ghost_id, v_real_id
  FROM   public.ghost_companies_candidates
  WHERE  owner_user_id = p_user_id
  LIMIT  1;

  IF v_ghost_id IS NULL THEN
    RETURN jsonb_build_object(
      'status',  'no_ghost',
      'message', 'No ghost company found for this user — nothing to clean up'
    );
  END IF;

  -- Double-check: user still has real membership
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id   = p_user_id
      AND company_id = v_real_id
  ) THEN
    RETURN jsonb_build_object(
      'status',  'blocked',
      'message', 'Real membership not found — aborting to prevent data loss'
    );
  END IF;

  -- Remove ghost company_members row, then the ghost company itself
  DELETE FROM public.company_members
  WHERE  company_id = v_ghost_id
    AND  user_id    = p_user_id;

  DELETE FROM public.companies
  WHERE  id = v_ghost_id;

  RETURN jsonb_build_object(
    'status',          'cleaned',
    'ghost_company_id', v_ghost_id,
    'real_company_id',  v_real_id
  );
END;
$$;

ALTER FUNCTION public.cleanup_ghost_company(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_ghost_company(uuid) TO authenticated;

COMMENT ON FUNCTION public.cleanup_ghost_company(uuid) IS
  'Migration 157: Safely removes a single bootstrap ghost company for the '
  'given user. Only proceeds when ghost_companies_candidates confirms the '
  'company is empty and the user retains a real invited membership. '
  'SECURITY DEFINER — caller must be the owner of the ghost company.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION (run manually in Supabase SQL editor)
-- =============================================================================
--
-- 1. View ghost candidates (read-only):
--    SELECT * FROM ghost_companies_candidates;
--
-- 2. Count affected users:
--    SELECT COUNT(DISTINCT owner_user_id) AS affected_users,
--           COUNT(*) AS ghost_companies
--    FROM ghost_companies_candidates;
--
-- 3. Clean up all ghosts in one sweep (run as service role, careful):
--    DO $$
--    DECLARE r RECORD;
--    BEGIN
--      FOR r IN SELECT DISTINCT owner_user_id FROM ghost_companies_candidates LOOP
--        PERFORM cleanup_ghost_company(r.owner_user_id);
--      END LOOP;
--    END;
--    $$;
--
-- 4. Verify empty (should return 0 rows after cleanup):
--    SELECT * FROM ghost_companies_candidates;
-- =============================================================================
