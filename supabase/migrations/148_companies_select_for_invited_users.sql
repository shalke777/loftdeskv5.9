-- =============================================================================
-- 148 — Allow invited users to read company name from their pending invitations
-- =============================================================================
-- Problem:
--   pendingInvitationsByEmail() selects:
--     company_invitations.select('*, companies(name)')
--     .order('created_at', { ascending: false })
--
--   Migration 143 added a SELECT policy on company_invitations so an invited user
--   (not yet a member) can read their own pending invitation rows by email match.
--
--   BUT the PostgREST foreign-key join to companies ALSO requires a SELECT policy
--   on the companies table. The only existing policy is:
--     companies_select: USING (id = my_company_id())
--   …which returns NULL for non-members, so the join fails with HTTP 403.
--   This causes:
--     • PendingInvitesNotice always shows empty (invited user sees no invitations)
--     • AcceptInvitationPage cannot pre-check invitation status
--     • console/Sentry flooded with 403 errors from monitoring.ts:158
--
-- Fix:
--   Add a second, additive SELECT policy on companies allowing read of the
--   company row when the authenticated user has a pending (non-expired) invitation
--   for that company_id, matched by their auth email.
--
-- Safety:
--   • Only the company_id rows where user has a pending invitation are exposed.
--   • Non-expired guard (expires_at > now()) prevents stale invitation abuse.
--   • Anchored to auth.uid() — user cannot spoof another user's invitations.
--   • Does NOT grant any write access.
--   • Additive to existing companies_select policy — members are unaffected.
-- =============================================================================

CREATE POLICY companies_select_for_invited
  ON public.companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id
      FROM   public.company_invitations
      WHERE  email      = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND  status     = 'pending'
        AND  expires_at > now()
    )
  );

-- Notify PostgREST to reload schema cache immediately.
NOTIFY pgrst, 'reload schema';
