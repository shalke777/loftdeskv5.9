-- =============================================================================
-- 071_backfill_operator_notifications.sql
-- =============================================================================
-- Jednorazowy backfill historycznych zdarzeń do tabeli operator_notifications.
-- Uruchamia się RĘCZNIE w Supabase SQL Editor (ymozrnytqvvncwseppfa).
--
-- Bezpieczeństwo:
--   - Zapytanie jest idempotentne — NOT EXISTS po reference_id zapobiega duplikatom.
--   - SQL Editor działa jako postgres/service_role → RLS pominięte → INSERT działa.
--   - Nie modyfikuje żadnych istniejących wierszy.
--
-- Zakres backfill:
--   1. Nieprzeczytane wiadomości klienta (read_by_operator = false, deleted_at IS NULL)
--   2. Odpowiedzi klienta na akceptacje kosztów (responded_at IS NOT NULL)
-- =============================================================================

-- ─── KROK 0: Potwierdzenie prerekvizytów ─────────────────────────────────────
-- Uruchom poniższy SELECT najpierw — wynik powinien być NON-NULL dla obu triggerów.

SELECT
  to_regclass('public.operator_notifications') AS tabela_notifications,
  to_regclass('public.project_messages')       AS tabela_messages,
  to_regclass('public.cost_approvals')         AS tabela_approvals,
  (SELECT tgname FROM pg_trigger WHERE tgname = 'trg_on_client_message')    AS trigger_messages,
  (SELECT tgname FROM pg_trigger WHERE tgname = 'trg_on_approval_response') AS trigger_approvals;


-- ─── KROK 1: Backfill wiadomości klienta ─────────────────────────────────────
-- Warunek: klient wysłał wiadomość, operator jej jeszcze nie przeczytał,
--          wiadomość nie została usunięta, i NIE MA jeszcze notyfikacji dla niej.

INSERT INTO public.operator_notifications
  (company_id, project_id, type, title, body, reference_type, reference_id, created_at)
SELECT
  m.company_id,
  m.project_id,
  'client_message',
  'Nowa wiadomość od klienta',
  CASE
    WHEN length(trim(m.body)) > 120
      THEN left(trim(m.body), 120) || '…'
    ELSE trim(m.body)
  END,
  'message',
  m.id,
  m.created_at
FROM public.project_messages m
WHERE m.sender_type       = 'client'
  AND m.read_by_operator  = false
  AND m.deleted_at        IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.operator_notifications n
    WHERE n.reference_id   = m.id
      AND n.reference_type = 'message'
  );


-- ─── KROK 2: Backfill odpowiedzi klienta na akceptacje kosztów ───────────────
-- Warunek: klient już odpowiedział (responded_at IS NOT NULL),
--          i NIE MA jeszcze notyfikacji dla tej odpowiedzi.
-- Nie filtrujemy po statusie — każda odpowiedź (accepted/rejected/questioned)
-- jest istotna dla operatora.

INSERT INTO public.operator_notifications
  (company_id, project_id, type, title, body, reference_type, reference_id, created_at)
SELECT
  ca.company_id,
  ca.project_id,
  'client_approval_response',
  CASE ca.status
    WHEN 'accepted'   THEN 'Klient zaakceptował koszt'
    WHEN 'rejected'   THEN 'Klient odrzucił koszt'
    WHEN 'questioned' THEN 'Klient ma pytania do kosztu'
    ELSE                   'Klient odpowiedział na akceptację'
  END,
  CASE
    WHEN ca.client_comment IS NOT NULL AND length(trim(ca.client_comment)) > 0
      THEN left(trim(ca.client_comment), 200)
    WHEN ca.snapshot_description IS NOT NULL
      THEN left(trim(ca.snapshot_description), 200)
    ELSE NULL
  END,
  'approval',
  ca.id,
  ca.responded_at
FROM public.cost_approvals ca
WHERE ca.responded_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.operator_notifications n
    WHERE n.reference_id   = ca.id
      AND n.reference_type = 'approval'
  );


-- ─── KROK 3: Weryfikacja po wykonaniu ────────────────────────────────────────
-- Powinna pokazać liczbę zaimportowanych wpisów z podziałem na typ.

SELECT
  type,
  count(*)                                     AS total,
  count(*) FILTER (WHERE read_at IS NULL)      AS unread
FROM public.operator_notifications
GROUP BY type
ORDER BY type;
