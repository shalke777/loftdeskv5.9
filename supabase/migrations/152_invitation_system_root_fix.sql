-- =============================================================================
-- Migration 152: Invitation system ROOT FIX (consolidated)
-- =============================================================================
-- Supersedes migrations 145, 148, 149, 150, 151 for invitation/membership logic.
-- (Old migration files remain in repo for git history; not removed.)
--
-- Goal: deterministic auth resolution. DB is the only source of truth.
--   * Newest membership wins (ORDER BY created_at DESC)
--   * Invited users with a membership ALWAYS resolve to operator role
--   * No localStorage hints, no client-side fallback logic
--   * accept_company_invitation is idempotent and self-healing
--
-- Apply via Supabase SQL editor. If a deadlock (40P01) occurs on policy DROP/
-- CREATE, just retry the same statement — Supabase serializes RLS edits.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.1  my_company_id() — newest membership wins
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER is REQUIRED — otherwise calling this from RLS on
-- company_members causes infinite recursion (RLS → my_company_id → RLS …).
-- Established in migration 080 and re-asserted here.
CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM   public.company_members
  WHERE  user_id = auth.uid()
  ORDER  BY created_at DESC
  LIMIT  1
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.2  RLS on company_members — own rows only
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS members_select_own_rows ON public.company_members;
DROP POLICY IF EXISTS members_insert_own      ON public.company_members;

CREATE POLICY members_select_own_rows
  ON public.company_members
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY members_insert_own
  ON public.company_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.3  Companies readable for any active member
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS companies_select_for_members ON public.companies;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.4  accept_company_invitation — atomic, idempotent, self-healing
-- ─────────────────────────────────────────────────────────────────────────────
-- Param name kept as `invite_token` for backward compatibility with existing
-- callers (frontend settings.api.ts + Netlify functions).
CREATE OR REPLACE FUNCTION public.accept_company_invitation(invite_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_role       text;
BEGIN
  -- Look up a valid pending invitation; allow accepted re-acceptance to
  -- self-heal a missing membership row (idempotent).
  SELECT company_id, role
  INTO   v_company_id, v_role
  FROM   public.company_invitations
  WHERE  token = invite_token
    AND  status IN ('pending', 'accepted')
    AND  (expires_at IS NULL OR expires_at > now());

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Ensure membership exists. ON CONFLICT DO NOTHING makes this idempotent.
  INSERT INTO public.company_members (user_id, company_id, role)
  VALUES (auth.uid(), v_company_id, COALESCE(v_role, 'worker'))
  ON CONFLICT (user_id, company_id) DO NOTHING;

  -- Mark invitation accepted (only if currently pending).
  UPDATE public.company_invitations
  SET    status      = 'accepted',
         accepted_at = now()
  WHERE  token = invite_token
    AND  status = 'pending';

  RETURN v_company_id;
END;
$$;

ALTER FUNCTION public.accept_company_invitation(text) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.accept_company_invitation(text) TO authenticated;

COMMENT ON FUNCTION public.accept_company_invitation(text) IS
  'Migration 152: idempotent invitation acceptance. Inserts (or heals) company_members row for auth.uid(), marks invitation accepted. SECURITY DEFINER bypasses members_insert RLS.';

COMMIT;

NOTIFY pgrst, 'reload schema';
