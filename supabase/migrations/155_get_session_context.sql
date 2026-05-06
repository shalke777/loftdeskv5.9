-- =============================================================================
-- Migration 155: get_session_context() — Single Authority Session Resolver
-- =============================================================================
-- Sprint B: eliminates the multi-decision-layer problem.
--
-- BEFORE (Sprint A state):
--   • backend.ts:resolveSupabaseSession() — 3-4 separate DB queries
--   • dataScope.ts:getDataScope() — separate company_members query per API call
--   • permissions.ts — reads stale cached SessionUser
--   • RLS my_role() — evaluates business logic inside policies
--
-- AFTER (Sprint B):
--   • get_session_context() = SINGLE source of truth for company/role/plan/scope
--   • One roundtrip, SECURITY DEFINER, deterministic, cacheable
--   • JSONB return — no schema migration coupling, easy evolution
--
-- SESSION INVARIANT (enforced by architecture):
--   • backend.ts MUST NOT query companies directly after this migration
--   • dataScope.ts MUST be adapter-only (no fallback/secondary DB logic)
--   • permissions.ts MUST be pure function (no DB queries)
--   • RLS MUST NOT evaluate role logic (my_role() removal in mig 156)
--
-- Return shape:
--   {
--     "company_id":        uuid,
--     "company_name":      text,
--     "company":           { ...full companies row... },
--     "membership_role":   "owner"|"admin"|"manager"|"worker"|"accountant"|"client"|null,
--     "membership_since":  timestamptz|null,
--     "is_client":         boolean,
--     "client_company_id": uuid|null
--   }
--
-- Null company_id = new user, no membership yet → frontend routes to onboarding.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_session_context()
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS on companies and company_members.
-- Safe because all access is anchored to auth.uid() — a user can only ever
-- see their OWN company row and their OWN membership.
--
-- Bootstrap logic is deliberately NOT included here. Bootstrap is a separate
-- RPC (bootstrap_my_company) triggered during onboarding — it must never
-- influence the runtime context resolution path.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_session_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_company_id    uuid;
  v_role          text;
  v_since         timestamptz;
  v_company       jsonb;
  v_client_cid    uuid;
BEGIN
  -- ── 1. Operator path: company_members, newest wins ──────────────────────────
  SELECT cm.company_id, cm.role, cm.created_at
  INTO   v_company_id, v_role, v_since
  FROM   public.company_members cm
  WHERE  cm.user_id = v_uid
  ORDER  BY cm.created_at DESC
  LIMIT  1;

  IF v_company_id IS NOT NULL THEN
    -- Load full company row as jsonb (all columns, no DTO reduction)
    SELECT to_jsonb(c.*)
    INTO   v_company
    FROM   public.companies c
    WHERE  c.id = v_company_id;

    RETURN jsonb_build_object(
      'company_id',        v_company_id,
      'company_name',      v_company->>'name',
      'company',           v_company,
      'membership_role',   v_role,
      'membership_since',  v_since,
      'is_client',         false,
      'client_company_id', null
    );
  END IF;

  -- ── 2. Client path: client_accounts ─────────────────────────────────────────
  SELECT ca.company_id
  INTO   v_client_cid
  FROM   public.client_accounts ca
  WHERE  ca.auth_user_id = v_uid
  LIMIT  1;

  IF v_client_cid IS NOT NULL THEN
    RETURN jsonb_build_object(
      'company_id',        v_client_cid,
      'company_name',      'Portal klienta',
      'company',           null,
      'membership_role',   'client',
      'membership_since',  null,
      'is_client',         true,
      'client_company_id', v_client_cid
    );
  END IF;

  -- ── 3. New user: no membership, no client_accounts ──────────────────────────
  -- Return null company_id. Frontend routes to onboarding.
  -- Bootstrap (bootstrap_my_company RPC) is called separately from UI,
  -- then session is refreshed — NOT called here.
  RETURN jsonb_build_object(
    'company_id',        null,
    'company_name',      null,
    'company',           null,
    'membership_role',   null,
    'membership_since',  null,
    'is_client',         false,
    'client_company_id', null
  );
END;
$$;

ALTER FUNCTION public.get_session_context() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_session_context() TO authenticated;

COMMENT ON FUNCTION public.get_session_context() IS
  'Migration 155: Single authority session resolver. '
  'Returns jsonb snapshot of {company, membership_role, company_id, is_client} '
  'for the currently authenticated user. SECURITY DEFINER — safe because all '
  'access is anchored to auth.uid(). One roundtrip replaces: resolveSupabaseSession(), '
  'getDataScope(), get_my_company_billing(). Bootstrap (bootstrap_my_company) is '
  'called separately and is NOT part of this resolution path.';

COMMIT;

NOTIFY pgrst, 'reload schema';
