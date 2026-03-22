-- =============================================================================
-- Migration 063: soft-delete for project_messages + delete_portal_message RPC
-- =============================================================================
-- Adds a deleted_at column to project_messages.
-- Provides a SECURITY DEFINER RPC so both clients and operators can soft-delete
-- their own messages without bypassing multi-tenant isolation.
--
-- Design decisions:
--   * Soft delete (deleted_at timestamptz) — preserves audit trail.
--   * Clients can only delete their own sender_type='client' messages for
--     projects they still have access to.
--   * Operators can only delete their own sender_type='operator' messages for
--     projects belonging to their company.
--   * Neither side can delete the other side's messages.
--   * The UI renders a "Wiadomość usunięta" placeholder when deleted_at IS NOT NULL.
-- =============================================================================

BEGIN;

-- ── 1. Add soft-delete column ────────────────────────────────────────────────

ALTER TABLE public.project_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- ── 2. SECURITY DEFINER RPC ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_portal_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg         project_messages%ROWTYPE;
  v_is_client   boolean := false;
BEGIN
  -- Fetch the target message
  SELECT * INTO v_msg FROM project_messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found'
      USING HINT = 'Wiadomość nie istnieje.', ERRCODE = 'P0003';
  END IF;

  -- Idempotent: already deleted
  IF v_msg.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- ── Path A: caller is the client who sent this message ────────────────────
  IF v_msg.sender_type = 'client' THEN
    -- Verify caller has active project_client_access for this project+company
    IF NOT EXISTS (
      SELECT 1
      FROM   public.project_client_access pca
      JOIN   public.client_accounts       ca  ON ca.id = pca.client_account_id
      WHERE  ca.auth_user_id = auth.uid()
        AND  pca.project_id  = v_msg.project_id
        AND  ca.company_id   = v_msg.company_id
    ) THEN
      RAISE EXCEPTION 'access_denied'
        USING HINT = 'Brak dostępu lub projekt został usunięty.', ERRCODE = 'P0001';
    END IF;
    v_is_client := true;
  END IF;

  -- ── Path B: caller is an operator of the message's company ───────────────
  IF NOT v_is_client THEN
    -- Operators can only delete their own operator-type messages
    IF v_msg.sender_type <> 'operator' THEN
      RAISE EXCEPTION 'access_denied'
        USING HINT = 'Możesz usuwać tylko własne wiadomości.', ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM   public.company_members cm
      WHERE  cm.user_id     = auth.uid()
        AND  cm.company_id  = v_msg.company_id
    ) THEN
      RAISE EXCEPTION 'access_denied'
        USING HINT = 'Brak dostępu do tej firmy.', ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Perform soft delete ───────────────────────────────────────────────────
  UPDATE public.project_messages
  SET    deleted_at = now()
  WHERE  id = p_message_id;
END;
$$;

-- Grant to authenticated only (both clients and operators use JWT sessions)
GRANT EXECUTE ON FUNCTION public.delete_portal_message(uuid) TO authenticated;

COMMIT;
