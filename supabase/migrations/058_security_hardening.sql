-- =============================================================================
-- Migration 058: Security hardening
--
-- Fixes two categories of Supabase Security Advisor warnings:
--
-- A) "RLS Disabled in Public" on public.project_portal_sessions
--    Root cause: Migration 050 (which was supposed to drop this table) was
--    never created. The session-based portal system was superseded in
--    migrations 040+ by the client_accounts + magic-link approach.
--    Fix: drop the dead table and all dependent dead objects.
--
-- B) "Function Search Path Mutable" on 8 live functions
--    Fix: ALTER FUNCTION ... SET search_path = public
--    (safer than CREATE OR REPLACE — avoids any risk of body drift)
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART A — Drop dead project_portal_sessions table and its dependents
-- =============================================================================

-- A.1 Drop old anon-role RLS policies that reference portal_session_project_id()
--     or portal_session_has_scope(). These were the session-based portal access
--     policies from migration 034, superseded by authenticated client_account
--     policies added in migration 042.

DROP POLICY IF EXISTS "threads_portal_select"    ON public.project_threads;
DROP POLICY IF EXISTS "messages_portal_select"   ON public.project_messages;
DROP POLICY IF EXISTS "messages_portal_insert"   ON public.project_messages;
DROP POLICY IF EXISTS "timeline_portal_select"   ON public.project_timeline_events;
DROP POLICY IF EXISTS "approvals_portal_select"  ON public.cost_approvals;
DROP POLICY IF EXISTS "approvals_portal_respond" ON public.cost_approvals;

-- A.2 Drop session-based helper functions (created in migration 034).
--     These SELECT directly from project_portal_sessions and are dead.
--     Must be dropped AFTER the policies above (policies are dependents).

DROP FUNCTION IF EXISTS public.portal_session_project_id();
DROP FUNCTION IF EXISTS public.portal_session_has_scope(text);

-- A.3 Drop session-based RPC functions (created in migration 035).
--     These functions validated a session_id parameter against
--     project_portal_sessions. The new portal uses authenticated RPCs via
--     client_accounts. All 035 functions are dead.

DROP FUNCTION IF EXISTS public._portal_validate_session(uuid, text);
DROP FUNCTION IF EXISTS public.portal_get_project(uuid);
DROP FUNCTION IF EXISTS public.portal_get_timeline(uuid, integer);
DROP FUNCTION IF EXISTS public.portal_get_approvals(uuid);
DROP FUNCTION IF EXISTS public.portal_get_messages(uuid, integer);
DROP FUNCTION IF EXISTS public.portal_send_message(uuid, text, text);
DROP FUNCTION IF EXISTS public.portal_respond_approval(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.portal_mark_messages_read(uuid);

-- A.4 Drop the table itself.
--     CASCADE removes FK constraints referencing it (project_portal_sessions
--     was referenced by portal_token_id on cost_approvals.portal_token_id via
--     the project_portal_tokens chain — those were already dropped in
--     migration 051). CASCADE is safe here.

DROP TABLE IF EXISTS public.project_portal_sessions CASCADE;


-- =============================================================================
-- PART B — Fix "Function Search Path Mutable" on 8 live functions
-- =============================================================================
-- ALTER FUNCTION ... SET search_path = public is used instead of
-- CREATE OR REPLACE to avoid any risk of accidentally changing the body.
-- This sets proconfig in pg_proc, which is exactly what Supabase advisor checks.

-- B.1 accept_company_invitation — invitation acceptance flow (migration 009)
ALTER FUNCTION public.accept_company_invitation(text)
  SET search_path = public;

-- B.2 prevent_admin_plan_escalation — blocks API-level plan='admin' escalation (migration 024)
ALTER FUNCTION public.prevent_admin_plan_escalation()
  SET search_path = public;

-- B.3 prevent_role_escalation — blocks API-level role escalation in company_members (migration 024)
ALTER FUNCTION public.prevent_role_escalation()
  SET search_path = public;

-- B.4 _start_company_trial — auto-starts 14-day trial on company INSERT (migration 036)
ALTER FUNCTION public._start_company_trial()
  SET search_path = public;

-- B.5 touch_updated_at — updated_at trigger on project_documents (migration 018)
ALTER FUNCTION public.touch_updated_at()
  SET search_path = public;

-- B.6 set_updated_at — updated_at trigger on project_threads, project_messages,
--     cost_approvals, expense_invoices (migration 034)
ALTER FUNCTION public.set_updated_at()
  SET search_path = public;

-- B.7 projects_prevent_delete — guards against hard-deleting projects with live data (migration 034)
ALTER FUNCTION public.projects_prevent_delete()
  SET search_path = public;

-- B.8 project_messages_after_insert — denormalises last_message onto project_threads (migration 034)
ALTER FUNCTION public.project_messages_after_insert()
  SET search_path = public;

COMMIT;
