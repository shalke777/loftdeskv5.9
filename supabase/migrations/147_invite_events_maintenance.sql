-- =============================================================================
-- 147 — invite_accept_events: maintenance index + 30-day cleanup
-- =============================================================================
-- Mig 146 created the table and a (user_id, created_at DESC) composite index.
-- This migration adds:
--   • A dedicated created_at index for range scans used by the cleanup function.
--   • A cleanup function that purges events older than 30 days.
--   • A pg_cron schedule (requires pg_cron extension — enabled in Supabase
--     via Dashboard → Database → Extensions → pg_cron). If pg_cron is not yet
--     enabled the cron.schedule() block is skipped gracefully.
-- =============================================================================

-- Dedicated index for time-based range scans (cleanup, dashboard queries).
CREATE INDEX IF NOT EXISTS invite_accept_events_created_at_idx
  ON public.invite_accept_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- Cleanup function — removes events older than 30 days.
-- Safe to call any time; idempotent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_invite_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.invite_accept_events
  WHERE created_at < NOW() - INTERVAL '30 days';
$$;

-- Revoke public access; only service_role / postgres may call directly.
REVOKE ALL ON FUNCTION public.cleanup_old_invite_events() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Schedule daily cleanup via pg_cron if the extension is available.
-- Runs at 03:15 UTC every day. Wrapped in DO block so this migration does not
-- fail on projects where pg_cron is not yet enabled.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove previous schedule if it exists (idempotent re-run).
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_invite_accept_events') THEN
      PERFORM cron.unschedule('cleanup_invite_accept_events');
    END IF;

    PERFORM cron.schedule(
      'cleanup_invite_accept_events',
      '15 3 * * *',
      $cmd$SELECT public.cleanup_old_invite_events()$cmd$
    );
  END IF;
END $$;
