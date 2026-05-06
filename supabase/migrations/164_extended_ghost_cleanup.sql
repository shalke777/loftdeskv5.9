-- =============================================================================
-- Migration 164: Extended ghost company cleanup
-- =============================================================================
-- Migration 161 only caught ghost companies with empty name (c.name = '').
-- bootstrap_my_company falls back to v_profile.full_name or 'LoftDesk Workspace'
-- when profile.company is also empty — so ghosts may carry the user's real name
-- or the default workspace name, NOT an empty string.
--
-- Ghost criteria (all must be true):
--   1. companies.owner_user_id = the user (bootstrap artifact, not a real company)
--   2. The user also has a company_members row in a DIFFERENT company
--      where an invitation was accepted (company_invitations.status = 'accepted')
--      — this is the legitimate invited company.
--   3. The ghost company has zero data:
--      no clients, projects, cost_estimates, invoices, contracts
--      (single-member check already covered by criterion 1 + member count)
--
-- Safe to re-run: idempotent via WHERE conditions.
-- =============================================================================

BEGIN;

-- ── Step 1: Identify ghost companies ─────────────────────────────────────────
-- Ghost = owned by a user who also has an accepted invitation to another company,
-- AND the ghost company has no business data.

WITH invited_users AS (
  -- Users who accepted an invitation (have a legit invited company)
  SELECT DISTINCT ci.email
  FROM   public.company_invitations ci
  WHERE  ci.status = 'accepted'
),

ghost_candidates AS (
  SELECT c.id AS ghost_id, c.owner_user_id
  FROM   public.companies c
  WHERE  -- Owner user also accepted an invitation
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN   invited_users iu ON lower(p.email) = lower(iu.email)
      WHERE  p.id = c.owner_user_id
    )
    -- User also has membership in at least one OTHER company (the invited one)
    AND EXISTS (
      SELECT 1 FROM public.company_members cm_invited
      WHERE  cm_invited.user_id    = c.owner_user_id
        AND  cm_invited.company_id <> c.id
    )
    -- Ghost has no real data (empty company)
    AND NOT EXISTS (SELECT 1 FROM public.clients        WHERE company_id = c.id LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public.projects       WHERE company_id = c.id LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public.cost_estimates WHERE company_id = c.id LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public.invoices       WHERE company_id = c.id LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM public.contracts      WHERE company_id = c.id LIMIT 1)
    -- Membership: only the owner themselves (no real team)
    AND (
      SELECT COUNT(*) FROM public.company_members cm2
      WHERE cm2.company_id = c.id
    ) <= 1
),

-- ── Step 2: Delete ghost company_members rows ─────────────────────────────────
deleted_members AS (
  DELETE FROM public.company_members
  WHERE company_id IN (SELECT ghost_id FROM ghost_candidates)
  RETURNING company_id
)

-- ── Step 3: Delete ghost companies ───────────────────────────────────────────
DELETE FROM public.companies
WHERE id IN (SELECT ghost_id FROM ghost_candidates)
  -- Final safety: only delete if no members remain after step 2
  AND (
    SELECT COUNT(*) FROM public.company_members
    WHERE company_id = companies.id
  ) = 0;

COMMIT;

NOTIFY pgrst, 'reload schema';
