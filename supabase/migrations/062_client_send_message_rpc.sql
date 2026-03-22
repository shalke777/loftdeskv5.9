-- =============================================================================
-- Migration 062: client_send_message — SECURITY DEFINER RPC
-- =============================================================================
-- Root cause of broken client portal messaging:
--   project_messages.thread_id is NOT NULL (migration 034) but the frontend
--   clientPortalApi.sendMessage() did a direct INSERT without thread_id.
--   Result: every message send failed with DB constraint violation.
--
-- Why a SECURITY DEFINER RPC is needed (not a direct client INSERT):
--   1. Clients must reference a valid project_threads row via thread_id.
--   2. Clients have NO INSERT policy on project_threads (only SELECT on
--      client_shared/approval threads — migration 042).
--   3. Therefore the RPC runs as the function owner (superuser = BYPASSRLS),
--      finds or auto-creates a client_shared thread for the project, then
--      inserts the message with the correct thread_id.
--
-- Security guarantees maintained:
--   - Caller must be an authenticated Supabase user (auth.uid() not null).
--   - Caller must have a client_accounts row for company_id (multi-tenant).
--   - Caller must have project_client_access for project_id.
--   - sender_type is hard-coded 'client' — cannot be impersonated.
--   - visibility is hard-coded 'client_shared' — no internal leakage.
--   - Body is trimmed and cannot be empty.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.client_send_message(
  p_project_id  uuid,
  p_company_id  uuid,
  p_body        text,
  p_sender_name text DEFAULT NULL
)
RETURNS uuid   -- returns new message id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id  uuid;
  v_message_id uuid;
  v_name       text;
BEGIN
  -- 1. Verify caller is an authenticated client with access to this exact project
  IF NOT EXISTS (
    SELECT 1
    FROM   public.project_client_access pca
    JOIN   public.client_accounts       ca  ON ca.id = pca.client_account_id
    WHERE  ca.auth_user_id = auth.uid()
      AND  pca.project_id  = p_project_id
      AND  ca.company_id   = p_company_id
  ) THEN
    RAISE EXCEPTION 'access_denied'
      USING HINT = 'Brak dostępu do tego projektu.', ERRCODE = 'P0001';
  END IF;

  -- 2. Validate body
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'bad_request'
      USING HINT = 'Wiadomość nie może być pusta.', ERRCODE = 'P0002';
  END IF;

  -- 3. Resolve sender name (fallback to 'Klient')
  v_name := coalesce(nullif(trim(p_sender_name), ''), 'Klient');

  -- 4. Find an existing client_shared thread for this project (oldest first)
  SELECT id INTO v_thread_id
  FROM   public.project_threads
  WHERE  project_id = p_project_id
    AND  company_id = p_company_id
    AND  visibility  = 'client_shared'
    AND  archived    = false
  ORDER BY created_at ASC
  LIMIT  1;

  -- 5. If no thread exists, create one automatically
  --    (SECURITY DEFINER bypasses the INSERT RLS gap for clients)
  IF v_thread_id IS NULL THEN
    INSERT INTO public.project_threads
      (company_id, project_id, type, visibility, title)
    VALUES
      (p_company_id, p_project_id, 'general', 'client_shared', 'Chat z klientem')
    RETURNING id INTO v_thread_id;
  END IF;

  -- 6. Insert the message with correct thread_id
  INSERT INTO public.project_messages
    (thread_id, company_id, project_id,
     sender_type, sender_name,
     body, visibility,
     read_by_client, read_by_operator)
  VALUES
    (v_thread_id, p_company_id, p_project_id,
     'client', v_name,
     trim(p_body), 'client_shared',
     true,   -- client reads their own message
     false)  -- marks as unread for operator
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

-- Grant to authenticated role only (clients use their Supabase session JWT)
GRANT EXECUTE ON FUNCTION public.client_send_message(uuid, uuid, text, text) TO authenticated;

COMMIT;
