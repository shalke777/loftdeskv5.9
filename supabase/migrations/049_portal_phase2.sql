-- =============================================================================
-- Migration 049: Portal Phase 2 — migration tracking schema
-- =============================================================================
-- Cel: śledzenie postępu migracji klientów legacy → nowy portal emailowy.
--
-- Dodaje do project_portal_tokens:
--   • migrated_at     — kiedy batch-migrator wysłał magic link
--   • migration_status — 'pending' | 'migrated' | 'no_email' | 'skipped'
--
-- Tworzy widok diagnostyczny v_portal_migration_status używany przez:
--   • portal-migrate-batch.ts  (operator trigger)
--   • v5.9 admin panel / PortalInboxPage
--   • crit. decyzja przejścia do Fazy 3
-- =============================================================================

-- ── 1. Kolumny tracking na project_portal_tokens ─────────────────────────────

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_portal_tokens'
  ) THEN
    RAISE NOTICE 'Migration 034 not yet applied — skipping project_portal_tokens ALTER';
    RETURN;
  END IF;

  EXECUTE $sql$
    ALTER TABLE public.project_portal_tokens
      ADD COLUMN IF NOT EXISTS migrated_at      timestamptz,
      ADD COLUMN IF NOT EXISTS migration_status text NOT NULL DEFAULT 'pending'
        CONSTRAINT ppt_migration_status_check
          CHECK (migration_status IN ('pending', 'migrated', 'no_email', 'skipped'))
  $sql$;

  -- Backfill: tokeny bez emaila dostają status 'no_email' od razu
  EXECUTE $sql$
    UPDATE public.project_portal_tokens
       SET migration_status = 'no_email'
     WHERE client_email IS NULL
       AND migration_status = 'pending'
  $sql$;

  -- Index na status — batch query jest filtrowany po migration_status
  EXECUTE $sql$
    CREATE INDEX IF NOT EXISTS idx_ppt_migration_status
      ON public.project_portal_tokens (migration_status)
      WHERE migration_status = 'pending'
  $sql$;

END $do$;

-- ── 2. Widok diagnostyczny v_portal_migration_status ─────────────────────────
-- Używany przez operatora do monitorowania postępu migracji.
-- Faza 3 można uruchomić gdy:
--   SELECT COUNT(*) = 0 FROM v_portal_migration_status WHERE action = 'ready';
-- oraz:
--   SELECT COUNT(*) = 0 FROM v_portal_token_activity  WHERE last_seen_at > NOW() - INTERVAL '30 days';

CREATE OR REPLACE VIEW public.v_portal_migration_status
  WITH (security_invoker = true)
AS
SELECT
  ppt.id,
  ppt.company_id,
  ppt.project_id,
  ppt.client_email,
  ppt.client_name,
  ppt.active,
  ppt.revoked_at,
  ppt.expires_at,
  ppt.created_at,
  ppt.client_account_id,
  ppt.migrated_at,
  ppt.migration_status,
  last_sessions.last_seen_at,
  last_sessions.total_sessions,
  CASE
    WHEN ppt.migration_status = 'migrated'                        THEN 'done'
    WHEN ppt.migration_status = 'no_email'                        THEN 'no_email'
    WHEN ppt.migration_status = 'skipped'                         THEN 'skipped'
    -- Gotowe do migracji: ma email, jest aktywny, nie wygasł, nie unieważniony
    WHEN ppt.client_email   IS NOT NULL
     AND ppt.active         = true
     AND (ppt.revoked_at    IS NULL)
     AND (ppt.expires_at    IS NULL OR ppt.expires_at > now())    THEN 'ready'
    -- Ma email ale token wygasł / unieważniony — nie warto wysyłać
    WHEN ppt.client_email IS NOT NULL                             THEN 'expired_token'
    ELSE 'unknown'
  END AS action
FROM public.project_portal_tokens ppt
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)           AS total_sessions,
    MAX(pps.created_at) AS last_seen_at
  FROM public.project_portal_sessions pps
  WHERE pps.portal_token_id = ppt.id
) last_sessions ON true;

COMMENT ON VIEW public.v_portal_migration_status IS
  'Diagnostyczny widok postępu migracji legacy-portal → email-portal (Faza 2). '
  'Kolumna action: ready=do migracji, done=zmigrowany, no_email=brak emaila, '
  'expired_token=token wygasł, skipped=błąd migracji.';

-- ── 3. Uprawnienia ────────────────────────────────────────────────────────────
-- Widok używa security_invoker — RLS project_portal_tokens musi zezwolić
-- autoryzowanemu operatorowi na SELECT (dotyczy istniejącej polityki).
-- Anon nie ma dostępu do project_portal_tokens, więc widok jest bezpieczny.
GRANT SELECT ON public.v_portal_migration_status TO authenticated;
