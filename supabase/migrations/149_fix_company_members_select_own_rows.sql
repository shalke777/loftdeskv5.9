-- =============================================================================
-- 149 — Allow users to see ALL their own company_members rows
-- =============================================================================
-- Problem:
--   The existing `members_select` policy on company_members is:
--     USING (company_id = my_company_id())
--   where my_company_id() returns the OLDEST company (ORDER BY created_at ASC).
--
--   When a new user:
--     1. Registers → bootstrap_my_company creates a ghost empty company
--        → company_members row 1: ghost_id, owner, created_at=T1
--     2. Accepts an invitation → accept_company_invitation inserts:
--        → company_members row 2: invited_id, worker, created_at=T2 (T2 > T1)
--
--   my_company_id() returns ghost_id (T1, oldest).
--   The SELECT policy ONLY shows the ghost row to the user.
--   resolveSupabaseSession and getDataScope use .limit(1).maybeSingle() and
--   only see the ghost row → session always resolves to the ghost company,
--   never to the invited company.
--
-- Fix:
--   Add an ADDITIVE SELECT policy so each user can read ALL their own
--   company_members rows (user_id = auth.uid()).
--
--   Combined with:
--   - resolveSupabaseSession reading ALL rows and preferring a stored hint
--   - AcceptInvitationPage/LoginForm storing the accepted company_id as hint
--
--   This makes the session switch correctly to the invited company after acceptance.
--
-- Safety:
--   • Does NOT expose other users' memberships.
--   • Does NOT grant any write access.
--   • Fully additive — the existing `members_select` policy is unchanged.
--   • `verifyMembership()` will now correctly return ALL company IDs for a user.
-- =============================================================================

CREATE POLICY members_select_own_rows
  ON public.company_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Notify PostgREST to reload schema cache immediately.
NOTIFY pgrst, 'reload schema';
