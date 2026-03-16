-- =============================================================================
-- Migration 052: Guard projects_select against client-role users
-- =============================================================================
-- ROOT CAUSE
-- ----------
-- Supabase RLS policies on the same table / operation are evaluated with OR
-- semantics (all permissive policies are ORed together).
--
-- The legacy "projects_select" policy (migration 022):
--   company_id = my_company_id()
-- grants SELECT to anyone whose auth.uid() appears in company_members.
--
-- A user can exist in BOTH company_members (as an operator) AND
-- client_accounts (as a client).  When such a user is using the client
-- portal, my_app_role() correctly returns 'client', and proj_client_select
-- (migration 047) scopes them to only their assigned projects.
-- HOWEVER the old "projects_select" policy is still evaluated in parallel
-- and — because my_company_id() returns the company_id from company_members —
-- it lets the dual-role user see ALL company projects, bypassing the
-- project_client_access isolation.
--
-- Symptom: client dashboard shows every company project (including deleted
-- ones) instead of only those explicitly assigned to the client email.
--
-- FIX
-- ---
-- Add  my_app_role() != 'client'  guard to the operator-side projects_select
-- policy.  Clients are served exclusively by proj_client_select (migration
-- 047 + this migration), which already scopes via my_client_project_ids().
--
-- IDEMPOTENT: safe to run multiple times.
-- =============================================================================

DROP POLICY IF EXISTS "projects_select" ON public.projects;

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (
    public.my_app_role() != 'client'
    AND company_id = public.my_company_id()
  );

-- Also harden proj_client_select to ensure deleted_at IS NULL is enforced
-- at the RLS level (defence-in-depth alongside the API-level filter added in
-- client-portal.api.ts and the my_client_project_ids() fix from migration 048).
DROP POLICY IF EXISTS "proj_client_select" ON public.projects;

CREATE POLICY "proj_client_select" ON public.projects
  FOR SELECT USING (
    public.my_app_role() = 'client'
    AND deleted_at IS NULL
    AND id IN (SELECT public.my_client_project_ids())
  );
