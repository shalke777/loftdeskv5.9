-- =============================================================================
-- Migration 048 — Portal Freeze (Phase 1)
-- =============================================================================
-- Cel:
--   1. my_client_project_ids() wyklucza projekty z deleted_at IS NOT NULL
--      (zarchiwizowane projekty nie pojawiają się w portalu klienta)
--   2. project_portal_tokens: nowe tokeny są tworzone tylko przez portal-token-create.ts
--      (UI zablokowane od v5.9 — operators używają wyłącznie email invite)
--   3. Monitoring: widok v_portal_token_activity do śledzenia aktywności tokenów
--      (kryterium bezpiecznego usunięcia systemu tokenowego: 0 sesji przez 30 dni)
-- =============================================================================

-- ── 1. Poprawka my_client_project_ids() — wyklucz zarchiwizowane projekty ────

CREATE OR REPLACE FUNCTION public.my_client_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT pca.project_id
  FROM   public.project_client_access pca
  JOIN   public.client_accounts ca ON ca.id = pca.client_account_id
  JOIN   public.projects p         ON p.id = pca.project_id
  WHERE  ca.auth_user_id = auth.uid()
    AND  ca.company_id = (
           SELECT company_id
           FROM   public.client_accounts
           WHERE  auth_user_id = auth.uid()
           ORDER BY created_at ASC
           LIMIT 1
         )
    AND  p.deleted_at IS NULL   -- wyklucz projekty zarchiwizowane (soft-delete)
$$;

-- ── 2. Monitoring: aktywność tokenów portalowych ──────────────────────────────
-- Zapytanie do określenia, kiedy bezpiecznie usunąć tabelę project_portal_sessions.
-- Kryterium: SELECT * FROM v_portal_token_activity — jeśli last_session_at < NOW() - INTERVAL '30 days'
-- możemy przystąpić do Fazy 3 (usunięcie kodu i tabel).

CREATE OR REPLACE VIEW public.v_portal_token_activity AS
SELECT
  ppt.id               AS token_id,
  ppt.project_id,
  ppt.company_id,
  ppt.active,
  ppt.created_at       AS token_created_at,
  ppt.expires_at,
  COUNT(pps.id)        AS total_sessions,
  MAX(pps.created_at)  AS last_session_at
FROM public.project_portal_tokens ppt
LEFT JOIN public.project_portal_sessions pps ON pps.portal_token_id = ppt.id
GROUP BY ppt.id, ppt.project_id, ppt.company_id, ppt.active, ppt.created_at, ppt.expires_at;

COMMENT ON VIEW public.v_portal_token_activity IS
  'Monitoring aktywności tokenów portalowych. '
  'Faza 3 (usunięcie tabel) bezpieczna gdy MAX(last_session_at) < NOW() - INTERVAL ''30 days''.';
