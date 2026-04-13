-- =============================================================================
-- 127_fix_propagate_trigger_exception.sql
-- =============================================================================
-- Problem: fn_propagate_sig_req_decision (migration 126) had no EXCEPTION
-- handler. If the INSERT into operator_notifications or the UPDATE on
-- cost_estimates/contracts failed for any reason (e.g. constraint, missing
-- grant), the entire client acceptance transaction was rolled back, returning
-- HTTP 400 to the client portal.
--
-- Fix: wrap the body in BEGIN/EXCEPTION so that side-effect failures (notification
-- + status propagation) do not block the core acceptance from being recorded.
-- The acceptance event and participant status are committed regardless.
-- Side-effect errors are logged as WARNINGS visible in Supabase DB logs.
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

  BEGIN
    -- ── a) Aktualizuj status dokumentu ──────────────────────────────────────
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

    -- ── b) Powiadomienie in-app dla operatora ────────────────────────────────
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

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[fn_propagate_sig_req_decision] side-effect failed for sig_req %: % (SQLSTATE: %)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;
