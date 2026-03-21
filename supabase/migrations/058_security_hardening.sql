-- =============================================================================
-- Migration 058: Security hardening (v2 — production-safe, idempotent rerun)
--
-- Fixes two categories of Supabase Security Advisor warnings:
--
-- A) "RLS Disabled in Public" on public.project_portal_sessions
--    Root cause: Migration 050 (which was supposed to drop this table) was
--    never created. The session-based portal system was superseded in
--    migrations 040+ by the client_accounts + magic-link approach.
--    Fix: drop the dead table and all dependent dead objects.
--    All DROPs use IF EXISTS — safe to rerun after a partial prior execution.
--
-- B) "Function Search Path Mutable" on 7 live functions
--    Fix: ALTER FUNCTION ... SET search_path = public
--    Each ALTER is wrapped in a DO/EXCEPTION block so a partial prior run
--    (which may have already dropped some functions) does not cause errors.
--
-- Production audit (2026-03-21) — functions confirmed present:
--   accept_company_invitation(text), portal_session_has_scope(text),
--   portal_session_project_id(), prevent_admin_plan_escalation(),
--   prevent_role_escalation(), project_messages_after_insert(),
--   projects_prevent_delete(), set_updated_at(), touch_updated_at()
--
-- Production audit — function confirmed absent (removed from migration):
--   _start_company_trial() — not present in production, skipped.
--
-- Note: portal_session_project_id() and portal_session_has_scope(text) already
--   have SET search_path = public in their definitions (migration 034 lines 132,
--   146). No ALTER needed. They are dropped in Part A as dead objects.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART A — Drop dead project_portal_sessions table and its dependents
-- =============================================================================
-- All statements use DROP ... IF EXISTS — fully idempotent.

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

-- A.2 Drop session-based RPC functions (migration 035). These called
--     _portal_validate_session which joins project_portal_sessions. All dead.
--     Dropped before the helper functions below (A.3) because they depend
--     on _portal_validate_session.

DROP FUNCTION IF EXISTS public._portal_validate_session(uuid, text);
DROP FUNCTION IF EXISTS public.portal_get_project(uuid);
DROP FUNCTION IF EXISTS public.portal_get_timeline(uuid, integer);
DROP FUNCTION IF EXISTS public.portal_get_approvals(uuid);
DROP FUNCTION IF EXISTS public.portal_get_messages(uuid, integer);
DROP FUNCTION IF EXISTS public.portal_send_message(uuid, text, text);
DROP FUNCTION IF EXISTS public.portal_respond_approval(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.portal_mark_messages_read(uuid);

-- A.3 Drop session helper functions (migration 034).
--     Dropped after A.1 policies and A.2 RPCs (their only dependents).

DROP FUNCTION IF EXISTS public.portal_session_project_id();
DROP FUNCTION IF EXISTS public.portal_session_has_scope(text);

-- A.4 Drop the table itself. CASCADE is safe — all FK dependents are gone.
--     project_portal_tokens (the FK parent of portal_token_id) was already
--     dropped in migration 051.

DROP TABLE IF EXISTS public.project_portal_sessions CASCADE;


-- =============================================================================
-- PART B — Fix "Function Search Path Mutable" on 7 live functions
-- =============================================================================
-- ALTER FUNCTION sets proconfig in pg_proc — exactly what the advisor checks.
-- No body duplication risk (vs CREATE OR REPLACE).
-- Each statement is wrapped in DO/EXCEPTION WHEN undefined_function so the
-- block is a no-op if a partial prior run already dropped the function.

-- B.1 accept_company_invitation(text) — invitation acceptance flow (migration 009)
DO $$ BEGIN
  ALTER FUNCTION public.accept_company_invitation(text)
    SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- B.2 prevent_admin_plan_escalation() — blocks plan='admin' via API (migration 024)
DO $$ BEGIN
  ALTER FUNCTION public.prevent_admin_plan_escalation()
    SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- B.3 prevent_role_escalation() — blocks role escalation in company_members (migration 024)
DO $$ BEGIN
  ALTER FUNCTION public.prevent_role_escalation()
    SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- B.4 touch_updated_at() — updated_at trigger on project_documents (migration 018)
DO $$ BEGIN
  ALTER FUNCTION public.touch_updated_at()
    SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- B.5 set_updated_at() — updated_at trigger on project_threads, project_messages,
--     cost_approvals, expense_invoices (migration 034)
DO $$ BEGIN
  ALTER FUNCTION public.set_updated_at()
    SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- B.6 projects_prevent_delete() — guards hard-DELETE on projects with live data (migration 034)
DO $$ BEGIN
  ALTER FUNCTION public.projects_prevent_delete()
    SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- B.7 project_messages_after_insert() — denormalises last_message onto project_threads (migration 034)
DO $$ BEGIN
  ALTER FUNCTION public.project_messages_after_insert()
    SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

COMMIT;
