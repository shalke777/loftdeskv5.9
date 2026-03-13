-- =============================================================================
-- Migration 043: Client RLS polish (v6.0 QA pass)
-- =============================================================================
-- 1. ca_client_update_own — prevent client changing their own company_id
-- 2. project_portal_tokens — add client_account_id column (parallel to client_tokens)
-- =============================================================================

-- ── 1. Zabezpieczenie company_id przed zmianą przez klienta ──────────────────
-- Stara polityka pozwalała klientowi zmienić company_id na dowolną inną firmę.
-- Nowa polityka zezwala tylko na aktualizacje, które zachowują obecne company_id.

DROP POLICY IF EXISTS "ca_client_update_own" ON public.client_accounts;

CREATE POLICY "ca_client_update_own" ON public.client_accounts
  FOR UPDATE
  USING  (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid()
    AND company_id = (
      SELECT company_id
      FROM   public.client_accounts ca2
      WHERE  ca2.auth_user_id = auth.uid()
      LIMIT  1
    )
  );

-- ── 2. Dodaj client_account_id do project_portal_tokens ──────────────────────
-- Migration 041 dodała tę kolumnę tylko do client_tokens.
-- client-identify.ts zapisuje client_account_id po weryfikacji emaila —
-- potrzebujemy go tu, żeby powiązać nowy portal token z kontem klienta.

ALTER TABLE public.project_portal_tokens
  ADD COLUMN IF NOT EXISTS client_account_id uuid
    REFERENCES public.client_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ppt_client_account
  ON public.project_portal_tokens (client_account_id)
  WHERE client_account_id IS NOT NULL;
