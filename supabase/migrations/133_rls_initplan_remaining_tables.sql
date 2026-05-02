-- Migration 133: RLS InitPlan fix — remaining 23 policies missed in migration 132
-- Tables: client_decisions, client_notifications, client_portal_tokens, client_tokens,
--         company_invitations, conversation_messages, conversations, expense_invoices,
--         handover_protocols, portal_messages, project_photo_docs, technical_standards
--
-- Pattern: replace bare my_company_id() / my_role() / my_app_role() calls
--          with (SELECT fn()) to force InitPlan evaluation (one call per query, not per row).
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

BEGIN;

-- ── client_decisions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cd_select ON public.client_decisions;
DROP POLICY IF EXISTS cd_update ON public.client_decisions;
DROP POLICY IF EXISTS cd_delete ON public.client_decisions;

CREATE POLICY cd_select ON public.client_decisions FOR SELECT
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY cd_update ON public.client_decisions FOR UPDATE
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY cd_delete ON public.client_decisions FOR DELETE
  USING (company_id = (SELECT my_company_id()));

-- ── client_notifications ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS cn_operator_select ON public.client_notifications;

CREATE POLICY cn_operator_select ON public.client_notifications FOR SELECT
  USING (
    company_id = (SELECT my_company_id())
    AND (SELECT my_app_role()) <> ALL (ARRAY['client'::text, 'anonymous'::text])
  );

-- ── client_portal_tokens ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS cpt_all ON public.client_portal_tokens;

CREATE POLICY cpt_all ON public.client_portal_tokens FOR ALL
  USING (
    company_id = (SELECT my_company_id())
    OR user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT my_company_id())
    OR user_id = (SELECT auth.uid())
  );

-- ── client_tokens ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS client_tokens_select_company ON public.client_tokens;
DROP POLICY IF EXISTS client_tokens_update_company ON public.client_tokens;

CREATE POLICY client_tokens_select_company ON public.client_tokens FOR SELECT
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY client_tokens_update_company ON public.client_tokens FOR UPDATE
  USING (company_id = (SELECT my_company_id()))
  WITH CHECK (
    company_id = (SELECT my_company_id())
    AND (SELECT my_role()) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])
  );

-- ── company_invitations ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS company_invitations_select ON public.company_invitations;
DROP POLICY IF EXISTS company_invitations_update ON public.company_invitations;

CREATE POLICY company_invitations_select ON public.company_invitations FOR SELECT
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY company_invitations_update ON public.company_invitations FOR UPDATE
  USING (company_id = (SELECT my_company_id()))
  WITH CHECK (
    company_id = (SELECT my_company_id())
    AND (SELECT my_role()) = ANY (ARRAY['owner'::text, 'admin'::text])
  );

-- ── conversation_messages ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS conversation_messages_rw_own ON public.conversation_messages;

CREATE POLICY conversation_messages_rw_own ON public.conversation_messages FOR ALL
  USING (company_id = (SELECT my_company_id()));

-- ── conversations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS conversations_rw_own ON public.conversations;

CREATE POLICY conversations_rw_own ON public.conversations FOR ALL
  USING (company_id = (SELECT my_company_id()));

-- ── expense_invoices ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS expense_invoices_rw_own ON public.expense_invoices;

CREATE POLICY expense_invoices_rw_own ON public.expense_invoices FOR ALL
  USING (company_id = (SELECT my_company_id()));

-- ── handover_protocols ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS hp_select ON public.handover_protocols;
DROP POLICY IF EXISTS hp_update ON public.handover_protocols;
DROP POLICY IF EXISTS hp_delete ON public.handover_protocols;

CREATE POLICY hp_select ON public.handover_protocols FOR SELECT
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY hp_update ON public.handover_protocols FOR UPDATE
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY hp_delete ON public.handover_protocols FOR DELETE
  USING (company_id = (SELECT my_company_id()));

-- ── portal_messages ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS portal_messages_select_company ON public.portal_messages;
DROP POLICY IF EXISTS portal_messages_update_company ON public.portal_messages;

CREATE POLICY portal_messages_select_company ON public.portal_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM client_tokens t
    WHERE t.id = portal_messages.token_id
      AND t.company_id = (SELECT my_company_id())
  ));

CREATE POLICY portal_messages_update_company ON public.portal_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM client_tokens t
    WHERE t.id = portal_messages.token_id
      AND (
        t.company_id = (SELECT my_company_id())
        OR t.user_id = (SELECT auth.uid())
      )
  ));

-- ── project_photo_docs ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS ppd_select ON public.project_photo_docs;
DROP POLICY IF EXISTS ppd_update ON public.project_photo_docs;
DROP POLICY IF EXISTS ppd_delete ON public.project_photo_docs;

CREATE POLICY ppd_select ON public.project_photo_docs FOR SELECT
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY ppd_update ON public.project_photo_docs FOR UPDATE
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY ppd_delete ON public.project_photo_docs FOR DELETE
  USING (company_id = (SELECT my_company_id()));

-- ── technical_standards ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS ts_select ON public.technical_standards;
DROP POLICY IF EXISTS ts_update ON public.technical_standards;
DROP POLICY IF EXISTS ts_delete ON public.technical_standards;

CREATE POLICY ts_select ON public.technical_standards FOR SELECT
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY ts_update ON public.technical_standards FOR UPDATE
  USING (company_id = (SELECT my_company_id()));

CREATE POLICY ts_delete ON public.technical_standards FOR DELETE
  USING (company_id = (SELECT my_company_id()));

COMMIT;
