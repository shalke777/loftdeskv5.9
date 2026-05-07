-- =============================================================================
-- Migration 167: audit_events — central audit log for compliance & GDPR
-- =============================================================================
-- Records sensitive user-facing actions (account deletion, data export, KSeF
-- access, role changes, …) for the lifetime of the company + 12 months.
--
-- Distinct from `audit_logs` (003_audit_logs.sql) which is a generic per-row
-- change tracker. This table is purpose-built for compliance reporting.
--
-- Retention: 12 months — cleanup cron is planned for P1 (audit-cleanup-cron).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id  uuid,
  event_type  text NOT NULL,
  event_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_created
  ON public.audit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_company_created
  ON public.audit_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_type_created
  ON public.audit_events(event_type, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Owners and admins of a company see audit events scoped to their company.
DROP POLICY IF EXISTS audit_events_company_select ON public.audit_events;
CREATE POLICY audit_events_company_select ON public.audit_events
  FOR SELECT USING (
    -- Self
    user_id = auth.uid()
    OR
    -- Company owner / admin
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = public.audit_events.company_id
        AND cm.user_id   = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- Only service_role inserts events. App users never insert directly; they go
-- through Netlify functions which use the service-role client.
DROP POLICY IF EXISTS audit_events_no_insert ON public.audit_events;
CREATE POLICY audit_events_no_insert ON public.audit_events
  FOR INSERT WITH CHECK (false);

-- Nobody updates / deletes; cleanup is service_role only.
DROP POLICY IF EXISTS audit_events_no_update ON public.audit_events;
CREATE POLICY audit_events_no_update ON public.audit_events
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS audit_events_no_delete ON public.audit_events;
CREATE POLICY audit_events_no_delete ON public.audit_events
  FOR DELETE USING (false);

GRANT SELECT ON public.audit_events TO authenticated;

COMMENT ON TABLE public.audit_events IS
  'GDPR/compliance audit log. Retention 12 months. Inserts via service_role only.';

COMMIT;

NOTIFY pgrst, 'reload schema';
