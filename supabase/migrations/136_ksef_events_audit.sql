-- =============================================================================
-- 136 — KSeF events audit trail
-- =============================================================================
-- Purpose:
--   Append-only log of every KSeF send attempt (success, error, skip, guard).
--   Lets ops/admins reconstruct what happened to any invoice without trusting
--   only the latest invoices.ksef_status snapshot.
--
-- Multi-tenant: rows scoped by company_id, RLS allows tenant members to read,
-- INSERT only via authenticated session of the same company.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ksef_events (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id  UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('guard_block','send_attempt','send_success','send_error','skip_idempotent','retry')),
  attempt     SMALLINT NOT NULL DEFAULT 1,
  ksef_ref    TEXT,
  env         TEXT CHECK (env IN ('demo','test','prod')),
  message     TEXT,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ksef_events_invoice_created ON public.ksef_events (invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ksef_events_company_created ON public.ksef_events (company_id, created_at DESC);

ALTER TABLE public.ksef_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ksef_events_select ON public.ksef_events;
CREATE POLICY ksef_events_select ON public.ksef_events
  FOR SELECT USING (company_id = public.my_company_id());

DROP POLICY IF EXISTS ksef_events_insert ON public.ksef_events;
CREATE POLICY ksef_events_insert ON public.ksef_events
  FOR INSERT WITH CHECK (company_id = public.my_company_id());

-- No UPDATE / DELETE policies — events are append-only.
