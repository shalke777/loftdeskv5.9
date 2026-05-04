-- =============================================================================
-- Migration 140: Phase 2.5 — Critical Security Hardening (P0 fixes)
-- =============================================================================
-- Audit date: 2026-05-05
-- Confirmed exploitable vulnerabilities being fixed:
--
--   C-1 delete_project_hard      → IDOR via spoofed p_company_id
--   C-2 check_rate_limit          → public exposure + p_user_id spoofing + DoS
--   C-3 resolve_my_client_account → email_verified bypass = account takeover
--
-- Hardening applied to all 3:
--   - SET search_path = public, pg_temp
--   - REVOKE EXECUTE FROM PUBLIC (explicit grants only)
--   - auth.uid() as ONLY trusted identity source
--   - No reliance on client-supplied authorization parameters
--
-- Backward compatibility:
--   - delete_project_hard: BREAKING for FE — drop p_company_id arg.
--     New 1-arg overload added; old 2-arg signature dropped.
--     Frontend updated in same PR.
--   - check_rate_limit:    NON-BREAKING — Netlify already uses service_role key.
--   - resolve_my_client_account: NON-BREAKING — same signature, stricter logic.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- C-1 FIX: delete_project_hard
-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE: Trusted client-supplied p_company_id; any authenticated user could
--         pass any (project_id, company_id) tuple and wipe another tenant's
--         data. SECURITY DEFINER bypassed RLS on 11 tables.
--
-- AFTER:  Single arg p_project_id. Company derived server-side. Caller must
--         be company_members.role IN ('owner','admin') for that company.

DROP FUNCTION IF EXISTS public.delete_project_hard(uuid, uuid);

