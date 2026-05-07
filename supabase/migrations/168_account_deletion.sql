-- =============================================================================
-- Migration 168: account deletion + data export jobs (GDPR art. 17 + 20)
-- =============================================================================
-- - account_deletion_requests: 30-day cooling-off period; user may cancel.
--   The actual purge is performed by a Netlify scheduled function which
--   calls the `account-delete?action=execute` endpoint with a CRON_SECRET.
-- - data_export_jobs: ZIP exports stored in Storage bucket "exports", signed
--   URL valid 7 days, then auto-deleted by `cron-export-cleanup`.
-- - Storage bucket "exports": private, RLS-protected.
-- - RPC `request_account_deletion(p_reason text)`: convenience wrapper that
--   auth-checks the caller and writes the row + audit event.
--
-- Downgrade (manual):
--   DROP FUNCTION IF EXISTS public.request_account_deletion(text);
--   DROP TABLE    IF EXISTS public.data_export_jobs;
--   DROP TABLE    IF EXISTS public.account_deletion_requests;
--   DELETE FROM storage.buckets WHERE id = 'exports';
-- =============================================================================

BEGIN;

-- ── account_deletion_requests ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id           uuid,
  reason               text,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','confirmed','cancelled','completed','failed')),
  requested_at         timestamptz NOT NULL DEFAULT now(),
  scheduled_purge_at   timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  confirmed_at         timestamptz,
  cancelled_at         timestamptz,
  completed_at         timestamptz,
  failed_at            timestamptz,
  error                text
);

CREATE INDEX IF NOT EXISTS idx_adr_user           ON public.account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_adr_status_purge   ON public.account_deletion_requests(status, scheduled_purge_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_adr_active
  ON public.account_deletion_requests(user_id)
  WHERE status IN ('pending','confirmed');

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adr_self_select ON public.account_deletion_requests;
CREATE POLICY adr_self_select ON public.account_deletion_requests
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = public.account_deletion_requests.company_id
        AND cm.user_id   = auth.uid()
        AND cm.role IN ('owner','admin')
    )
  );

-- All writes go through service-role functions.
DROP POLICY IF EXISTS adr_no_insert ON public.account_deletion_requests;
CREATE POLICY adr_no_insert ON public.account_deletion_requests
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS adr_self_cancel ON public.account_deletion_requests;
CREATE POLICY adr_self_cancel ON public.account_deletion_requests
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON public.account_deletion_requests TO authenticated;

-- ── data_export_jobs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_export_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id      uuid,
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','completed','failed','expired')),
  file_path       text,
  file_size       bigint,
  download_count  integer NOT NULL DEFAULT 0,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  error           text
);

CREATE INDEX IF NOT EXISTS idx_dej_user_requested ON public.data_export_jobs(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_dej_status_expires ON public.data_export_jobs(status, expires_at);

ALTER TABLE public.data_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dej_self_select ON public.data_export_jobs;
CREATE POLICY dej_self_select ON public.data_export_jobs
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS dej_no_insert ON public.data_export_jobs;
CREATE POLICY dej_no_insert ON public.data_export_jobs
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS dej_no_update ON public.data_export_jobs;
CREATE POLICY dej_no_update ON public.data_export_jobs
  FOR UPDATE USING (false);

GRANT SELECT ON public.data_export_jobs TO authenticated;

-- ── Storage bucket: exports (private) ──────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('exports', 'exports', false, 52428800)  -- 50 MB
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

-- RLS on storage.objects: only the owner of the export can read it.
-- We store files at: exports/<user_id>/<job_id>.zip
DROP POLICY IF EXISTS "exports owner can select" ON storage.objects;
CREATE POLICY "exports owner can select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exports'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- ── RPC: request_account_deletion ──────────────────────────────────────────
-- Convenience wrapper users can call directly via PostgREST.
-- Inserts request + audit event in one round-trip.

CREATE OR REPLACE FUNCTION public.request_account_deletion(p_reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_company_id uuid;
  v_id         uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.company_members
  WHERE user_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- One active request at a time
  IF EXISTS (
    SELECT 1 FROM public.account_deletion_requests
    WHERE user_id = v_user_id AND status IN ('pending','confirmed')
  ) THEN
    SELECT id INTO v_id FROM public.account_deletion_requests
    WHERE user_id = v_user_id AND status IN ('pending','confirmed')
    LIMIT 1;
    RETURN v_id;
  END IF;

  INSERT INTO public.account_deletion_requests (user_id, company_id, reason)
  VALUES (v_user_id, v_company_id, p_reason)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_events (user_id, company_id, event_type, event_data)
  VALUES (v_user_id, v_company_id, 'ACCOUNT_DELETE_REQUESTED',
          jsonb_build_object('request_id', v_id, 'reason', p_reason));

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;

COMMENT ON TABLE public.account_deletion_requests IS
  'GDPR art. 17 right-to-erasure requests. 30-day cooling-off, then service-role cron purges.';
COMMENT ON TABLE public.data_export_jobs IS
  'GDPR art. 20 data-portability jobs. ZIP in storage.exports/<user>/<job>.zip, expires 7 days.';

COMMIT;

NOTIFY pgrst, 'reload schema';
