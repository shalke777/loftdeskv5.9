-- =============================================================================
-- 126_approval_propagate_status.sql
-- =============================================================================
-- Problem: klient akceptuje dokument w portalu ale:
--   1. cost_estimates.status NIE zmienia się na 'accepted'
--   2. operator_notifications NIE jest tworzony → brak powiadomienia
--
-- Naprawia: gdy signature_requests.status = 'completed' lub 'rejected':
--   a) UPDATE cost_estimates.status → 'accepted' / 'rejected'
--   b) UPDATE contracts.status     → 'signed' (tylko completed)
--   c) INSERT operator_notifications → powiadomienie dla operatora
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_propagate_sig_req_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepted bool;
BEGIN
  -- Reaguj tylko gdy status zmienia się na completed lub rejected
  IF NEW.status NOT IN ('completed', 'rejected') THEN
    RETURN NEW;
  END IF;
  -- Nie wykonuj ponownie jeśli już był completed/rejected
  IF OLD.status IN ('completed', 'rejected') THEN
    RETURN NEW;
  END IF;

  v_accepted := (NEW.status = 'completed');

  -- ── a) Aktualizuj status dokumentu ────────────────────────────────────────
  IF NEW.document_type = 'estimate' THEN
    UPDATE public.cost_estimates
       SET status = CASE WHEN v_accepted THEN 'accepted' ELSE 'rejected' END
     WHERE id = NEW.document_id
       AND company_id = NEW.company_id;
  END IF;

  IF NEW.document_type = 'contract' AND v_accepted THEN
    UPDATE public.contracts
       SET status = 'signed',
           sign_date = COALESCE(sign_date, now()::date::text)
     WHERE id = NEW.document_id
       AND company_id = NEW.company_id
       AND status = 'unsigned';
  END IF;

  -- ── b) Powiadomienie in-app dla operatora ──────────────────────────────────
  INSERT INTO public.operator_notifications
    (company_id, project_id, type, title, body, reference_type, reference_id)
  VALUES (
    NEW.company_id,
    NEW.project_id,
    'client_approval_response',
    CASE
      WHEN v_accepted THEN 'Klient zaakceptował dokument'
      ELSE                 'Klient odrzucił dokument'
    END,
    COALESCE(NEW.document_label, NEW.document_type),
    'approval',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_sig_req_decision ON public.signature_requests;
CREATE TRIGGER trg_propagate_sig_req_decision
  AFTER UPDATE OF status ON public.signature_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_propagate_sig_req_decision();
