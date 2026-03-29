-- =============================================================================
-- 077_doc_approval_timeline.sql
-- =============================================================================
-- Rozszerza trigger fn_close_sig_req_on_participant_decision (zdefiniowany
-- w 073_approval_auto_close.sql) o tworzenie zdarzeń timeline projektu
-- dla decyzji klienta dotyczących dokumentów.
--
-- Nowe zdarzenia timeline:
--   doc_approved   — klient zaakceptował dokument
--   doc_rejected   — klient odrzucił dokument
--   doc_questioned — klient zadał pytanie o dokument
--
-- Zdarzenia są tworzone per uczestnik (nie per wniosek), co umożliwia
-- rozróżnienie decyzji przy wielu uczestnikach. Dla standardowego układu
-- 1 klient = 1 uczestnik zdarzenie odpowiada zamknięciu wniosku.
--
-- Zmiana jest bezpieczna — CREATE OR REPLACE zachowuje istniejący trigger;
-- brak zmian schematu tabel, RLS ani uprawnień.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_close_sig_req_on_participant_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total    int;
  v_decided  int;
  v_rejected int;
  v_req      RECORD;
BEGIN
  -- Reaguj tylko na decyzje uczestnika
  IF NEW.status NOT IN ('approved', 'rejected', 'questioned') THEN
    RETURN NEW;
  END IF;

  -- ── Zdarzenie timeline ─────────────────────────────────────────────────────
  -- Pobierz dane wniosku; project_id może być NULL (dokument bez projektu)
  SELECT id, company_id, project_id, document_type, document_id, document_label
    INTO v_req
    FROM public.signature_requests
   WHERE id = NEW.signature_request_id;

  IF v_req.project_id IS NOT NULL THEN
    PERFORM public.create_timeline_event(
      p_company_id     => v_req.company_id,
      p_project_id     => v_req.project_id,
      p_event_type     => CASE NEW.status
                            WHEN 'approved'   THEN 'doc_approved'
                            WHEN 'rejected'   THEN 'doc_rejected'
                            WHEN 'questioned' THEN 'doc_questioned'
                          END,
      p_visibility     => 'operator',
      p_title          => CASE NEW.status
                            WHEN 'approved'   THEN 'Klient zaakceptował dokument'
                            WHEN 'rejected'   THEN 'Klient odrzucił dokument'
                            WHEN 'questioned' THEN 'Klient zadał pytanie o dokument'
                          END,
      p_actor_type     => 'client',
      p_actor_name     => NEW.name,
      p_reference_id   => NEW.signature_request_id,
      p_reference_type => 'signature_request',
      p_payload        => jsonb_build_object(
        'participantId',  NEW.id,
        'documentType',   v_req.document_type,
        'documentId',     v_req.document_id,
        'documentLabel',  v_req.document_label
      )
    );
  END IF;

  -- ── Auto-close: tylko dla approved / rejected ──────────────────────────────
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('approved', 'signed', 'rejected')),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO v_total, v_decided, v_rejected
  FROM public.signature_participants
  WHERE signature_request_id = NEW.signature_request_id;

  -- Gdy wszyscy podjęli decyzję — zamknij wniosek
  IF v_total > 0 AND v_decided >= v_total THEN
    IF v_rejected > 0 THEN
      UPDATE public.signature_requests
        SET status = 'rejected', completed_at = now()
        WHERE id = NEW.signature_request_id
          AND status IN ('pending', 'in_progress');
    ELSE
      UPDATE public.signature_requests
        SET status = 'completed', completed_at = now()
        WHERE id = NEW.signature_request_id
          AND status IN ('pending', 'in_progress');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
