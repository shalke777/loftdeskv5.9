-- =============================================================================
-- Migration 162: accepted_at column + bootstrap_my_company invite guard
-- =============================================================================
-- Two problems addressed:
--
--  1. company_invitations missing accepted_at column.
--     Migration 152 referenced `accepted_at` in its UPDATE statement but never
--     ALTERed the table to add the column — the UPDATE silently referenced a
--     non-existent column (or caused migration 152 to fail on some instances).
--     This migration adds the column idempotently and back-fills it.
--
--  2. bootstrap_my_company() had no invite guard.
--     Race scenario:
--       a) accept_company_invitation() RPC succeeds → invite 'accepted',
--          company_members row inserted (T1)
--       b) PgBouncer serves stale connection → get_session_context() returns null
--       c) Frontend invite guard checked status='pending' only → not found
--       d) bootstrap_my_company() fired → ghost company created (role='owner', T2)
--       e) ORDER BY created_at DESC LIMIT 1 → T2 > T1 → ghost company wins
--       f) User stuck as OWNER of empty ghost company, never reaches invited company
--
--     Fix: add invite check INSIDE bootstrap_my_company itself (DB-level,
--     authoritative, cannot be bypassed by any frontend race).
--
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE / default guards.
-- =============================================================================

BEGIN;

-- ── 1. Add accepted_at column to company_invitations ─────────────────────────
ALTER TABLE public.company_invitations
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Back-fill: set accepted_at ≈ updated_at for existing accepted rows.
-- If updated_at doesn't exist, fall back to created_at (pessimistic — means
-- the race guard window will not trigger for old rows, which is correct because
-- old accepted rows already have valid company_members entries).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'company_invitations'
      AND column_name  = 'updated_at'
  ) THEN
    UPDATE public.company_invitations
    SET    accepted_at = updated_at
    WHERE  status      = 'accepted'
      AND  accepted_at IS NULL;
  ELSE
    -- No updated_at — leave accepted_at NULL for historic rows (intentional).
    -- The bootstrap guard only blocks bootstrap for accepted_at IS NOT NULL AND recent.
    -- Old rows (accepted_at IS NULL) are assumed resolved (company_members exists).
    NULL;
  END IF;
END;
$$;

