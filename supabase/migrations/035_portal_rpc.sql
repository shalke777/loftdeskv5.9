-- =============================================================================
-- Migration 035: Portal RPC — SECURITY DEFINER functions dla dostępu klienckiego
-- =============================================================================
-- Problem:
--   RLS policies z migr. 034 używają portal_session_project_id() / portal_session_has_scope()
--   które czytają z current_setting('app.portal_session_id', true).
--   Supabase JS client (anon) NIE może ustawiać session-level settings samodzielnie
--   bo PostgREST traktuje każdy request jako osobną transakcję.
--
-- Rozwiązanie:
--   SECURITY DEFINER functions przyjmują p_session_id jako PARAMETR.
--   Wewnątrz każdej funkcji: walidacja sesji → dostęp do danych we własnym zakresie.
--   Frontend wywołuje: supabase.rpc('portal_get_timeline', { p_session_id: sessionId })
--   Anon key jest wystarczający — funkcja i tak działa jako owner.
--
-- Bezpieczeństwo:
--   - każda funkcja waliduje istnienie sesji + active token + not expired
--   - jeśli sesja niepoprawna → zwraca NULL / '[]'::jsonb
--   - nigdy nie wycieka dane projektu bez ważnej sesji
--   - scope sprawdzany tam gdzie jest potrzebny (send_messages, respond_approvals)
-- =============================================================================

BEGIN;

-- =============================================================================
-- POMOCNICZA — walidacja sesji (inline, nie eksportowana)
-- =============================================================================
-- Używana w każdej poniższej funkcji jako DRY helper.

