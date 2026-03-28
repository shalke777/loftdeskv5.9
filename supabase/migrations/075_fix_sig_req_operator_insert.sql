-- =============================================================================
-- 075_fix_sig_req_operator_insert.sql
-- =============================================================================
-- Root cause: sig_req_operator_all used FOR ALL USING (expr) without guaranteed
-- WITH CHECK. PostgreSQL 15 may store with_check=NULL when WITH CHECK is identical
-- to USING, causing INSERT to fail in certain execution contexts.
--
-- Fix: replace FOR ALL with four explicit per-command policies on
-- public.signature_requests. A FOR INSERT WITH CHECK policy is unambiguous —
-- it cannot have a USING fallback and is evaluated explicitly for every INSERT.
-- =============================================================================

DROP POLICY IF EXISTS sig_req_operator_all    ON public.signature_requests;
DROP POLICY IF EXISTS sig_req_operator_select ON public.signature_requests;
DROP POLICY IF EXISTS sig_req_operator_insert ON public.signature_requests;
DROP POLICY IF EXISTS sig_req_operator_update ON public.signature_requests;
DROP POLICY IF EXISTS sig_req_operator_delete ON public.signature_requests;

CREATE POLICY sig_req_operator_select
  ON public.signature_requests
  FOR SELECT
  USING (
    public.my_app_role() NOT IN ('client', 'anonymous')
    AND company_id = public.my_company_id()
  );

CREATE POLICY sig_req_operator_insert
  ON public.signature_requests
  FOR INSERT
  WITH CHECK (
    public.my_app_role() NOT IN ('client', 'anonymous')
    AND company_id = public.my_company_id()
  );

CREATE POLICY sig_req_operator_update
  ON public.signature_requests
  FOR UPDATE
  USING (
    public.my_app_role() NOT IN ('client', 'anonymous')
    AND company_id = public.my_company_id()
  )
  WITH CHECK (
    public.my_app_role() NOT IN ('client', 'anonymous')
    AND company_id = public.my_company_id()
  );

CREATE POLICY sig_req_operator_delete
  ON public.signature_requests
  FOR DELETE
  USING (
    public.my_app_role() NOT IN ('client', 'anonymous')
    AND company_id = public.my_company_id()
  );