CREATE OR REPLACE FUNCTION public.delete_project_hard(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id   uuid;
  v_caller_role  text;
  v_caller_uid   uuid := auth.uid();
BEGIN
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- 1. Resolve company strictly from DB (NOT from client input)
  SELECT company_id INTO v_company_id
  FROM   public.projects
  WHERE  id = p_project_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Authorization: caller must be owner or admin of that exact company
  SELECT role INTO v_caller_role
  FROM   public.company_members
  WHERE  user_id    = v_caller_uid
    AND  company_id = v_company_id;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'access_denied'
      USING HINT = 'Tylko właściciel lub admin firmy może trwale usunąć projekt.',
            ERRCODE = '42501';
  END IF;

  -- 3. Cascade delete (unchanged business logic from migration 061)
  DELETE FROM public.project_threads          WHERE project_id = p_project_id;
  DELETE FROM public.cost_approvals           WHERE project_id = p_project_id;
  DELETE FROM public.project_timeline_events  WHERE project_id = p_project_id;
  DELETE FROM public.expense_invoices         WHERE project_id = p_project_id;
  DELETE FROM public.invoices                 WHERE project_id = p_project_id;
  DELETE FROM public.contracts                WHERE project_id = p_project_id;
  DELETE FROM public.cost_estimates           WHERE project_id = p_project_id;
  DELETE FROM public.conversations            WHERE project_id = p_project_id;
  DELETE FROM public.projects                 WHERE id = p_project_id AND company_id = v_company_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.delete_project_hard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_project_hard(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- C-2 FIX: check_rate_limit
-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE: No REVOKE — default PUBLIC EXECUTE grant. Any authenticated user
--         could spoof p_user_id (quota theft, quota bypass, storage DoS).
--         Missing SET search_path.
--
-- AFTER:  REVOKE FROM PUBLIC/anon/authenticated, GRANT only to service_role.
--         Netlify functions already use SUPABASE_SERVICE_ROLE_KEY (verified
--         in netlify/functions/*/makeRateLimitClient). Zero frontend impact.
--         search_path locked. Storage DoS removed: only service role inserts.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id   uuid,
  p_endpoint  text,
  p_max       integer DEFAULT 10,
  p_window_ms integer DEFAULT 600000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now        timestamptz := now();
  v_window_sec numeric     := p_window_ms / 1000.0;
  v_row        RECORD;
BEGIN
  INSERT INTO public.ai_rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, v_now)
  ON CONFLICT (user_id, endpoint) DO UPDATE
    SET request_count = CASE
          WHEN ai_rate_limits.window_start + (v_window_sec || ' seconds')::interval < v_now
          THEN 1
          ELSE ai_rate_limits.request_count + 1
        END,
        window_start = CASE
          WHEN ai_rate_limits.window_start + (v_window_sec || ' seconds')::interval < v_now
          THEN v_now
          ELSE ai_rate_limits.window_start
        END
  RETURNING request_count, window_start INTO v_row;

  RETURN jsonb_build_object(
    'limited',   v_row.request_count > p_max,
    'count',     v_row.request_count,
    'max',       p_max,
    'resets_at', v_row.window_start + (v_window_sec || ' seconds')::interval
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.check_rate_limit(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer)
  TO service_role;

-- Harden cleanup helper too
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.ai_rate_limits WHERE window_start < now() - interval '1 hour';
$$;

REVOKE ALL  ON FUNCTION public.cleanup_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- C-3 FIX: resolve_my_client_account
-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE: Email fallback claimed any client_accounts row with matching email
--         and auth_user_id IS NULL — no email_verified check. Attacker who
--         registered with victim's email (unconfirmed signup or OAuth with
--         spoofable email) could hijack the invitation.
--
-- AFTER:  Requires (auth.jwt() ->> 'email_verified')::boolean = true.
--         Atomic claim via UPDATE … RETURNING with WHERE auth_user_id IS NULL —
--         race-safe. Returns nothing if email not verified.

CREATE OR REPLACE FUNCTION public.resolve_my_client_account()
RETURNS SETOF public.client_accounts
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid             uuid    := auth.uid();
  v_email           text;
  v_email_verified  boolean;
  result            public.client_accounts;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- Fast path: existing binding (no email check needed — auth_user_id is the trust)
  SELECT * INTO result
  FROM   public.client_accounts
  WHERE  auth_user_id = v_uid
  LIMIT  1;
  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Fallback: claim by email — REQUIRES verified email
  v_email          := lower(auth.jwt() ->> 'email');
  v_email_verified := COALESCE((auth.jwt() ->> 'email_verified')::boolean, false);

  IF v_email IS NULL OR length(v_email) = 0 OR NOT v_email_verified THEN
    RETURN;
  END IF;

  -- Atomic claim: only the first concurrent caller wins.
  -- Match restricted to rows with auth_user_id IS NULL (cannot steal an
  -- already-bound row even with the same email).
  UPDATE public.client_accounts
  SET    auth_user_id = v_uid,
         updated_at   = now()
  WHERE  lower(email)   = v_email
    AND  auth_user_id IS NULL
  RETURNING * INTO result;

  IF FOUND THEN
    RETURN NEXT result;
  END IF;
END;
$$;

REVOKE ALL  ON FUNCTION public.resolve_my_client_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_my_client_account() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger functions: add SET search_path (defense in depth)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_admin_plan_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.plan = 'admin' AND (OLD.plan IS DISTINCT FROM 'admin') THEN
    IF current_setting('request.jwt.claims', true) IS NOT NULL
       AND current_setting('request.jwt.claims', true) != '' THEN
      RAISE EXCEPTION 'Plan admin can only be assigned by system administrator'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text;
BEGIN
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  IF current_setting('request.jwt.claims', true) IS NULL
     OR current_setting('request.jwt.claims', true) = '' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role
  FROM company_members
  WHERE company_id = NEW.company_id
    AND user_id = auth.uid();

  IF caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only company owner can change member roles'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.role = 'owner' THEN
    RAISE EXCEPTION 'Owner role can only be assigned by system administrator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

-- =============================================================================
-- POST-DEPLOY VERIFICATION
-- =============================================================================
-- Run after applying:
--
-- 1. Confirm new signature:
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname = 'delete_project_hard'
--      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname='public');
--    Expected: ONE row, args = 'p_project_id uuid'
--
-- 2. Confirm check_rate_limit grants:
--    SELECT grantee, privilege_type FROM information_schema.routine_privileges
--    WHERE routine_name = 'check_rate_limit';
--    Expected: only service_role
--
-- 3. Smoke test resolve_my_client_account from authenticated session:
--    SELECT * FROM resolve_my_client_account();
--    Expected: returns 0 rows for unverified, 1 row for verified clients
-- =============================================================================
