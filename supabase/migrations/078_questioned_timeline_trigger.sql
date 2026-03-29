-- =============================================================================
-- 078_questioned_timeline_trigger.sql
-- =============================================================================
-- Dodaje zdarzenie timeline 'doc_questioned' gdy klient wstawia wiersz
-- approval_events z decision = 'questioned'.
--
-- Kontekst (077 + poprawka Bug 400):
--   Migracja 077 rozszerzyła fn_close_sig_req_on_participant_decision o
--   zdarzenia timeline dla decyzji klienta. Jednak ten trigger odpala się
--   tylko przy UPDATE statusu signature_participants. Dla 'questioned' celowo
--   pomijamy UPDATE statusu uczestnika (questioned to nie decyzja finalna) —
--   dlatego trigger 077 nigdy nie odpala się dla tego przypadku.
--
-- To rozwiązanie:
--   Nowy trigger AFTER INSERT ON approval_events, reagujący wyłącznie na
--   decision = 'questioned'. Nie modyfikuje istniejących triggerów ani funkcji.
--
-- Bezpieczeństwo:
--   SECURITY DEFINER — wymagane, bo klient (rls: insert own) nie ma EXECUTE
--   na create_timeline_event. Trigger odpala się w kontekście właściciela
--   funkcji (service role / supabase_admin), nie w kontekście klienta.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_doc_questioned_timeline_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_document_label text;
BEGIN
  -- Reaguj tylko na pytania klienta
  IF NEW.decision != 'questioned' THEN
    RETURN NEW;
  END IF;

  -- Pomijaj zdarzenia bez przypisanego projektu
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pobierz etykietę dokumentu z powiązanego wniosku (opcjonalne; NULL OK)
  IF NEW.signature_request_id IS NOT NULL THEN
    SELECT document_label
      INTO v_document_label
      FROM public.signature_requests
     WHERE id = NEW.signature_request_id;
  END IF;

  PERFORM public.create_timeline_event(
    p_company_id     => NEW.company_id,
    p_project_id     => NEW.project_id,
    p_event_type     => 'doc_questioned',
    p_visibility     => 'operator',
    p_title          => 'Klient zadał pytanie o dokument',
    p_actor_type     => 'client',
    p_actor_name     => NEW.actor_name,
    p_reference_id   => COALESCE(NEW.signature_request_id, NEW.document_id),
    p_reference_type => CASE
                          WHEN NEW.signature_request_id IS NOT NULL THEN 'signature_request'
                          ELSE 'document'
                        END,
    p_payload        => jsonb_build_object(
      'documentType',  NEW.document_type,
      'documentId',    NEW.document_id,
      'documentLabel', COALESCE(v_document_label, NEW.document_type),
      'comment',       NEW.comment
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_doc_questioned_timeline_event
  AFTER INSERT ON public.approval_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_doc_questioned_timeline_event();
