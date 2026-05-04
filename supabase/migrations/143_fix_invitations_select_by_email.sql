-- =============================================================================
-- 143 — Fix company_invitations SELECT policy for invited users
-- =============================================================================
-- Problem:
--   The existing SELECT policy on company_invitations uses:
--     USING (company_id = my_company_id())
--
--   my_company_id() looks up: SELECT company_id FROM company_members WHERE user_id = auth.uid()
--
--   A newly invited user is NOT yet in company_members, so my_company_id() returns NULL
--   and the policy evaluates to FALSE for every row.
--
--   This breaks:
--   • PendingInvitesNotice — always shows empty (never prompts invited user)
--   • pendingInvitationsByEmail — returns 0 rows on login
--   • AcceptInvitationPage pre-check — cannot read invitation status before accepting
--
-- Fix:
--   Add a second SELECT policy that allows a user to read their own invitations
--   by matching email directly against auth.users.email.
--   This is additive (OR logic between policies) — does not break the existing
--   company_invitations_select policy for existing members.
--
-- Safety:
--   • No data exposed beyond the invited user's own email address match.
--   • SECURITY DEFINER not required — auth.uid() provides the anchor.
--   • RLS still blocks cross-tenant reads: user can only see rows where
--     email = their own auth email.
-- =============================================================================

CREATE POLICY company_invitations_select_by_email
  ON public.company_invitations
  FOR SELECT
  USING (
    email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );
