-- =============================================================================
-- 145 — Harden accept_company_invitation RPC: idempotency + search_path
-- =============================================================================
-- Problem:
--   The existing function (mig 009) only reads invitations with status='pending'
--   and expires_at > now().  If a user calls it twice (two tabs, retry, race
--   condition), the second call lands on a row with status='accepted' and
--   raises INVITATION_NOT_FOUND — even though the user IS already a member.
--
--   This breaks:
--   • AcceptInvitationPage auto-accept in multiple tabs — second tab errors out
--   • finalizeInviteIfNeeded() after login when token was accepted by tab #1
--   • Any retry after a transient network failure on the first attempt
--
-- Fix:
--   Two-phase lookup:
--     1. Try pending  → normal accept flow (unchanged behaviour)
--     2. Try accepted → heal or confirm membership; return company_id silently
--     3. Neither      → raise INVITATION_NOT_FOUND (truly invalid/expired)
--
--   Also adds SET search_path = '' (security hardening, per mig 058 pattern)
--   and uses fully-qualified table names throughout.
--
-- Safety:
--   • UNIQUE(company_id, user_id) on company_members (mig 001) prevents
--     duplicate rows even if two calls reach INSERT simultaneously.
--   • ON CONFLICT … DO UPDATE means concurrent race always leaves exactly
--     one row with the correct role.
--   • No data exposed: function is SECURITY DEFINER, anchored to auth.uid().
--   • The "heal" path on already-accepted invite is safe: it either confirms
--     an existing row (ON CONFLICT) or inserts one that somehow went missing.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_company_invitation(invite_token text)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  invite_row public.company_invitations%ROWTYPE;
  cur_user   uuid;
BEGIN
  cur_user := auth.uid();
  IF cur_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- ── Phase 1: pending invite (normal path) ──────────────────────────────
  SELECT * INTO invite_row
  FROM public.company_invitations
  WHERE token      = invite_token
    AND status     = 'pending'
    AND expires_at > now()
  LIMIT 1;

  IF invite_row.id IS NOT NULL THEN
    INSERT INTO public.company_members(company_id, user_id, role)
    VALUES (invite_row.company_id, cur_user, invite_row.role)
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    UPDATE public.company_invitations
    SET status = 'accepted'
    WHERE id = invite_row.id;

    RETURN invite_row.company_id;
  END IF;

  -- ── Phase 2: already-accepted invite (idempotency / retry / race) ──────
  -- This handles: second tab, network retry after success, React StrictMode
  -- double-fire, concurrent accept from login + /join page.
  SELECT * INTO invite_row
  FROM public.company_invitations
  WHERE token  = invite_token
    AND status = 'accepted'
  LIMIT 1;

  IF invite_row.id IS NOT NULL THEN
    -- Ensure membership row exists (heal any orphan state).
    -- ON CONFLICT makes this safe for concurrent concurrent calls.
    INSERT INTO public.company_members(company_id, user_id, role)
    VALUES (invite_row.company_id, cur_user, invite_row.role)
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    RETURN invite_row.company_id;
  END IF;

  -- ── Phase 3: genuinely invalid / expired token ─────────────────────────
  RAISE EXCEPTION 'INVITATION_NOT_FOUND';
END;
$$;

-- Ensure the function is owned by postgres (not a regular user)
-- so SECURITY DEFINER runs with full privileges.
ALTER FUNCTION public.accept_company_invitation(text) OWNER TO postgres;

COMMENT ON FUNCTION public.accept_company_invitation(text) IS
  'Accept a company invitation by token. Idempotent: calling twice on the same '
  'token (already accepted) returns company_id and ensures membership exists. '
  'Raises AUTH_REQUIRED if not authenticated, INVITATION_NOT_FOUND if token is '
  'invalid, expired, or revoked.';
