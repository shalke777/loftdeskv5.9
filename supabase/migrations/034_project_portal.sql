-- =============================================================================
-- Migration 034: Project Portal — wątki, wiadomości, tokeny, akceptacje, oś czasu
-- =============================================================================
-- Rozszerza expense_invoices (z migr. 033) o brakujące kolumny.
-- Wprowadza nowy model wątków projektowych który ZASTĄPI conversations +
-- conversation_messages w przyszłości (te zostają jako LEGACY — patrz dół pliku).
-- =============================================================================

BEGIN;

-- =============================================================================
-- KROK 0 — Soft delete na projects
-- =============================================================================
-- Zamiast twardego DELETE z kaskadą, projekty mogą być „archiwizowane".
-- Trigger poniżej blokuje fizyczne usunięcie projektu, który ma powiązania.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Ochrona przed usunięciem projektu z aktywnymi danymi.
-- Używamy BEFORE DELETE; sprawdzamy obecność wątków, akceptacji i kosztów.
CREATE OR REPLACE FUNCTION public.projects_prevent_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.project_threads   WHERE project_id = OLD.id LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM public.cost_approvals    WHERE project_id = OLD.id LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM public.expense_invoices  WHERE project_id = OLD.id LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Nie można usunąć projektu (id=%) — istnieją powiązane wątki, koszty lub akceptacje. Użyj archiwizacji (deleted_at).', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_prevent_delete ON public.projects;
CREATE TRIGGER trg_projects_prevent_delete
  BEFORE DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_prevent_delete();


-- =============================================================================
-- KROK 1 — project_portal_tokens
-- =============================================================================
-- Bezpieczne tokeny dostępu do portalu projektu.
-- W bazie NIGDY nie ma plaintext tokenu — tylko SHA-256(raw_token).
-- raw_token generuje backend (Netlify function) i przekazuje klientowi w URL.
--
-- Diagram dostępu:
--   klient → GET /portal/[rawToken]
--   Netlify function → hash = SHA-256(rawToken)
--                    → SELECT * FROM project_portal_tokens WHERE token_hash = hash AND active
--                    → INSERT project_portal_sessions (short-lived session)
--                    → zwraca sessionToken do przeglądarki

