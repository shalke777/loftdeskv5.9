-- =============================================================================
-- Migration 165: get_session_context — invite-priority company selection
-- =============================================================================
-- Problem:
--   get_session_context() resolves company via ORDER BY cm.created_at DESC.
--   If a ghost membership exists with a NEWER created_at than the invited
--   membership (common when bootstrap raced before mig 162/163 applied),
--   the ghost wins — user sees wrong company / owner role.
--
-- Fix (minimal):
--   Add a secondary sort key: membership backed by an accepted invitation
--   for this user's email is prioritized (sort value 1→0 wins) over any
--   non-invite membership (ghost, bootstrap, etc.), regardless of created_at.
--
-- Before:
--   ORDER BY cm.created_at DESC
--   → ghost (newer) wins over invited (older)
--
-- After:
--   ORDER BY
--     (invited membership exists for this email) DESC,   -- invite wins
--     cm.created_at DESC                                  -- tiebreak: newest
--   → invited company ALWAYS wins regardless of created_at
--
-- No schema change. STABLE function replaced with SECURITY DEFINER, same
-- contract. Fully backward compatible: users with a single membership are
-- unaffected (no invite row → sort key = false = 0 for all rows, created_at wins).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_session_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_email         text := lower(auth.jwt() ->> 'email');
  v_company_id    uuid;
  v_role          text;
  v_since         timestamptz;
  v_company       jsonb;
  v_client_cid    uuid;
BEGIN
  -- ── 1. Operator path: company_members, invite-backed membership wins ─────────
  -- Primary sort: membership in a company where this user's email has an
  -- accepted invitation ranks first (true > false in PostgreSQL DESC).
  -- Secondary sort: newest membership wins (tiebreak for non-invite memberships).
  SELECT cm.company_id, cm.role, cm.created_at
  INTO   v_company_id, v_role, v_since
  FROM   public.company_members cm
  WHERE  cm.user_id = v_uid
  ORDER BY
    -- Invite-backed: accepted invitation for this email in this company.
    -- Guarantees invited company beats any ghost membership from bootstrap race.
    (
      v_email IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.company_invitations ci
        WHERE  ci.company_id = cm.company_id
          AND  lower(ci.email) = v_email
          AND  ci.status       = 'accepted'
      )
    ) DESC,
    cm.created_at DESC
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
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
  'Migration 165: Invite-priority company selection. '
  'ORDER BY: invite-backed membership (accepted invitation for this email) DESC, '
  'then created_at DESC. Guarantees invited company wins over ghost membership '
  'from bootstrap race, regardless of created_at ordering. '
  'Single authority session resolver — SECURITY DEFINER, anchored to auth.uid().';

COMMIT;

NOTIFY pgrst, 'reload schema';
