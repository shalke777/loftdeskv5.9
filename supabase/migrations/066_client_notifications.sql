-- =============================================================================
-- 066 – client_notifications
-- =============================================================================
-- Tabela powiadomień dla klienta w portalu.
-- Rekord tworzony przez operatora po istotnym zdarzeniu (approval, message,
-- dokument), odczytywany przez klienta za pomocą RLS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id      uuid        NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  client_account_id uuid      NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,

  -- Typ powiadomienia
  type            text        NOT NULL
    CHECK (type IN (
      'approval_requested',
      'approval_status_changed',
      'new_message',
      'document_shared'
    )),

  -- Treść
  title           text        NOT NULL,
  body            text,

  -- Nawigacja po kliknięciu
  reference_type  text        CHECK (reference_type IN ('approval','thread','message','document','project')),
  reference_id    uuid,

  -- Odczyt
  read_at         timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indeksy
CREATE INDEX idx_cn_client_unread
  ON client_notifications (client_account_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_cn_project
  ON client_notifications (project_id, client_account_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE client_notifications ENABLE ROW LEVEL SECURITY;

-- Operator może wstawiać powiadomienia dla klientów swojej firmy
CREATE POLICY cn_operator_insert ON client_notifications
  FOR INSERT
  WITH CHECK (
    company_id = my_company_id()
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

-- Operator widzi powiadomienia w swojej firmie (np. debug / admin)
CREATE POLICY cn_operator_select ON client_notifications
  FOR SELECT
  USING (
    company_id = my_company_id()
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

-- Klient widzi własne powiadomienia (projekt musi być w jego dostępie)
CREATE POLICY cn_client_select ON client_notifications
  FOR SELECT
  USING (
    client_account_id IN (
      SELECT ca.id FROM client_accounts ca WHERE ca.auth_user_id = auth.uid()
    )
    AND project_id IN (SELECT * FROM my_client_project_ids())
  );

-- Klient może oznaczyć jako przeczytane (UPDATE read_at)
CREATE POLICY cn_client_update ON client_notifications
  FOR UPDATE
  USING (
    client_account_id IN (
      SELECT ca.id FROM client_accounts ca WHERE ca.auth_user_id = auth.uid()
    )
    AND project_id IN (SELECT * FROM my_client_project_ids())
  )
  WITH CHECK (
    client_account_id IN (
      SELECT ca.id FROM client_accounts ca WHERE ca.auth_user_id = auth.uid()
    )
    AND project_id IN (SELECT * FROM my_client_project_ids())
  );
