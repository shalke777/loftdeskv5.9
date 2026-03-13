-- =============================================================================
-- Migration 041: rozszerzenie client_tokens o client_account_id + project_id
-- LoftDesk v6.0
-- =============================================================================
-- client_tokens to zaproszenie / entry point do portalu.
-- Po identyfikacji email klienta, token jest powiązany z client_account_id.
-- project_id pozwala automatycznie przypisać dostęp project_client_access.
-- =============================================================================

ALTER TABLE public.client_tokens
  ADD COLUMN IF NOT EXISTS client_account_id uuid REFERENCES public.client_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id         uuid REFERENCES public.projects(id)        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_tokens_account   ON public.client_tokens (client_account_id)
  WHERE client_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_tokens_project   ON public.client_tokens (project_id)
  WHERE project_id IS NOT NULL;
