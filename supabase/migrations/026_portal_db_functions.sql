-- =============================================================================
-- Migration 026: Portal SECURITY DEFINER functions
-- Replaces Netlify function calls. Works with anon key — no service_role_key needed.
-- =============================================================================

BEGIN;

-- ─── 1. portal_get_by_token ───────────────────────────────────────────────────
-- Returns full portal payload for a given token string.
-- SECURITY DEFINER = runs as owner, bypasses RLS on all tables.
-- Safe: only returns data for the exact token provided.
CREATE OR REPLACE FUNCTION portal_get_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok    record;
  v_est  jsonb;
  v_items jsonb;
  v_contractor jsonb;
  v_messages jsonb;
BEGIN
  -- Validate token
  SELECT * INTO tok
  FROM client_tokens
  WHERE token = p_token AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF tok.expires_at IS NOT NULL AND tok.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  -- Estimate (row_to_json is safe even if columns vary across migrations)
  SELECT COALESCE(row_to_json(e)::jsonb, '{}'::jsonb)
  INTO v_est
  FROM cost_estimates e
  WHERE e.id = tok.cost_estimate_id;

  -- Items (all columns via row_to_json — handles name/vat_rate regardless of schema version)
  SELECT COALESCE(
    jsonb_agg(row_to_json(i)::jsonb ORDER BY COALESCE((row_to_json(i)->>'sort_order')::int, 0)),
    '[]'::jsonb
  )
  INTO v_items
  FROM cost_estimate_items i
  WHERE i.cost_estimate_id = tok.cost_estimate_id;

  -- Contractor profile (only safe public fields)
  SELECT COALESCE(row_to_json(p)::jsonb, '{}'::jsonb) - ARRAY['nip','iban','address','postal_code','city']
  INTO v_contractor
  FROM profiles p
  WHERE p.id = tok.user_id;

  -- Messages
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',         m.id,
        'sender',     m.sender,
        'content',    m.content,
        'read',       m.read,
        'created_at', m.created_at
      ) ORDER BY m.created_at
    ),
    '[]'::jsonb
  )
  INTO v_messages
  FROM portal_messages m
  WHERE m.token_id = tok.id;

  RETURN jsonb_build_object(
    'token', jsonb_build_object(
      'id',          tok.id,
      'client_name', tok.client_name,
      'expires_at',  tok.expires_at
    ),
    'estimate', COALESCE(v_est, '{}'::jsonb) || jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb)),
    'contractor', COALESCE(v_contractor, '{}'::jsonb),
    'messages',   COALESCE(v_messages, '[]'::jsonb)
  );
END;
$$;

-- ─── 2. portal_send_message ───────────────────────────────────────────────────
-- Inserts a message for the given token.
-- For anon callers (clients): forces sender = 'client'.
-- For authenticated callers (company): allows sender = 'company'.
CREATE OR REPLACE FUNCTION portal_send_message(p_token text, p_content text, p_sender text DEFAULT 'client')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok   record;
  v_msg record;
  v_sender text;
BEGIN
  -- Enforce sender based on caller role
  v_sender := CASE
    WHEN auth.role() = 'anon' THEN 'client'
    WHEN p_sender IN ('client', 'company') THEN p_sender
    ELSE 'client'
  END;

  SELECT * INTO tok FROM client_tokens WHERE token = p_token AND active = true LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF tok.expires_at IS NOT NULL AND tok.expires_at < NOW() THEN RETURN jsonb_build_object('error', 'expired'); END IF;

  -- Rate limit: 30 messages per hour per token
  IF (
    SELECT COUNT(*) FROM portal_messages
    WHERE token_id = tok.id AND created_at > NOW() - INTERVAL '1 hour'
  ) >= 30 THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  IF trim(p_content) = '' THEN
    RETURN jsonb_build_object('error', 'empty_message');
  END IF;

  INSERT INTO portal_messages (token_id, sender, content, read)
  VALUES (tok.id, v_sender, trim(p_content), false)
  RETURNING * INTO v_msg;

  RETURN jsonb_build_object('ok', true, 'id', v_msg.id, 'created_at', v_msg.created_at);
END;
$$;

-- ─── 3. portal_decide ────────────────────────────────────────────────────────
-- Client accepts or rejects the estimate for the given token.
CREATE OR REPLACE FUNCTION portal_decide(p_token text, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok record;
BEGIN
  SELECT * INTO tok FROM client_tokens WHERE token = p_token AND active = true LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF tok.expires_at IS NOT NULL AND tok.expires_at < NOW() THEN RETURN jsonb_build_object('error', 'expired'); END IF;
  IF p_decision NOT IN ('accepted', 'rejected') THEN RETURN jsonb_build_object('error', 'invalid_decision'); END IF;

  UPDATE cost_estimates SET status = p_decision WHERE id = tok.cost_estimate_id;

  INSERT INTO portal_messages (token_id, sender, content, read)
  VALUES (
    tok.id,
    'client',
    CASE WHEN p_decision = 'accepted'
      THEN '✅ Klient zaakceptował kosztorys'
      ELSE '❌ Klient odrzucił kosztorys'
    END,
    false
  );

  RETURN jsonb_build_object('ok', true, 'status', p_decision);
END;
$$;

-- ─── 4. GRANT to anon + authenticated ────────────────────────────────────────
GRANT EXECUTE ON FUNCTION portal_get_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION portal_get_by_token(text) TO authenticated;

GRANT EXECUTE ON FUNCTION portal_send_message(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION portal_send_message(text, text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION portal_decide(text, text) TO anon;
GRANT EXECUTE ON FUNCTION portal_decide(text, text) TO authenticated;

-- ─── 5. Fix portal_messages SELECT/INSERT/UPDATE policies ────────────────────
-- Add user_id fallback so legacy-mode users (no company_id) still see their messages

DROP POLICY IF EXISTS portal_messages_select_company ON portal_messages;
CREATE POLICY portal_messages_select_company ON portal_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_tokens t
      WHERE t.id = portal_messages.token_id
        AND (t.company_id = my_company_id() OR t.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS portal_messages_insert_company ON portal_messages;
CREATE POLICY portal_messages_insert_company ON portal_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender = 'company'
    AND EXISTS (
      SELECT 1 FROM client_tokens t
      WHERE t.id = token_id
        AND (t.company_id = my_company_id() OR t.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS portal_messages_update_company ON portal_messages;
CREATE POLICY portal_messages_update_company ON portal_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_tokens t
      WHERE t.id = portal_messages.token_id
        AND (t.company_id = my_company_id() OR t.user_id = auth.uid())
    )
  );

-- ─── 6. Fix client_tokens SELECT policy — add user_id fallback ───────────────
DROP POLICY IF EXISTS client_tokens_select_company ON client_tokens;
CREATE POLICY client_tokens_select_company ON client_tokens
  FOR SELECT TO authenticated
  USING (
    company_id = my_company_id()
    OR user_id = auth.uid()
  );

-- Fix INSERT policy — add user_id fallback for legacy mode
DROP POLICY IF EXISTS client_tokens_insert_company ON client_tokens;
CREATE POLICY client_tokens_insert_company ON client_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = my_company_id() AND my_role() IN ('owner', 'admin', 'manager'))
    OR (company_id IS NULL AND user_id = auth.uid())
  );

-- Fix UPDATE policy — add user_id fallback
DROP POLICY IF EXISTS client_tokens_update_company ON client_tokens;
CREATE POLICY client_tokens_update_company ON client_tokens
  FOR UPDATE TO authenticated
  USING (
    company_id = my_company_id()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    company_id = my_company_id()
    OR user_id = auth.uid()
  );

COMMIT;
