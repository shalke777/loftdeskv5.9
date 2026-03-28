-- =============================================================================
-- 073_approval_auto_close.sql
-- =============================================================================
-- Dodaje:
--   1. Kolumnę document_label w signature_requests
--      (czytelna etykieta dokumentu widoczna dla klienta w portalu)
--   2. Trigger: gdy uczestnik zmienia status na 'approved' | 'rejected',
--      signature_requests.status jest automatycznie aktualizowany do
--      'completed' lub 'rejected' — bez potrzeby wywołania z poziomu aplikacji.
--      Trigger używa SECURITY DEFINER — działa nawet gdy klient nie ma uprawnień
--      do UPDATE signature_requests.
-- =============================================================================

-- ─── document_label ────────────────────────────────────────────────────────────

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS document_label text;

-- ─── Auto-close trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_close_sig_req_on_participant_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total    int;
  v_decided  int;
  v_rejected int;
BEGIN
  -- Reaguj tylko na decyzję uczestnika (approved / rejected)
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

DROP TRIGGER IF EXISTS trg_close_sig_req_on_participant ON public.signature_participants;
CREATE TRIGGER trg_close_sig_req_on_participant
  AFTER UPDATE OF status ON public.signature_participants
  FOR EACH ROW EXECUTE FUNCTION public.fn_close_sig_req_on_participant_decision();
