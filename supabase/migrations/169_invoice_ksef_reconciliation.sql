-- Keep non-secret submission metadata so verification survives reloads.
-- Apply before deploying the corresponding application changes.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS ksef_session_ref TEXT,
  ADD COLUMN IF NOT EXISTS ksef_env TEXT CHECK (ksef_env IN ('demo', 'test', 'prod')),
  ADD COLUMN IF NOT EXISTS ksef_status_code INTEGER,
  ADD COLUMN IF NOT EXISTS ksef_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS invoices_ksef_reconciliation_idx
  ON public.invoices (company_id, ksef_env, ksef_checked_at NULLS FIRST)
  WHERE ksef_ref IS NOT NULL AND ksef_session_ref IS NOT NULL
    AND ksef_number IS NULL AND ksef_status IN ('ksef_pending', 'ksef_sent');

COMMENT ON COLUMN public.invoices.ksef_session_ref IS
  'Original submission session reference; not an access token. Required to resume KSeF verification.';

-- Recover metadata for older submissions only from a matching recorded send event.
-- Never infer a session from the user's currently open KSeF session.
WITH recorded AS (
  SELECT DISTINCT ON (invoice_id, company_id, ksef_ref)
    invoice_id, company_id, ksef_ref, env, meta->>'sessionRef' AS session_ref
  FROM public.ksef_events
  WHERE action = 'send_success' AND env IN ('demo', 'test', 'prod')
    AND NULLIF(meta->>'sessionRef', '') IS NOT NULL
  ORDER BY invoice_id, company_id, ksef_ref, created_at DESC
)
UPDATE public.invoices AS invoice
SET ksef_session_ref = recorded.session_ref, ksef_env = recorded.env
FROM recorded
WHERE invoice.id = recorded.invoice_id AND invoice.company_id = recorded.company_id
  AND invoice.ksef_ref = recorded.ksef_ref AND invoice.ksef_session_ref IS NULL;
