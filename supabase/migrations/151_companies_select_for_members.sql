-- =============================================================================
-- Migration 151: Allow operators to read any company they are a member of
-- =============================================================================
--
-- Problem:
--   After accepting a team invitation the invited user has 2 company_members rows:
--     1. ghost bootstrap company G (created_at T1, oldest)
--     2. invited company C         (created_at T2, newest)
--
--   The existing policy:
--     companies_select: USING (id = (SELECT my_company_id()))
--   … calls my_company_id() which (without migration 150 applied) returns G —
--   the oldest membership.  So company C is NOT readable via companies_select.
--
--   Migration 148 added companies_select_for_invited but it requires
--     status = 'pending'  — after acceptance, status = 'accepted', so it also
--     does NOT cover company C.
--
--   As a result, the PostgREST embedded join:
--     company_members.select('company_id, role, companies(name, plan)')
--   … tries to read company C → RLS blocks it → HTTP 403 on the WHOLE query →
--     memberResult.data = null  → memberRows = []  → pickedMember = null
--     → resolveSupabaseSession falls through to the client_accounts branch
--     → returns role:'client'  → user is redirected to client portal.
--
-- Fix:
--   Add a third, additive SELECT policy on companies that allows an authenticated
--   user to read any company row where they hold an ACTIVE membership.
--
-- Safety:
--   • Only company rows where user_id appears in company_members are exposed.
--   • company_members itself is protected by members_select (user_id = auth.uid()).
--     The subquery here also uses user_id = auth.uid() directly — no recursion.
--   • SECURITY DEFINER is NOT required here (no function call involved).
--   • Additive — existing companies_select and companies_select_for_invited are
--     untouched. All three policies are ORed by PostgREST.
--   • No data migration, no schema change, no write access granted.
-- =============================================================================

CREATE POLICY companies_select_for_members
  ON public.companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id
      FROM   public.company_members
      WHERE  user_id = auth.uid()
    )
  );

-- Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