CREATE OR REPLACE FUNCTION public._portal_validate_session(
  p_session_id uuid,
  p_required_scope text DEFAULT NULL
)
RETURNS TABLE (project_id uuid, company_id uuid, portal_token_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT s.project_id, s.company_id, s.portal_token_id
    FROM public.project_portal_sessions s
    JOIN public.project_portal_tokens   t ON t.id = s.portal_token_id
   WHERE s.id          = p_session_id
     AND s.expires_at  > now()
     AND t.active      = true
     AND t.revoked_at IS NULL
     AND (p_required_scope IS NULL OR p_required_scope = ANY(t.scope))
   LIMIT 1;
$$;


-- =============================================================================
-- portal_get_project — minimalne dane projektu (nagłówek portalu)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.portal_get_project(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project_id uuid;
  v_company_id  uuid;
  v_result      jsonb;
BEGIN
  SELECT vt.project_id, vt.company_id INTO v_project_id, v_company_id
    FROM public._portal_validate_session(p_session_id) vt;

  IF v_project_id IS NULL THEN RETURN NULL; END IF;

  SELECT row_to_json(p)::jsonb INTO v_result
    FROM (
      SELECT id, number, name, status, start_date, end_date, address
        FROM public.projects
       WHERE id = v_project_id
         AND deleted_at IS NULL
    ) p;

  RETURN v_result;
END;
$$;


-- =============================================================================
-- portal_get_timeline — oś czasu widoczna dla klienta
-- =============================================================================

CREATE OR REPLACE FUNCTION public.portal_get_timeline(
  p_session_id uuid,
  p_limit      int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT vt.project_id INTO v_project_id
    FROM public._portal_validate_session(p_session_id, 'read_updates') vt;

  -- scope 'read_updates' — jeśli nie ma, próbuj też bez scope check
  IF v_project_id IS NULL THEN
    SELECT vt.project_id INTO v_project_id
      FROM public._portal_validate_session(p_session_id) vt;
  END IF;

  IF v_project_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(e ORDER BY e.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, event_type, title, description, actor_type, actor_name, payload, created_at
          FROM public.project_timeline_events
         WHERE project_id  = v_project_id
           AND visibility  = 'client_shared'
         ORDER BY created_at DESC
         LIMIT p_limit
      ) e
  );
END;
$$;


-- =============================================================================
-- portal_get_approvals — akceptacje powiązane z tym tokenem
-- =============================================================================

CREATE OR REPLACE FUNCTION public.portal_get_approvals(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project_id uuid;
  v_token_id   uuid;
BEGIN
  SELECT vt.project_id, vt.portal_token_id INTO v_project_id, v_token_id
    FROM public._portal_validate_session(p_session_id, 'read_approvals') vt;

  IF v_project_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(a ORDER BY a.sent_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, status,
               snapshot_amount_gross,
               snapshot_description,
               snapshot_vendor,
               snapshot_invoice_number,
               message_to_client,
               client_comment,
               response_idempotency_key,
               sent_at,
               responded_at
          FROM public.cost_approvals
         WHERE project_id     = v_project_id
           AND portal_token_id = v_token_id
         ORDER BY sent_at DESC
      ) a
  );
END;
$$;


-- =============================================================================
-- portal_get_messages — wiadomości client_shared projektu
-- =============================================================================

CREATE OR REPLACE FUNCTION public.portal_get_messages(
  p_session_id uuid,
  p_limit      int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT vt.project_id INTO v_project_id
    FROM public._portal_validate_session(p_session_id, 'read_messages') vt;

  IF v_project_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(m ORDER BY m.created_at ASC), '[]'::jsonb)
      FROM (
        SELECT id, thread_id, sender_type, sender_name, body, visibility,
               has_attachments, attachment_url, attachment_name, attachment_mime,
               read_by_operator, read_by_client, created_at
          FROM public.project_messages
         WHERE project_id = v_project_id
           AND visibility = 'client_shared'
         ORDER BY created_at ASC
         LIMIT p_limit
      ) m
  );
END;
$$;


-- =============================================================================
-- portal_send_message — wysyłka wiadomości przez klienta
-- =============================================================================

CREATE OR REPLACE FUNCTION public.portal_send_message(
  p_session_id  uuid,
  p_body        text,
  p_sender_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project_id uuid;
  v_company_id uuid;
  v_thread_id  uuid;
  v_message_id uuid;
BEGIN
  -- Walidacja sesji + scope
  SELECT vt.project_id, vt.company_id INTO v_project_id, v_company_id
    FROM public._portal_validate_session(p_session_id, 'send_messages') vt;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'portal_send_message: invalid or expired session / missing scope';
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'portal_send_message: body cannot be empty';
  END IF;

  -- Znajdź wątek general/client_shared dla projektu, lub stwórz go
  SELECT id INTO v_thread_id
    FROM public.project_threads
   WHERE project_id  = v_project_id
     AND type        = 'general'
     AND visibility  = 'client_shared'
     AND archived    = false
   LIMIT 1;

  IF v_thread_id IS NULL THEN
    INSERT INTO public.project_threads
      (company_id, project_id, type, visibility, title, created_by)
    VALUES
      (v_company_id, v_project_id, 'general', 'client_shared', 'Wiadomości z portalu klienta', NULL)
    RETURNING id INTO v_thread_id;
  END IF;

  -- Wstaw wiadomość jako 'client'
  INSERT INTO public.project_messages
    (thread_id, company_id, project_id, sender_type, sender_name, body, visibility,
     read_by_operator, read_by_client)
  VALUES
    (v_thread_id, v_company_id, v_project_id, 'client', p_sender_name, trim(p_body),
     'client_shared', false, true)
  RETURNING id INTO v_message_id;

  -- Oś czasu (fire-and-forget przez create_timeline_event który catch'uje błędy)
  PERFORM public.create_timeline_event(
    p_company_id   => v_company_id,
    p_project_id   => v_project_id,
    p_event_type   => 'client_replied',
    p_visibility   => 'internal',
    p_title        => 'Klient przesłał wiadomość: ' || left(trim(p_body), 80),
    p_actor_type   => 'client',
    p_actor_name   => p_sender_name,
    p_reference_id => v_message_id,
    p_reference_type => 'message'
  );

  RETURN v_message_id;
END;
$$;


-- =============================================================================
-- portal_respond_approval — odpowiedź klienta na akceptację
-- =============================================================================
-- Idempotentność: p_idempotency_key (wygenerowany przez frontend jako crypto.randomUUID).
-- Jeśli ten sam klucz dotrze dwa razy — zwraca 'already_processed' bez błędu.

CREATE OR REPLACE FUNCTION public.portal_respond_approval(
  p_session_id           uuid,
  p_approval_id          uuid,
  p_new_status           text,
  p_client_comment       text   DEFAULT NULL,
  p_idempotency_key      text   DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project_id     uuid;
  v_token_id       uuid;
  v_current_status text;
BEGIN
  -- Walidacja sesji + scope
  SELECT vt.project_id, vt.portal_token_id INTO v_project_id, v_token_id
    FROM public._portal_validate_session(p_session_id, 'respond_approvals') vt;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'portal_respond_approval: invalid or expired session / missing scope';
  END IF;

  -- Walidacja nowego statusu (tylko dozwolone odpowiedzi klienta)
  IF p_new_status NOT IN ('accepted', 'rejected', 'questioned') THEN
    RAISE EXCEPTION 'portal_respond_approval: invalid status %', p_new_status;
  END IF;

  -- Idempotency check — jeśli ten sam klucz już był użyty, nie rób nic
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.cost_approvals
       WHERE response_idempotency_key = p_idempotency_key
    ) THEN
      RETURN 'already_processed';
    END IF;
  END IF;

  -- Sprawdź czy akceptacja istnieje i należy do tego projektu + tokenu
  SELECT status INTO v_current_status
    FROM public.cost_approvals
   WHERE id              = p_approval_id
     AND project_id      = v_project_id
     AND portal_token_id = v_token_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'portal_respond_approval: approval % not found for this session', p_approval_id;
  END IF;

  IF v_current_status != 'pending_client' THEN
    RETURN 'already_responded';
  END IF;

  -- Zaktualizuj akceptację
  -- Trigger cost_approvals_after_update (z migr. 034) automatycznie:
  --   1. zaktualizuje expense_invoices.approval_status
  --   2. wpisze event do project_timeline_events (visibility=client_shared)
  UPDATE public.cost_approvals
     SET status                    = p_new_status,
         client_comment            = p_client_comment,
         response_idempotency_key  = p_idempotency_key,
         responded_at              = now()
   WHERE id = p_approval_id;

  RETURN 'ok';
END;
$$;


-- =============================================================================
-- portal_mark_messages_read — oznacz wiadomości jako przeczytane przez klienta
-- =============================================================================

CREATE OR REPLACE FUNCTION public.portal_mark_messages_read(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT vt.project_id INTO v_project_id
    FROM public._portal_validate_session(p_session_id) vt;

  IF v_project_id IS NULL THEN RETURN; END IF;

  UPDATE public.project_messages
     SET read_by_client = true
   WHERE project_id     = v_project_id
     AND visibility     = 'client_shared'
     AND read_by_client = false
     AND sender_type    = 'operator';

  -- Wyzeruj unread count na wątkach
  UPDATE public.project_threads
     SET unread_count_client = 0
   WHERE project_id = v_project_id;
END;
$$;


-- =============================================================================
-- Uprawnienia — dostęp dla roli anon przez authenticated
-- =============================================================================
-- Supabase wywołuje RPC jako anon (jeśli nie ma sesji auth).
-- Te funkcje są SECURITY DEFINER, więc działają pod uprawnieniami właściciela.
-- GRANT EXECUTE pozwala wywołać je z anon key.

GRANT EXECUTE ON FUNCTION public._portal_validate_session(uuid, text)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_project(uuid)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_timeline(uuid, int)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_approvals(uuid)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_messages(uuid, int)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_send_message(uuid, text, text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_respond_approval(uuid, uuid, text, text, text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_mark_messages_read(uuid)          TO anon, authenticated;

COMMIT;
