-- =============================================================================
-- 074_fix_operator_signature_rls.sql
-- =============================================================================
-- Fix: INSERT RLS blocker on all signature_* tables.
--
-- Root cause (3 bugs):
--   1. All four operator policies used FOR ALL USING (expr) without explicit
--      WITH CHECK. PostgreSQL should fall back to USING as WITH CHECK for
--      INSERT, but this doesn't reliably apply in all auth/role contexts.
--      Adding explicit WITH CHECK guarantees operator can INSERT.
--
--   2. sig_events_operator_select was FOR SELECT only — there was no INSERT
--      policy for operators on signature_events. logEvent() silently failed
--      after the signature_requests INSERT (but the sig_req INSERT also fails
--      due to bug #1 above, so this was masked).
--
--   3. sig_part_client_select + sig_part_client_update still had the old
--      client_account_id-based content in production (072 re-run didn't update
--      them). Re-apply the email-match fix here.
-- =============================================================================

-- ─── signature_requests ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS sig_req_operator_all ON public.signature_requests;
CREATE POLICY sig_req_operator_all ON public.signature_requests
  FOR ALL
  USING (
    company_id = my_company_id()
    AND my_app_role() NOT IN ('client', 'anonymous')
  )
  WITH CHECK (
    company_id = my_company_id()
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

-- ─── signature_participants — operator ────────────────────────────────────────

DROP POLICY IF EXISTS sig_part_operator_all ON public.signature_participants;
CREATE POLICY sig_part_operator_all ON public.signature_participants
  FOR ALL
  USING (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE company_id = my_company_id()
    )
    AND my_app_role() NOT IN ('client', 'anonymous')
  )
  WITH CHECK (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE company_id = my_company_id()
    )
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

-- ─── signature_participants — client (re-apply email fix) ─────────────────────

DROP POLICY IF EXISTS sig_part_client_select ON public.signature_participants;
CREATE POLICY sig_part_client_select ON public.signature_participants
  FOR SELECT USING (
    lower(email) IN (
      SELECT lower(ca.email) FROM public.client_accounts ca WHERE ca.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS sig_part_client_update ON public.signature_participants;
CREATE POLICY sig_part_client_update ON public.signature_participants
  FOR UPDATE
  USING (
    lower(email) IN (
      SELECT lower(ca.email) FROM public.client_accounts ca WHERE ca.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    lower(email) IN (
      SELECT lower(ca.email) FROM public.client_accounts ca WHERE ca.auth_user_id = auth.uid()
    )
  );

-- ─── signature_events — operator ─────────────────────────────────────────────
-- Was: FOR SELECT only (sig_events_operator_select) — INSERT blocked.
-- Fix: FOR ALL with USING + WITH CHECK.

DROP POLICY IF EXISTS sig_events_operator_select ON public.signature_events;
DROP POLICY IF EXISTS sig_events_operator_all    ON public.signature_events;
CREATE POLICY sig_events_operator_all ON public.signature_events
  FOR ALL
  USING (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE company_id = my_company_id()
    )
    AND my_app_role() NOT IN ('client', 'anonymous')
  )
  WITH CHECK (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE company_id = my_company_id()
    )
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

-- ─── signature_artifacts — operator ──────────────────────────────────────────

DROP POLICY IF EXISTS sig_art_operator_select ON public.signature_artifacts;
DROP POLICY IF EXISTS sig_art_operator_all    ON public.signature_artifacts;
CREATE POLICY sig_art_operator_all ON public.signature_artifacts
  FOR ALL
  USING (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE company_id = my_company_id()
    )
    AND my_app_role() NOT IN ('client', 'anonymous')
  )
  WITH CHECK (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE company_id = my_company_id()
    )
    AND my_app_role() NOT IN ('client', 'anonymous')
  );

-- ─── approval_events — operator ───────────────────────────────────────────────

DROP POLICY IF EXISTS approval_evt_operator_all ON public.approval_events;
CREATE POLICY approval_evt_operator_all ON public.approval_events
  FOR ALL
  USING (
    company_id = my_company_id()
    AND my_app_role() NOT IN ('client', 'anonymous')
  )
  WITH CHECK (
    company_id = my_company_id()
    AND my_app_role() NOT IN ('client', 'anonymous')
  );
