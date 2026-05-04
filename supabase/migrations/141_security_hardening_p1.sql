-- =============================================================================
-- Migration 141: Phase 2.5 — P1 Defense-in-depth hardening
-- =============================================================================
-- Audit date: 2026-05-05
-- Builds on migration 140 (P0 critical fixes).
--
-- Fixes (all defense-in-depth — none currently exploitable through public API):
--
--   M-1  client_send_message      → server-derive company_id from projects table
--                                   (eliminates client-trusted p_company_id)
--   M-2  resolve_my_client_account → claim ALL unbound rows for verified email
--                                   (UX fix: multi-contractor clients)
--   L-1  bootstrap_my_company      → tighten SET search_path to (public, pg_temp)
--
-- Backward compatibility: ALL non-breaking. Same RPC signatures preserved.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- M-1 FIX: client_send_message
-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE: Authorization joined project_client_access + client_accounts and
--         required ca.company_id = p_company_id, but did NOT verify that
--         projects.company_id = p_company_id. INSERTs wrote p_company_id
--         directly into project_messages and project_threads.
--
-- AFTER:  v_company_id is derived from public.projects WHERE id = p_project_id.
--         The client_accounts join now uses v_company_id instead of p_company_id.
--         p_company_id parameter is preserved (for FE backward compat) but
--         IGNORED — server-derived value is the only trusted source.

CREATE OR REPLACE FUNCTION public.client_send_message(
  p_project_id  uuid,
  p_company_id  uuid,         -- DEPRECATED: ignored (kept for FE backward compat)
  p_body        text,
  p_sender_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_thread_id  uuid;
  v_message_id uuid;
  v_name       text;
  v_uid        uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- 1. Derive company_id strictly from the project (NOT from client input)
  SELECT company_id INTO v_company_id
  FROM   public.projects
  WHERE  id = p_project_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Verify caller has client access to this exact project under that company
  IF NOT EXISTS (
    SELECT 1
    FROM   public.project_client_access pca
    JOIN   public.client_accounts       ca  ON ca.id = pca.client_account_id
    WHERE  ca.auth_user_id = v_uid
      AND  pca.project_id  = p_project_id
      AND  ca.company_id   = v_company_id
  ) THEN
    RAISE EXCEPTION 'access_denied'
      USING HINT = 'Brak dostępu do tego projektu.', ERRCODE = 'P0001';
  END IF;

  -- 3. Validate body
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'bad_request'
      USING HINT = 'Wiadomość nie może być pusta.', ERRCODE = 'P0002';
  END IF;

  v_name := coalesce(nullif(trim(p_sender_name), ''), 'Klient');

  -- 4. Find or create client_shared thread, using server-derived company_id
  SELECT id INTO v_thread_id
  FROM   public.project_threads
  WHERE  project_id = p_project_id
    AND  company_id = v_company_id
    AND  visibility  = 'client_shared'
    AND  archived    = false
  ORDER BY created_at ASC
  LIMIT  1;

  IF v_thread_id IS NULL THEN
    INSERT INTO public.project_threads
      (company_id, project_id, type, visibility, title)
    VALUES
      (v_company_id, p_project_id, 'general', 'client_shared', 'Chat z klientem')
    RETURNING id INTO v_thread_id;
  END IF;

  -- 5. Insert message with server-derived company_id
  INSERT INTO public.project_messages
    (thread_id, company_id, project_id,
     sender_type, sender_name,
     body, visibility,
     read_by_client, read_by_operator)
  VALUES
    (v_thread_id, v_company_id, p_project_id,
     'client', v_name,
     trim(p_body), 'client_shared',
     true, false)
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.client_send_message(uuid, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_send_message(uuid, uuid, text, text)
  TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- M-2 FIX: resolve_my_client_account — claim ALL unbound rows
-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE: UPDATE ... RETURNING * INTO result claimed exactly ONE row when
--         multiple unbound client_accounts existed for the same verified email
--         (legitimate scenario: client invited by multiple contractors).
--         Subsequent contractor portals were unreachable.
--
-- AFTER:  Bulk UPDATE of all unbound rows for the verified email; SETOF return
--         emits every claimed row. Race-safe: AND auth_user_id IS NULL.

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
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- Email check (verified-only) — used by the bind step
  v_email          := lower(auth.jwt() ->> 'email');
  v_email_verified := COALESCE((auth.jwt() ->> 'email_verified')::boolean, false);

  -- Bind step: only when email is verified, atomically claim every unbound
  -- client_accounts row matching the verified email. No-op if all already bound.
  IF v_email IS NOT NULL AND length(v_email) > 0 AND v_email_verified THEN
    UPDATE public.client_accounts
    SET    auth_user_id = v_uid,
           updated_at   = now()
    WHERE  lower(email)   = v_email
      AND  auth_user_id IS NULL;
  END IF;

  -- Return ALL bound rows for this user (covers legacy bindings + freshly bound)
  RETURN QUERY
    SELECT *
    FROM   public.client_accounts
    WHERE  auth_user_id = v_uid;
END;
$$;

REVOKE ALL  ON FUNCTION public.resolve_my_client_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_my_client_account() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- L-1 FIX: bootstrap_my_company — tighten search_path
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029 set `SET search_path = public` (missing pg_temp).
-- Aligns with the rest of the SECURITY DEFINER hardening pattern.

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
  v_profile    record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT company_id INTO v_company_id
  FROM   public.company_members
  WHERE  user_id = v_user_id
  LIMIT  1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

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

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- POST-DEPLOY VERIFICATION
-- =============================================================================
-- 1. client_send_message integrity (post-deploy spot-check):
--    SELECT pm.company_id, p.company_id AS project_company,
--           CASE WHEN pm.company_id = p.company_id THEN 'OK' ELSE 'MISMATCH' END
--    FROM project_messages pm JOIN projects p ON p.id = pm.project_id
--    WHERE pm.created_at > now() - interval '7 days'
--    GROUP BY pm.company_id, p.company_id
--    HAVING pm.company_id <> p.company_id;
--    Expected: 0 rows (after deploy; existing rows untouched).
--
-- 2. resolve_my_client_account multi-row:
--    Test account with two client_accounts rows in different companies.
--    Expected: BOTH rows returned in single call.
--
-- 3. bootstrap_my_company unchanged behaviorally:
--    SELECT bootstrap_my_company();  -- idempotent for existing users
-- =============================================================================