CREATE TABLE IF NOT EXISTS public.project_portal_tokens (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  project_id        uuid        NOT NULL REFERENCES public.projects(id)   ON DELETE RESTRICT,
  client_id         uuid                 REFERENCES public.clients(id)    ON DELETE SET NULL,

  -- Bezpieczeństwo: NIGDY plaintext — tylko hash
  token_hash        text        UNIQUE NOT NULL,  -- SHA-256 hex raw_tokenu

  -- Zakres dostępu portalowego (tablica dozwolonych operacji)
  scope             text[]      NOT NULL DEFAULT ARRAY['read_updates','read_messages','send_messages','read_documents','read_approvals','respond_approvals'],

  -- Metadane klienta
  client_name       text,
  client_email      text,

  -- Cykl życia tokenu
  active            boolean     NOT NULL DEFAULT true,
  expires_at        timestamptz,                    -- NULL = nie wygasa
  revoked_at        timestamptz,                    -- ustawiane przy cofnięciu dostępu
  last_used_at      timestamptz,

  -- Audit
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_tokens_hash
  ON public.project_portal_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_project
  ON public.project_portal_tokens (project_id, active)
  WHERE active = true AND revoked_at IS NULL;

ALTER TABLE public.project_portal_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_tokens_operator_rw" ON public.project_portal_tokens;
CREATE POLICY "portal_tokens_operator_rw" ON public.project_portal_tokens
  FOR ALL
  USING  (company_id = my_company_id())
  WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager'));


-- =============================================================================
-- KROK 2 — project_portal_sessions
-- =============================================================================
-- Krótkoterminowe sesje portalowe.
-- Tworzone przez Netlify function po walidacji token_hash.
-- Używane jako kontekst dostępu w RLS przez current_setting('app.portal_session_id', true).
--
-- Mechanizm RLS dla portalu:
--   SET LOCAL app.portal_session_id = '<session_id>';
--   RLS policies sprawdzają istnienie aktywnej sesji.

CREATE TABLE IF NOT EXISTS public.project_portal_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_token_id  uuid        NOT NULL REFERENCES public.project_portal_tokens(id) ON DELETE CASCADE,
  project_id       uuid        NOT NULL REFERENCES public.projects(id)              ON DELETE RESTRICT,
  company_id       uuid        NOT NULL REFERENCES public.companies(id)             ON DELETE CASCADE,

  -- sessionId przekazywany do przeglądarki w odpowiedzi z portal-validate
  -- Czas życia sesji: 4 godziny (odnawialne przez ponowną walidację tokenu)
  expires_at       timestamptz NOT NULL DEFAULT now() + interval '4 hours',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token
  ON public.project_portal_sessions (portal_token_id, expires_at DESC);

-- Helper funkcja używana w RLS policies portalu.
-- Zwraca project_id jeśli sesja jest ważna, NULL jeśli nie.
CREATE OR REPLACE FUNCTION public.portal_session_project_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT s.project_id
    FROM public.project_portal_sessions s
    JOIN public.project_portal_tokens   t ON t.id = s.portal_token_id
   WHERE s.id          = current_setting('app.portal_session_id', true)::uuid
     AND s.expires_at  > now()
     AND t.active      = true
     AND t.revoked_at IS NULL
   LIMIT 1;
$$;

-- Helper: sprawdza czy w scope sesji jest dana operacja
CREATE OR REPLACE FUNCTION public.portal_session_has_scope(p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT p_scope = ANY(t.scope)
    FROM public.project_portal_sessions s
    JOIN public.project_portal_tokens   t ON t.id = s.portal_token_id
   WHERE s.id         = current_setting('app.portal_session_id', true)::uuid
     AND s.expires_at > now()
     AND t.active     = true
     AND t.revoked_at IS NULL
   LIMIT 1;
$$;

-- Sesje nie mają RLS — zarządzane wyłącznie przez SECURITY DEFINER functions w Netlify
-- (service role key) — nigdy przez anon / authenticated.


-- =============================================================================
-- KROK 3 — project_threads
-- =============================================================================
-- Zastępuje public.conversations (legacy).
-- Każdy wątek MUSI być przypisany do projektu (project_id NOT NULL).
--
-- Typy wątków:
--   general     — ogólna komunikacja projektowa
--   approvals   — wątek dedykowany dla akceptacji kosztów
--   documents   — rozmowy o dokumentach
--   payments    — płatności i faktury
--   technical   — kwestie techniczne / wykonawcze
--   internal    — tylko firma, nigdy visibility=client_shared
--
-- Visibility:
--   internal       — widoczny wyłącznie dla firmy
--   client_shared  — widoczny dla firmy i klienta w portalu
--   approval       — specjalny wątek akceptacji (firma + klient, tylko do akceptacji)

CREATE TABLE IF NOT EXISTS public.project_threads (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id            uuid        NOT NULL REFERENCES public.projects(id)  ON DELETE RESTRICT,
  client_id             uuid                 REFERENCES public.clients(id)   ON DELETE SET NULL,

  type                  text        NOT NULL DEFAULT 'general'
    CHECK (type IN ('general','approvals','documents','payments','technical','internal')),

  visibility            text        NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal','client_shared','approval')),

  title                 text,
  created_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Podgląd ostatniej wiadomości (denormalizacja dla list)
  last_message_at       timestamptz,
  last_message_preview  text,         -- pierwsze 200 znaków ostatniej wiadomości
  last_message_sender   text,         -- 'operator' | 'client' | 'system'

  -- Liczniki nieprzeczytanych (osobno dla operatora i klienta)
  unread_count_operator int         NOT NULL DEFAULT 0,
  unread_count_client   int         NOT NULL DEFAULT 0,

  archived              boolean     NOT NULL DEFAULT false,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Constraint: wątek type='internal' nie może mieć visibility!='internal'
ALTER TABLE public.project_threads
  ADD CONSTRAINT chk_thread_internal_visibility
    CHECK (NOT (type = 'internal' AND visibility != 'internal'));

CREATE INDEX IF NOT EXISTS idx_threads_project
  ON public.project_threads (project_id, last_message_at DESC NULLS LAST)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_threads_company_unread
  ON public.project_threads (company_id, unread_count_operator)
  WHERE unread_count_operator > 0 AND archived = false;

-- Tylko jeden wątek type=approvals per projekt (dedykowany wątek akceptacji)
CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_one_approvals_per_project
  ON public.project_threads (project_id)
  WHERE type = 'approvals' AND archived = false;

ALTER TABLE public.project_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_operator_select" ON public.project_threads;
CREATE POLICY "threads_operator_select" ON public.project_threads
  FOR SELECT USING (company_id = my_company_id());

DROP POLICY IF EXISTS "threads_operator_insert" ON public.project_threads;
CREATE POLICY "threads_operator_insert" ON public.project_threads
  FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','admin','manager','worker'));

DROP POLICY IF EXISTS "threads_operator_update" ON public.project_threads;
CREATE POLICY "threads_operator_update" ON public.project_threads
  FOR UPDATE
  USING  (company_id = my_company_id())
  WITH CHECK (company_id = my_company_id());

DROP POLICY IF EXISTS "threads_operator_delete" ON public.project_threads;
CREATE POLICY "threads_operator_delete" ON public.project_threads
  FOR DELETE USING (company_id = my_company_id() AND my_role() IN ('owner','admin'));

-- Portal (anon): widzi wątki client_shared / approval jeśli sesja jest ważna
DROP POLICY IF EXISTS "threads_portal_select" ON public.project_threads;
CREATE POLICY "threads_portal_select" ON public.project_threads
  FOR SELECT TO anon USING (
    visibility IN ('client_shared','approval')
    AND project_id = portal_session_project_id()
  );


-- =============================================================================
-- KROK 4 — project_messages
-- =============================================================================
-- Zastępuje public.conversation_messages (legacy).
-- Każda wiadomość MUSI znać swój projekt i wątek.
--
-- sender_type:
--   operator — pracownik firmy (auth.uid() != null)
--   client   — klient przez portal (anon, sesja portalowa)
--   system   — automatyczne wpisy (akceptacje, zmiany statusu)
--
-- visibility:
--   internal       — notatka wewnętrzna / tylko firma
--   client_shared  — widoczna dla klienta w portalu

CREATE TABLE IF NOT EXISTS public.project_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        uuid        NOT NULL REFERENCES public.project_threads(id) ON DELETE CASCADE,
  company_id       uuid        NOT NULL REFERENCES public.companies(id)       ON DELETE CASCADE,
  project_id       uuid        NOT NULL REFERENCES public.projects(id)        ON DELETE RESTRICT,

  sender_type      text        NOT NULL
    CHECK (sender_type IN ('operator','client','system')),
  sender_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL, -- null dla klienta / systemu
  sender_name      text,       -- wyświetlana nazwa (pracownik lub klient)

  body             text        NOT NULL,

  visibility       text        NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal','client_shared')),

  -- Attachments (metadane — plik już w Storage)
  has_attachments  boolean     NOT NULL DEFAULT false,
  attachment_url   text,
  attachment_name  text,
  attachment_mime  text,

  -- Status przeczytania
  read_by_operator boolean     NOT NULL DEFAULT true,  -- operator domyślnie widzi
  read_by_client   boolean     NOT NULL DEFAULT false,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Constraint: klient może pisać tylko do wątków client_shared / approval
ALTER TABLE public.project_messages
  ADD CONSTRAINT chk_message_client_visibility
    CHECK (NOT (sender_type = 'client' AND visibility = 'internal'));

CREATE INDEX IF NOT EXISTS idx_messages_thread
  ON public.project_messages (thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_project
  ON public.project_messages (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_unread_operator
  ON public.project_messages (company_id, read_by_operator)
  WHERE read_by_operator = false AND sender_type != 'operator';

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_operator_select" ON public.project_messages;
CREATE POLICY "messages_operator_select" ON public.project_messages
  FOR SELECT USING (company_id = my_company_id());

DROP POLICY IF EXISTS "messages_operator_insert" ON public.project_messages;
CREATE POLICY "messages_operator_insert" ON public.project_messages
  FOR INSERT WITH CHECK (
    company_id     = my_company_id()
    AND sender_type = 'operator'
  );

DROP POLICY IF EXISTS "messages_operator_update" ON public.project_messages;
CREATE POLICY "messages_operator_update" ON public.project_messages
  FOR UPDATE
  USING  (company_id = my_company_id())
  WITH CHECK (company_id = my_company_id());

-- Portal SELECT — klient widzi wyłącznie client_shared w swoim projekcie
DROP POLICY IF EXISTS "messages_portal_select" ON public.project_messages;
CREATE POLICY "messages_portal_select" ON public.project_messages
  FOR SELECT TO anon USING (
    visibility = 'client_shared'
    AND project_id = portal_session_project_id()
  );

-- Portal INSERT — klient może pisać tylko jako 'client' i tylko client_shared
DROP POLICY IF EXISTS "messages_portal_insert" ON public.project_messages;
CREATE POLICY "messages_portal_insert" ON public.project_messages
  FOR INSERT TO anon WITH CHECK (
    visibility   = 'client_shared'
    AND sender_type = 'client'
    AND project_id  = portal_session_project_id()
    AND portal_session_has_scope('send_messages')
  );


-- Trigger: aktualizuj last_message na wątku po każdej nowej wiadomości
CREATE OR REPLACE FUNCTION public.project_messages_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.project_threads
  SET
    last_message_at      = NEW.created_at,
    last_message_preview = LEFT(NEW.body, 200),
    last_message_sender  = NEW.sender_type,
    updated_at           = now(),
    unread_count_operator = CASE
      WHEN NEW.sender_type = 'client' THEN unread_count_operator + 1
      ELSE unread_count_operator
    END,
    unread_count_client = CASE
      WHEN NEW.sender_type = 'operator' AND NEW.visibility = 'client_shared'
      THEN unread_count_client + 1
      ELSE unread_count_client
    END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_messages_after_insert ON public.project_messages;
CREATE TRIGGER trg_project_messages_after_insert
  AFTER INSERT ON public.project_messages
  FOR EACH ROW EXECUTE FUNCTION public.project_messages_after_insert();


-- =============================================================================
-- KROK 5 — project_timeline_events
-- =============================================================================
-- Oś czasu projektu. Każda ważna akcja zostawia ślad.
--
-- event_type (nie ograniczamy CHECK — nowe typy można dodawać swobodnie):
--   cost_added, cost_updated, cost_deleted
--   cost_approval_sent, cost_approved, cost_rejected, cost_questioned
--   message_sent, client_replied
--   document_added, document_removed
--   portal_activated, portal_revoked
--   project_status_changed, project_created
--
-- visibility:
--   internal       — widoczne tylko dla firmy
--   client_shared  — widoczne w portalu klienta (zakładka Aktualizacje)
--
-- actor_type: 'operator' | 'client' | 'system'
--
-- payload JSONB — dowolne dodatkowe dane per typ eventu,
--   np. { "old_status": "offer", "new_status": "active" }
--      lub { "amount": 1476.00, "vendor": "Sklep ABC" }

CREATE TABLE IF NOT EXISTS public.project_timeline_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  project_id       uuid        NOT NULL REFERENCES public.projects(id)   ON DELETE RESTRICT,

  event_type       text        NOT NULL,

  visibility       text        NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal','client_shared')),

  -- Kto wygenerował event
  actor_type       text        NOT NULL DEFAULT 'operator'
    CHECK (actor_type IN ('operator','client','system')),
  actor_id         uuid,       -- user_id operatora lub NULL dla klienta/systemu
  actor_name       text,       -- wyświetlana nazwa

  -- Tytuł i opcjonalny opis (wyświetlane na osi czasu)
  title            text        NOT NULL,
  description      text,

  -- Opcjonalne powiązanie z konkretnym zasobem
  reference_id     uuid,
  reference_type   text
    CHECK (reference_type IN ('expense','thread','message','document','approval','portal_token','project',NULL)),

  -- Dowolne metadane per event_type
  payload          jsonb       NOT NULL DEFAULT '{}',

  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_project
  ON public.project_timeline_events (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_timeline_project_client
  ON public.project_timeline_events (project_id, created_at DESC)
  WHERE visibility = 'client_shared';

ALTER TABLE public.project_timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timeline_operator_select" ON public.project_timeline_events;
CREATE POLICY "timeline_operator_select" ON public.project_timeline_events
  FOR SELECT USING (company_id = my_company_id());

DROP POLICY IF EXISTS "timeline_operator_insert" ON public.project_timeline_events;
CREATE POLICY "timeline_operator_insert" ON public.project_timeline_events
  FOR INSERT WITH CHECK (company_id = my_company_id());

-- Portal: tylko client_shared zdarzenia własnego projektu
DROP POLICY IF EXISTS "timeline_portal_select" ON public.project_timeline_events;
CREATE POLICY "timeline_portal_select" ON public.project_timeline_events
  FOR SELECT TO anon USING (
    visibility = 'client_shared'
    AND project_id = portal_session_project_id()
  );


-- =============================================================================
-- KROK 6 — create_timeline_event() DB function
-- =============================================================================
-- Centralny helper wywoływany przez API i triggery.
-- SECURITY INVOKER — sprawdza RLS wywołującego.
-- Jeśli wywołujesz z SECURITY DEFINER function, masz dostęp.
-- Jeśli wywołujesz z API (authenticated), masz dostęp przez policy operator_insert.
-- Nigdy nie blokuje głównego flow — błąd timeline loguje, nie wyrzuca exception.

CREATE OR REPLACE FUNCTION public.create_timeline_event(
  p_company_id     uuid,
  p_project_id     uuid,
  p_event_type     text,
  p_visibility     text,
  p_title          text,
  p_description    text        DEFAULT NULL,
  p_actor_type     text        DEFAULT 'operator',
  p_actor_id       uuid        DEFAULT NULL,
  p_actor_name     text        DEFAULT NULL,
  p_reference_id   uuid        DEFAULT NULL,
  p_reference_type text        DEFAULT NULL,
  p_payload        jsonb       DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.project_timeline_events (
    company_id, project_id, event_type, visibility,
    title, description,
    actor_type, actor_id, actor_name,
    reference_id, reference_type,
    payload
  ) VALUES (
    p_company_id, p_project_id, p_event_type, p_visibility,
    p_title, p_description,
    p_actor_type, p_actor_id, p_actor_name,
    p_reference_id, p_reference_type,
    p_payload
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- Timeline jest side-effectem — nie blokujemy głównego flow przy błędzie
  RAISE WARNING 'create_timeline_event failed for project %: %', p_project_id, SQLERRM;
  RETURN NULL;
END;
$$;


-- =============================================================================
-- KROK 7 — cost_approvals
-- =============================================================================
-- Rekord akceptacji kosztu przez klienta.
--
-- Idempotentność:
--   Unique index na (expense_id) WHERE status='pending_client' gwarantuje jedną
--   aktywną akceptację per faktura.
--   response_idempotency_key (UUID generowany przez klienta) gwarantuje,
--   że double-tap nie stworzy duplikatu odpowiedzi.
--
-- Snapshot:
--   snapshot_amount_gross i snapshot_description są kopiowane z faktury
--   w momencie wysłania — klient widzi stan z chwili wysyłki
--   nawet jeśli operator potem edytuje fakturę.

CREATE TABLE IF NOT EXISTS public.cost_approvals (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid        NOT NULL REFERENCES public.companies(id)       ON DELETE CASCADE,
  project_id                uuid        NOT NULL REFERENCES public.projects(id)        ON DELETE RESTRICT,
  expense_id                uuid        NOT NULL REFERENCES public.expense_invoices(id) ON DELETE RESTRICT,
  thread_id                 uuid                 REFERENCES public.project_threads(id)  ON DELETE SET NULL,
  portal_token_id           uuid                 REFERENCES public.project_portal_tokens(id) ON DELETE SET NULL,

  status                    text        NOT NULL DEFAULT 'pending_client'
    CHECK (status IN ('pending_client','accepted','rejected','questioned','cancelled')),

  -- Snapshot danych faktury w momencie wysyłki (klient widzi to, co dostał)
  snapshot_amount_gross     numeric(14,2),
  snapshot_description      text,
  snapshot_vendor           text,
  snapshot_invoice_number   text,

  -- Opcjonalny opis przesyłany klientowi wraz z prośbą
  message_to_client         text,

  -- Odpowiedź klienta
  client_comment            text,

  -- Idempotent key — UUID generowany po stronie klienta pri odpowiedzi
  -- Jeśli ten sam key dotrze dwa razy (double-tap), drugi INSERT/UPDATE jest ignorowany
  response_idempotency_key  text        UNIQUE,

  sent_at                   timestamptz NOT NULL DEFAULT now(),
  responded_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Tylko jedna AKTYWNA akceptacja per faktura
CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_one_pending_per_expense
  ON public.cost_approvals (expense_id)
  WHERE status = 'pending_client';

CREATE INDEX IF NOT EXISTS idx_approvals_project
  ON public.cost_approvals (project_id, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_approvals_portal_token
  ON public.cost_approvals (portal_token_id, status)
  WHERE status = 'pending_client';

ALTER TABLE public.cost_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approvals_operator_select" ON public.cost_approvals;
CREATE POLICY "approvals_operator_select" ON public.cost_approvals
  FOR SELECT USING (company_id = my_company_id());

DROP POLICY IF EXISTS "approvals_operator_insert" ON public.cost_approvals;
CREATE POLICY "approvals_operator_insert" ON public.cost_approvals
  FOR INSERT WITH CHECK (
    company_id = my_company_id()
    AND my_role() IN ('owner','admin','manager','worker')
  );

DROP POLICY IF EXISTS "approvals_operator_update" ON public.cost_approvals;
CREATE POLICY "approvals_operator_update" ON public.cost_approvals
  FOR UPDATE
  USING  (company_id = my_company_id())
  WITH CHECK (company_id = my_company_id());

-- Portal SELECT — klient widzi swoje akceptacje (przez token sesji)
DROP POLICY IF EXISTS "approvals_portal_select" ON public.cost_approvals;
CREATE POLICY "approvals_portal_select" ON public.cost_approvals
  FOR SELECT TO anon USING (
    project_id = portal_session_project_id()
    AND portal_session_has_scope('read_approvals')
    AND portal_token_id IN (
      SELECT t.id
        FROM public.project_portal_tokens t
        JOIN public.project_portal_sessions s ON s.portal_token_id = t.id
       WHERE s.id = current_setting('app.portal_session_id', true)::uuid
         AND s.expires_at > now()
    )
  );

-- Portal UPDATE — klient może zmienić status TYLKO z pending_client
-- i TYLKO na accepted / rejected / questioned (nie może sam anulować)
DROP POLICY IF EXISTS "approvals_portal_respond" ON public.cost_approvals;
CREATE POLICY "approvals_portal_respond" ON public.cost_approvals
  FOR UPDATE TO anon
  USING (
    status = 'pending_client'
    AND project_id = portal_session_project_id()
    AND portal_session_has_scope('respond_approvals')
    AND portal_token_id IN (
      SELECT t.id
        FROM public.project_portal_tokens t
        JOIN public.project_portal_sessions s ON s.portal_token_id = t.id
       WHERE s.id = current_setting('app.portal_session_id', true)::uuid
         AND s.expires_at > now()
    )
  )
  WITH CHECK (status IN ('accepted','rejected','questioned'));


-- =============================================================================
-- KROK 8 — ALTER expense_invoices (rozszerzenie migr. 033)
-- =============================================================================
-- Usuwamy zbyt agresywny UNIQUE INDEX i dodajemy kolumny brakujące dla
-- mobile-first flow, parsera AI, soft duplicate detection i akceptacji.

-- ── Usuń stary twardy unique ──────────────────────────────────────────────────
-- Ten indeks był zbyt agresywny — blokował faktury korygujące i duplikaty
-- z różnych źródeł. Zastępujemy soft detection poniżej.
DROP INDEX IF EXISTS public.expense_invoices_number_company_uidx;

-- ── Nowe kolumny ─────────────────────────────────────────────────────────────

-- Skąd pochodzi dokument
ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('camera','gallery','pdf','manual'));

-- Typ kosztu / przeznaczenie dla klienta
ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS cost_type text NOT NULL DEFAULT 'internal_cost'
    CHECK (cost_type IN ('internal_cost','client_billable','client_approval_required'));

-- Status procesu akceptacji przez klienta
ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'not_sent'
    CHECK (approval_status IN ('not_sent','pending_client','accepted','rejected','questioned'));

ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS approval_sent_at timestamptz;

-- Parser AI / OCR — diagnostyka
ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS extraction_confidence  numeric(3,2)              -- 0.00–1.00
    CHECK (extraction_confidence IS NULL OR (extraction_confidence >= 0 AND extraction_confidence <= 1));

ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS extraction_warnings    jsonb NOT NULL DEFAULT '[]';

ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS requires_user_confirmation boolean NOT NULL DEFAULT false;

ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS parser_source text DEFAULT 'manual'
    CHECK (parser_source IN ('ai','regex','manual'));

-- Soft duplicate detection (nie twardy UNIQUE — tylko flaga + referencja)
ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS possible_duplicate boolean NOT NULL DEFAULT false;

ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS duplicate_of_expense_id uuid
    REFERENCES public.expense_invoices(id) ON DELETE SET NULL;

-- Dodatkowe pola danych faktury
ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS category            text,           -- materiały, robocizna, transport, inne
  ADD COLUMN IF NOT EXISTS currency            text NOT NULL DEFAULT 'PLN',
  ADD COLUMN IF NOT EXISTS sale_date           date,
  ADD COLUMN IF NOT EXISTS payment_due_date    date;

-- ── Soft duplicate detection index ───────────────────────────────────────────
-- Nie blokuje wstawiania — pozwala na szybki lookup podobnych faktur.
-- Aplikacja robi SELECT przed INSERT i ustawia possible_duplicate=true + ostrzeżenie.
CREATE INDEX IF NOT EXISTS idx_expense_soft_dup
  ON public.expense_invoices (company_id, vendor_nip, invoice_number, issue_date)
  WHERE vendor_nip IS NOT NULL AND invoice_number IS NOT NULL;

-- Index dla listy kosztów projektu (najczęstszy query w ProjectExpensesTab)
CREATE INDEX IF NOT EXISTS idx_expense_project_list
  ON public.expense_invoices (project_id, created_at DESC)
  WHERE project_id IS NOT NULL;


-- =============================================================================
-- KROK 9 — Triggery aktualizacji updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_threads_updated_at       ON public.project_threads;
CREATE TRIGGER trg_threads_updated_at
  BEFORE UPDATE ON public.project_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_messages_updated_at      ON public.project_messages;
CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON public.project_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_approvals_updated_at     ON public.cost_approvals;
CREATE TRIGGER trg_approvals_updated_at
  BEFORE UPDATE ON public.cost_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_expense_updated_at       ON public.expense_invoices;
CREATE TRIGGER trg_expense_updated_at
  BEFORE UPDATE ON public.expense_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- KROK 10 — Trigger: akceptacja → aktualizuj expense_invoices + timeline
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cost_approvals_after_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Synchronizuj approval_status na fakturze
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.expense_invoices
    SET approval_status = NEW.status
    WHERE id = NEW.expense_id;

    -- Wpisz do osi czasu projektu
    PERFORM public.create_timeline_event(
      p_company_id     => NEW.company_id,
      p_project_id     => NEW.project_id,
      p_event_type     => CASE NEW.status
        WHEN 'accepted'    THEN 'cost_approved'
        WHEN 'rejected'    THEN 'cost_rejected'
        WHEN 'questioned'  THEN 'cost_questioned'
        ELSE 'cost_approval_status_changed'
      END,
      p_visibility     => 'client_shared',
      p_title          => CASE NEW.status
        WHEN 'accepted'   THEN 'Klient zaakceptował koszt: ' || COALESCE(NEW.snapshot_vendor, 'nieznany dostawca') || ' — ' || COALESCE(NEW.snapshot_amount_gross::text,'?') || ' PLN'
        WHEN 'rejected'   THEN 'Klient odrzucił koszt: '    || COALESCE(NEW.snapshot_vendor, 'nieznany dostawca')
        WHEN 'questioned' THEN 'Klient ma pytanie do kosztu: ' || COALESCE(NEW.snapshot_vendor, 'nieznany dostawca')
        ELSE 'Zmiana statusu akceptacji kosztu'
      END,
      p_description    => NEW.client_comment,
      p_actor_type     => 'client',
      p_reference_id   => NEW.id,
      p_reference_type => 'approval',
      p_payload        => jsonb_build_object(
        'approval_id',   NEW.id,
        'expense_id',    NEW.expense_id,
        'old_status',    OLD.status,
        'new_status',    NEW.status,
        'amount_gross',  NEW.snapshot_amount_gross
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cost_approvals_after_update ON public.cost_approvals;
CREATE TRIGGER trg_cost_approvals_after_update
  AFTER UPDATE ON public.cost_approvals
  FOR EACH ROW EXECUTE FUNCTION public.cost_approvals_after_update();


-- =============================================================================
-- LEGACY MARKER — nie usuwać, nie migrować automatycznie
-- =============================================================================
-- Tabele poniżej pozostają w bazie jako legacy do czasu pełnego przejścia
-- na nowy model. Nie są używane przez nowe komponenty Portalu Projektu.

-- public.conversations           → zastąpione przez project_threads
-- public.conversation_messages   → zastąpione przez project_messages
-- public.client_tokens           → zastąpione przez project_portal_tokens
-- public.portal_messages         → zastąpione przez project_messages


COMMIT;
