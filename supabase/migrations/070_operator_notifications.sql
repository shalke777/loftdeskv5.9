-- =============================================================================
-- 070_operator_notifications.sql
-- =============================================================================
-- Tabela powiadomień dla operatora / firmy.
-- Zdarzenia generowane automatycznie przez Postgres triggery:
--   1. Klient wysyła wiadomość (project_messages.sender_type = 'client')
--   2. Klient odpowiada na prośbę o akceptację kosztu (cost_approvals.responded_at)
--
-- Dlaczego triggery, nie fire-and-forget z JS:
--   - Klient nie może bezpośrednio INSERTować do tej tabeli (RLS).
--   - Triggery SECURITY DEFINER działają z uprawnieniami właściciela (postgres).
--   - Działają nawet gdy klient wywoła RPC client_send_message — trigger odpala
--     na INSERT w project_messages (pośrednio przez RPC).
--   - Gwarantuje 100% pokrycie — nie da się pominąć z JS-side.
-- =============================================================================

-- ─── Tabela ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.operator_notifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  project_id     uuid                 REFERENCES public.projects(id)   ON DELETE SET NULL,
  type           text        NOT NULL
    CHECK (type IN ('client_message', 'client_approval_response')),
  title          text        NOT NULL,
  body           text,
  reference_type text        CHECK (reference_type IN ('message', 'approval', 'thread', 'project')),
  reference_id   uuid,
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_on_company_unread
  ON public.operator_notifications (company_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_on_project
  ON public.operator_notifications (project_id)
  WHERE project_id IS NOT NULL;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.operator_notifications ENABLE ROW LEVEL SECURITY;

-- Operator czyta swoje powiadomienia
DROP POLICY IF EXISTS on_operator_select ON public.operator_notifications;
CREATE POLICY on_operator_select ON public.operator_notifications
  FOR SELECT
  USING (
    company_id = my_company_id()
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

-- Operator może oznaczyć jako przeczytane
DROP POLICY IF EXISTS on_operator_update ON public.operator_notifications;
CREATE POLICY on_operator_update ON public.operator_notifications
  FOR UPDATE
  USING (
    company_id = my_company_id()
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

-- Triggery (SECURITY DEFINER) mogą INSERTować bez polityki
-- Nie dodajemy polityki INSERT — triggery omijają RLS (SECURITY DEFINER)

-- ─── Trigger: wiadomość od klienta ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_notify_operator_on_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_type = 'client' THEN
    INSERT INTO public.operator_notifications
      (company_id, project_id, type, title, body, reference_type, reference_id)
    VALUES (
      NEW.company_id,
      NEW.project_id,
      'client_message',
      'Nowa wiadomość od klienta',
      CASE
        WHEN length(trim(NEW.body)) > 120
          THEN left(trim(NEW.body), 120) || '…'
        ELSE trim(NEW.body)
      END,
      'message',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_client_message ON public.project_messages;
CREATE TRIGGER trg_on_client_message
  AFTER INSERT ON public.project_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_operator_on_client_message();

-- ─── Trigger: odpowiedź klienta na akceptację kosztu ─────────────────────────

CREATE OR REPLACE FUNCTION public.trg_notify_operator_on_approval_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Wyzwalaj tylko gdy klient właśnie udzielił odpowiedzi (responded_at nowe)
  IF OLD.responded_at IS NULL AND NEW.responded_at IS NOT NULL THEN
    INSERT INTO public.operator_notifications
      (company_id, project_id, type, title, body, reference_type, reference_id)
    VALUES (
      NEW.company_id,
      NEW.project_id,
      'client_approval_response',
      CASE NEW.status
        WHEN 'accepted'   THEN 'Klient zaakceptował koszt'
        WHEN 'rejected'   THEN 'Klient odrzucił koszt'
        WHEN 'questioned' THEN 'Klient ma pytania do kosztu'
        ELSE                   'Klient odpowiedział na akceptację'
      END,
      CASE
        WHEN NEW.client_comment IS NOT NULL AND length(trim(NEW.client_comment)) > 0
          THEN left(trim(NEW.client_comment), 200)
        WHEN NEW.snapshot_description IS NOT NULL
          THEN left(trim(NEW.snapshot_description), 200)
        ELSE NULL
      END,
      'approval',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_approval_response ON public.cost_approvals;
CREATE TRIGGER trg_on_approval_response
  AFTER UPDATE ON public.cost_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_operator_on_approval_response();
