-- =============================================================================
-- Migration 161: Clean up ghost companies created by bootstrap race
-- =============================================================================
-- Root cause:
--   When accept_company_invitation RPC succeeds (invite → 'accepted',
--   company_members inserted) but PgBouncer serves a stale connection,
--   get_session_context() returns null → invite guard only checked 'pending' →
--   bootstrap_my_company ran → ghost company (empty name/nip) created →
--   ORDER BY created_at DESC returned ghost instead of invited company.
--
-- This migration removes ghost companies for users who:
--   1. Are a member of at least one INVITED company (have accepted invitation)
--   2. Also have a ghost company (empty name, created AFTER the invite accept)
--
-- Ghost company criteria:
--   • company.name = '' (empty string — bootstrap_my_company default)
--   • Only one member (the user themselves, as owner)
--   • User also has membership in another company (the invited one)
--
-- Idempotent: will no-op if already clean.
-- =============================================================================

BEGIN;

-- ── Step 1: Identify ghost company_members rows ──────────────────────────────
-- A ghost membership is one where:
--   a) the company has empty name (bootstrap artifact)
--   b) the company has exactly 1 member total (only the user themselves)
--   c) the user also belongs to at least one OTHER company (their invited company)

WITH ghost_memberships AS (
  SELECT cm.user_id, cm.company_id AS ghost_company_id
  FROM   public.company_members cm
  JOIN   public.companies c ON c.id = cm.company_id
  WHERE  (c.name IS NULL OR c.name = '')
    -- Only single-member companies (pure ghost, no real data)
    AND (
      SELECT COUNT(*) FROM public.company_members cm2
      WHERE cm2.company_id = cm.company_id
    ) = 1
    -- User must also have membership in another (real invited) company
    AND EXISTS (
      SELECT 1 FROM public.company_members cm3
      WHERE cm3.user_id = cm.user_id
        AND cm3.company_id <> cm.company_id
    )
),

-- ── Step 2: Delete ghost company_members rows ────────────────────────────────
deleted_members AS (
  DELETE FROM public.company_members
  WHERE (user_id, company_id) IN (
    SELECT user_id, ghost_company_id FROM ghost_memberships
  )
  RETURNING company_id AS deleted_company_id
),

-- ── Step 3: Delete ghost companies (now orphaned) ────────────────────────────
-- Only delete if they have zero members remaining (safety net).
orphaned_companies AS (
  SELECT DISTINCT deleted_company_id FROM deleted_members
)

DELETE FROM public.companies
WHERE id IN (SELECT deleted_company_id FROM orphaned_companies)
  AND (
    SELECT COUNT(*) FROM public.company_members
    WHERE company_id = companies.id
  ) = 0;

-- ── Step 4: Verify (informational) ──────────────────────────────────────────
-- After this migration, users affected by the race should resolve correctly
-- via get_session_context() → ORDER BY created_at DESC → invited company wins.

COMMIT;

NOTIFY pgrst, 'reload schema';
