-- =============================================================================
-- 072_signature_requests.sql
-- =============================================================================
-- Architektura akceptacji i kwalifikowanego podpisu elektronicznego.
--
-- Dwie ścieżki:
--   1. approval_only  — akceptacja w aplikacji (OTP + checkbox + audit trail)
--   2. qualified_signature_required — podpis przez zewnętrzny QTSP (Autenti, mSzafir, Certum)
--
-- Tabele:
--   signature_requests      — wniosek o podpis / akceptację
--   signature_participants  — uczestnicy (podpisujący, zatwierdzający, obserwatorzy)
--   signature_events        — immutable audit log
--   signature_artifacts     — przechowywane pliki (oryginał PDF, podpisany PDF, dowód)
--   approval_events         — zdarzenia akceptacji w aplikacji (odrębne od QTSP)
-- =============================================================================

-- ─── signature_requests ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.signature_requests (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  project_id               uuid                 REFERENCES public.projects(id)   ON DELETE SET NULL,
  document_type            text        NOT NULL
    CHECK (document_type IN ('estimate', 'contract', 'annex', 'invoice', 'other')),
  document_id              uuid        NOT NULL,
  document_hash            text        NOT NULL,  -- SHA-256 hex of the frozen PDF
  mode                     text        NOT NULL DEFAULT 'approval_only'
    CHECK (mode IN ('approval_only', 'qualified_signature_required')),
  status                   text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled', 'expired')),
  provider_name            text        CHECK (provider_name IN ('autenti', 'mszafir', 'certum')),
  provider_transaction_id  text,
  created_by_user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz,
  completed_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sig_req_company
  ON public.signature_requests (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sig_req_document
  ON public.signature_requests (document_type, document_id);

CREATE INDEX IF NOT EXISTS idx_sig_req_status
  ON public.signature_requests (status)
  WHERE status NOT IN ('completed', 'cancelled', 'rejected');

-- ─── signature_participants ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.signature_participants (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id  uuid        NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  role                  text        NOT NULL CHECK (role IN ('signer', 'approver', 'observer')),
  name                  text        NOT NULL,
  email                 text        NOT NULL,
  client_account_id     uuid        REFERENCES public.client_accounts(id) ON DELETE SET NULL,
  user_id               uuid        REFERENCES auth.users(id)             ON DELETE SET NULL,
  status                text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'notified', 'viewed', 'approved', 'signed', 'rejected')),
  action_at             timestamptz,
  otp_code_hash         text,        -- bcrypt/SHA-256 of 6-digit OTP, NOT stored plaintext
  otp_expires_at        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sig_part_request
  ON public.signature_participants (signature_request_id);

CREATE INDEX IF NOT EXISTS idx_sig_part_email
  ON public.signature_participants (lower(email));

-- ─── signature_events (immutable audit log) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.signature_events (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id  uuid        NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  participant_id        uuid                 REFERENCES public.signature_participants(id) ON DELETE SET NULL,
  event_type            text        NOT NULL,
    -- 'created' | 'participant_notified' | 'viewed' | 'otp_sent' | 'otp_verified'
    -- | 'approved' | 'rejected' | 'signing_initiated' | 'signed'
    -- | 'provider_callback' | 'completed' | 'cancelled' | 'expired'
  actor_type            text        NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('operator', 'client', 'system', 'provider')),
  actor_id              uuid,        -- auth.users.id or client_accounts.id depending on actor_type
  actor_ip              text,
  actor_user_agent      text,
  document_hash         text,        -- SHA-256 of document at time of event
  provider_payload      jsonb,       -- raw provider webhook / callback data
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Events are append-only — no UPDATE/DELETE
CREATE INDEX IF NOT EXISTS idx_sig_events_request
  ON public.signature_events (signature_request_id, created_at);

-- ─── signature_artifacts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.signature_artifacts (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id  uuid    NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  artifact_type         text    NOT NULL
    CHECK (artifact_type IN ('original_pdf', 'signed_pdf', 'evidence_card', 'provider_receipt')),
  storage_path          text    NOT NULL,   -- Supabase Storage path
  file_hash             text    NOT NULL,   -- SHA-256 hex
  file_size_bytes       integer,
  provider_artifact_id  text,               -- provider-side reference ID
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sig_artifacts_request
  ON public.signature_artifacts (signature_request_id);

-- ─── approval_events (in-app consent + OTP audit trail) ──────────────────────
-- Stores the full consent evidence for approval_only mode.
-- Each row is a single irreversible decision record.

CREATE TABLE IF NOT EXISTS public.approval_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  project_id          uuid                 REFERENCES public.projects(id)   ON DELETE SET NULL,
  signature_request_id uuid               REFERENCES public.signature_requests(id) ON DELETE SET NULL,
  document_type       text        NOT NULL,
  document_id         uuid        NOT NULL,
  document_hash       text        NOT NULL,  -- SHA-256 hex of document at time of approval
  actor_type          text        NOT NULL CHECK (actor_type IN ('operator', 'client')),
  actor_id            uuid        NOT NULL,   -- auth.users.id
  actor_name          text,
  actor_email         text,
  actor_ip            text,
  actor_user_agent    text,
  consent_text        text        NOT NULL,   -- verbatim text the actor checked
  consent_checked_at  timestamptz NOT NULL DEFAULT now(),
  otp_verified_at     timestamptz,            -- NULL means OTP step was skipped (operator-only)
  decision            text        NOT NULL CHECK (decision IN ('approved', 'rejected', 'questioned')),
  comment             text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_events_company
  ON public.approval_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_events_document
  ON public.approval_events (document_type, document_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.signature_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_artifacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_events       ENABLE ROW LEVEL SECURITY;

-- signature_requests — operator pełny dostęp, klient widzi swoje (przez participant)
DROP POLICY IF EXISTS sig_req_operator_all    ON public.signature_requests;
CREATE POLICY sig_req_operator_all ON public.signature_requests
  FOR ALL USING (company_id = my_company_id() AND my_app_role() NOT IN ('client', 'anonymous'));

DROP POLICY IF EXISTS sig_req_client_select   ON public.signature_requests;
CREATE POLICY sig_req_client_select ON public.signature_requests
  FOR SELECT USING (
    id IN (
      SELECT sp.signature_request_id
      FROM   public.signature_participants sp
      JOIN   public.client_accounts ca ON lower(ca.email) = lower(sp.email)
      WHERE  ca.auth_user_id = auth.uid()
    )
  );

-- signature_participants — operator pełny dostęp; klient widzi własne
DROP POLICY IF EXISTS sig_part_operator_all   ON public.signature_participants;
CREATE POLICY sig_part_operator_all ON public.signature_participants
  FOR ALL USING (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE company_id = my_company_id()
    )
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

DROP POLICY IF EXISTS sig_part_client_select  ON public.signature_participants;
CREATE POLICY sig_part_client_select ON public.signature_participants
  FOR SELECT USING (
    client_account_id IN (
      SELECT id FROM public.client_accounts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS sig_part_client_update  ON public.signature_participants;
CREATE POLICY sig_part_client_update ON public.signature_participants
  FOR UPDATE USING (
    client_account_id IN (
      SELECT id FROM public.client_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- signature_events — append-only; operator + authorized client select
DROP POLICY IF EXISTS sig_events_operator_select ON public.signature_events;
CREATE POLICY sig_events_operator_select ON public.signature_events
  FOR SELECT USING (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE company_id = my_company_id()
    )
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

DROP POLICY IF EXISTS sig_events_client_select ON public.signature_events;
CREATE POLICY sig_events_client_select ON public.signature_events
  FOR SELECT USING (
    signature_request_id IN (
      SELECT sp.signature_request_id
      FROM   public.signature_participants sp
      JOIN   public.client_accounts ca ON lower(ca.email) = lower(sp.email)
      WHERE  ca.auth_user_id = auth.uid()
    )
  );

-- signature_artifacts — same as events
DROP POLICY IF EXISTS sig_art_operator_select ON public.signature_artifacts;
CREATE POLICY sig_art_operator_select ON public.signature_artifacts
  FOR ALL USING (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE company_id = my_company_id()
    )
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

DROP POLICY IF EXISTS sig_art_client_select ON public.signature_artifacts;
CREATE POLICY sig_art_client_select ON public.signature_artifacts
  FOR SELECT USING (
    signature_request_id IN (
      SELECT sp.signature_request_id
      FROM   public.signature_participants sp
      JOIN   public.client_accounts ca ON lower(ca.email) = lower(sp.email)
      WHERE  ca.auth_user_id = auth.uid()
    )
  );

-- approval_events — operator full access; client reads own decisions
DROP POLICY IF EXISTS approval_evt_operator_all ON public.approval_events;
CREATE POLICY approval_evt_operator_all ON public.approval_events
  FOR ALL USING (company_id = my_company_id() AND my_app_role() NOT IN ('client', 'anonymous'));

DROP POLICY IF EXISTS approval_evt_client_select ON public.approval_events;
CREATE POLICY approval_evt_client_select ON public.approval_events
  FOR SELECT USING (actor_id = auth.uid());

-- Clients can INSERT their own approval event
DROP POLICY IF EXISTS approval_evt_client_insert ON public.approval_events;
CREATE POLICY approval_evt_client_insert ON public.approval_events
  FOR INSERT WITH CHECK (actor_id = auth.uid() AND actor_type = 'client');

-- ─── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_set_updated_at_signature()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_updated_at ON public.signature_requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at_signature();
