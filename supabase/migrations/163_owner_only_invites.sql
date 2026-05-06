-- filepath: supabase/migrations/163_owner_only_invites.sql
-- =============================================================================
-- Migration 163: owner-only invitations + NULL role guard + bootstrap Guard 0
-- =============================================================================
-- Three hardening measures:
--
--  1. RLS: only role='owner' may INSERT into company_invitations.
--     Migration 144 allowed both 'owner' and 'admin'. Admin can now invite
--     only through an owner — least-privilege principle.
--
--  2. accept_company_invitation: NULL role in invitation row → hard exception.
--     Replaces COALESCE(v_role, 'worker') in both Phase 1 and Phase 2.
--     A NULL role indicates a corrupted or manually inserted row — it must
--     never silently become 'worker' without operator awareness.
--
--  3. bootstrap_my_company: Guard 0 — historical owner check.
--     Before looking at company_members, check companies.owner_user_id.
--     Prevents ghost company creation for users whose membership row was
--     deleted (e.g. via admin cleanup) while they still own a company.
--
-- Idempotent: OR REPLACE throughout.
-- =============================================================================

BEGIN;

-- ── 1. Replace invitation INSERT policy: owner ONLY ──────────────────────────
-- Drop the mig-144 policy that allowed 'owner' OR 'admin'.
DROP POLICY IF EXISTS "Owners and admins can insert invitations" ON public.company_invitations;
DROP POLICY IF EXISTS "Owners can insert invitations" ON public.company_invitations;

CREATE POLICY "Owners can insert invitations"
  ON public.company_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM public.company_members
                  WHERE user_id = auth.uid()
                    AND role    = 'owner'
                  LIMIT 1)
  );

-- ── 2. accept_company_invitation: NULL role → EXCEPTION ─────────────────────
-- Supersedes migration 162 for this function.
-- COALESCE(v_role, 'worker') removed — NULL role is a hard error.
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
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'INVALID_INVITATION_ROLE'
        USING DETAIL = 'Invitation row has NULL role — cannot accept.';
    END IF;

    INSERT INTO public.company_members (user_id, company_id, role)
    VALUES (auth.uid(), v_company_id, v_role)
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
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'INVALID_INVITATION_ROLE'
        USING DETAIL = 'Already-accepted invitation row has NULL role.';
    END IF;

    -- Heal any orphan membership (ON CONFLICT safe for concurrent calls)
    INSERT INTO public.company_members (user_id, company_id, role)
    VALUES (auth.uid(), v_company_id, v_role)
    ON CONFLICT (user_id, company_id) DO NOTHING;

    RETURN v_company_id;
  END IF;

  RAISE EXCEPTION 'Invalid or expired invitation';
END;
$$;

ALTER FUNCTION public.accept_company_invitation(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.accept_company_invitation(text) TO authenticated;

COMMENT ON FUNCTION public.accept_company_invitation(text) IS
  'Migration 163: NULL role in invitation row raises INVALID_INVITATION_ROLE '
  'in both Phase 1 (pending accept) and Phase 2 (idempotent heal). '
  'COALESCE fallback removed — silent worker promotion no longer possible.';

-- ── 3. bootstrap_my_company: add Guard 0 (historical owner check) ────────────
-- Supersedes migration 162 for this function.
-- Guard 0 must run before Guard 1 to catch the edge case where
-- company_members row was deleted but the company still exists with
-- this user as owner_user_id.
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

  -- Guard 1: Already a member of any company → idempotent return.
  -- Must run first: covers invited users who have accepted the invite
  -- (company_members row exists) — must not fall through to Guard 0 which
  -- could return a stale ghost company owned by this user.
  SELECT company_id INTO v_company_id
  FROM   public.company_members
  WHERE  user_id = v_user_id
  LIMIT  1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  -- Guard 2: Pending or recently-accepted invite → skip bootstrap entirely.
  -- Prevents ghost company creation during PgBouncer race window.
  -- Must run BEFORE Guard 0 so an invited user with a pre-existing ghost
  -- company (owner_user_id match) is blocked here, not returned as owner.
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
      RETURN NULL;
    END IF;
  END IF;

  -- Guard 0: Previously created a company (owner_user_id match) → restore membership.
  -- Handles edge case: company_members deleted but company still exists.
  -- Runs AFTER Guard 2 — only reached when no pending/recent invite exists,
  -- meaning user is a genuine owner re-entering (not an invited worker).
  SELECT id INTO v_company_id
  FROM   public.companies
  WHERE  owner_user_id = v_user_id
  LIMIT  1;

  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (v_company_id, v_user_id, 'owner')
    ON CONFLICT (company_id, user_id) DO NOTHING;
    RETURN v_company_id;
  END IF;

  -- No membership, no invite, no prior ownership → bootstrap a new company.
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
  'Migration 163: Bootstrap a new company. '
  'Guard 1: already a company_members row → idempotent return (invited users handled here). '
  'Guard 2: pending or recently-accepted invite → return NULL (race guard, BEFORE Guard 0). '
  'Guard 0: previously owned a company (companies.owner_user_id) → restore membership (only after no invite). '
  'Creates company + owner membership only for genuine new users.';

COMMIT;

NOTIFY pgrst, 'reload schema';