-- ── 2. Update accept_company_invitation to set accepted_at ───────────────────
-- Supersedes migrations 009, 145, 152 for this function.
-- Behavioral changes from 152:
--   • Sets accepted_at = now() (new column)
--   • ON CONFLICT for company_members reverted to DO NOTHING (idempotent, role
--     already correct from invite row — DO UPDATE could demote a promoted user)
CREATE OR REPLACE FUNCTION public.accept_company_invitation(invite_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_role       text;
BEGIN
  -- Phase 1: pending invite (normal accept path)
  SELECT company_id, role
  INTO   v_company_id, v_role
  FROM   public.company_invitations
  WHERE  token      = invite_token
    AND  status     = 'pending'
    AND  (expires_at IS NULL OR expires_at > now());

  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_members (user_id, company_id, role)
    VALUES (auth.uid(), v_company_id, COALESCE(v_role, 'worker'))
    ON CONFLICT (user_id, company_id) DO NOTHING;

    UPDATE public.company_invitations
    SET    status      = 'accepted',
           accepted_at = now()
    WHERE  token  = invite_token
      AND  status = 'pending';

    RETURN v_company_id;
  END IF;

  -- Phase 2: already-accepted invite (idempotent retry / race / two-tab)
  SELECT company_id, role
  INTO   v_company_id, v_role
  FROM   public.company_invitations
  WHERE  token  = invite_token
    AND  status = 'accepted';

  IF v_company_id IS NOT NULL THEN
    -- Heal any orphan membership (ON CONFLICT safe for concurrent calls)
    INSERT INTO public.company_members (user_id, company_id, role)
    VALUES (auth.uid(), v_company_id, COALESCE(v_role, 'worker'))
    ON CONFLICT (user_id, company_id) DO NOTHING;

    RETURN v_company_id;
  END IF;

  RAISE EXCEPTION 'Invalid or expired invitation';
END;
$$;

ALTER FUNCTION public.accept_company_invitation(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.accept_company_invitation(text) TO authenticated;

COMMENT ON FUNCTION public.accept_company_invitation(text) IS
  'Migration 162: idempotent invitation acceptance. Phase-1 accepts pending '
  'invites and sets accepted_at. Phase-2 heals orphan memberships for already-'
  'accepted invites. SECURITY DEFINER — bypasses RLS on company_members.';

-- ── 3. Update bootstrap_my_company with DB-level invite guard ────────────────
-- CRITICAL FIX: before creating a new company, check for pending OR recently
-- accepted invitations (within 10 min). This eliminates the ghost company race
-- even when the frontend invite guard is bypassed by a PgBouncer stale connection.
--
-- Logic:
--   • pending invite → bootstrap blocked (user will accept via /join/<token>)
--   • accepted_at IS NOT NULL AND > now()-10min → bootstrap blocked (race window)
--   • accepted_at IS NULL (old, pre-162 rows) → bootstrap allowed (resolved)
--   • accepted_at IS NOT NULL AND old → bootstrap allowed (user left company, legitimate)
--
-- When bootstrap is blocked, returns NULL (no company_id). Frontend handles
-- NULL bootstrap result by treating the user as "not yet resolved" → returns
-- { user: null } → app shows loading/waiting state until session stabilizes.
CREATE OR REPLACE FUNCTION public.bootstrap_my_company(
  company_name text DEFAULT NULL,
  company_nip  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_company_id uuid;
  v_email      text;
  v_profile    record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Guard 1: Already a member → idempotent return
  SELECT company_id INTO v_company_id
  FROM   public.company_members
  WHERE  user_id = v_user_id
  LIMIT  1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  -- Guard 2: Pending or recently-accepted invite → skip bootstrap.
  -- Prevents ghost company creation during PgBouncer race window.
  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.company_invitations
      WHERE  lower(email) = v_email
        AND  (
          status = 'pending'
          OR (
            status      = 'accepted'
            AND accepted_at IS NOT NULL
            AND accepted_at > now() - interval '10 minutes'
          )
        )
    ) THEN
      -- Return NULL: user has a pending or very recent invite.
      -- Frontend (backend.ts) treats NULL bootstrap result as "no company yet"
      -- and routes user to null/loading until session stabilizes.
      RETURN NULL;
    END IF;
  END IF;

  -- No membership, no invite → bootstrap a new company
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.companies (owner_user_id, name, nip, plan)
  VALUES (
    v_user_id,
    coalesce(nullif(company_name, ''), nullif(v_profile.company, ''),
             nullif(v_profile.full_name, ''), 'LoftDesk Workspace'),
    coalesce(nullif(company_nip, ''), nullif(v_profile.nip, '')),
    coalesce(v_profile.plan, 'free')
  )
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (v_company_id, v_user_id, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  UPDATE public.clients        SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;
  UPDATE public.projects       SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;
  UPDATE public.cost_estimates SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;
  UPDATE public.invoices       SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;
  UPDATE public.contracts      SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;

  RETURN v_company_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.bootstrap_my_company(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_my_company(text, text) TO authenticated;

COMMENT ON FUNCTION public.bootstrap_my_company(text, text) IS
  'Migration 162: Bootstrap a new company for a user with no membership. '
  'Guard 1: already has company_members → idempotent return. '
  'Guard 2: has pending or recently-accepted invite → return NULL (race guard). '
  'Creates company + owner membership only for genuine new users. '
  'SECURITY DEFINER — safe because all access is anchored to auth.uid().';

COMMIT;

NOTIFY pgrst, 'reload schema';
