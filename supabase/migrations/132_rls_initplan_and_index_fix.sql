-- =============================================================================
-- 132_rls_initplan_and_index_fix.sql
-- =============================================================================
-- P0 Performance Fix — multi-tenant LoftDesk
--
-- 1. RLS InitPlan wrap (ZERO logic change):
--    Replace bare STABLE function calls in WHERE/USING/WITH CHECK with
--    (SELECT fn()) form so PostgreSQL treats them as InitPlan (one-time eval)
--    instead of per-row evaluation.
--      - my_company_id()  -> (SELECT my_company_id())
--      - my_role()        -> (SELECT my_role())
--      - my_app_role()    -> (SELECT my_app_role())
--    Source migrations re-issued: 002, 007, 018, 022, 025, 034, 040, 070,
--    072, 074, 115.
--
-- 2. Missing company_id / FK indexes (P0 scaling).
--
-- Idempotent. Safe to re-run. No schema change. No data change.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. RLS POLICY REWRITES
-- =============================================================================

-- ─── 002: companies, company_members, clients, cost_estimates ────────────────

DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (id = (SELECT my_company_id()));

DROP POLICY IF EXISTS "members_select" ON public.company_members;
CREATE POLICY "members_select" ON public.company_members
  FOR SELECT USING (company_id = (SELECT my_company_id()));

DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    DROP POLICY IF EXISTS "clients_select" ON public.clients;
    CREATE POLICY "clients_select" ON public.clients
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    DROP POLICY IF EXISTS "clients_insert" ON public.clients;
    CREATE POLICY "clients_insert" ON public.clients
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    DROP POLICY IF EXISTS "clients_update" ON public.clients;
    CREATE POLICY "clients_update" ON public.clients
      FOR UPDATE
      USING (company_id = (SELECT my_company_id()))
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    DROP POLICY IF EXISTS "clients_delete" ON public.clients;
    CREATE POLICY "clients_delete" ON public.clients
      FOR DELETE USING (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin')
      );
  END IF;

  IF to_regclass('public.cost_estimates') IS NOT NULL THEN
    DROP POLICY IF EXISTS "estimates_select" ON public.cost_estimates;
    CREATE POLICY "estimates_select" ON public.cost_estimates
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    DROP POLICY IF EXISTS "estimates_insert" ON public.cost_estimates;
    CREATE POLICY "estimates_insert" ON public.cost_estimates
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    DROP POLICY IF EXISTS "estimates_update" ON public.cost_estimates;
    CREATE POLICY "estimates_update" ON public.cost_estimates
      FOR UPDATE
      USING (company_id = (SELECT my_company_id()))
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    DROP POLICY IF EXISTS "estimates_delete" ON public.cost_estimates;
    CREATE POLICY "estimates_delete" ON public.cost_estimates
      FOR DELETE USING (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin')
      );
  END IF;
END $$;

-- ─── 007: audit_logs, client_tokens, portal_messages, items ──────────────────
-- (projects/invoices/contracts re-issued in 022 section below)

DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
    CREATE POLICY "audit_logs_select" ON public.audit_logs
      FOR SELECT USING (company_id = (SELECT my_company_id()));
  END IF;

  IF to_regclass('public.client_tokens') IS NOT NULL THEN
    DROP POLICY IF EXISTS "client_tokens_select" ON public.client_tokens;
    CREATE POLICY "client_tokens_select" ON public.client_tokens
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    DROP POLICY IF EXISTS "client_tokens_insert" ON public.client_tokens;
    CREATE POLICY "client_tokens_insert" ON public.client_tokens
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    DROP POLICY IF EXISTS "client_tokens_update" ON public.client_tokens;
    CREATE POLICY "client_tokens_update" ON public.client_tokens
      FOR UPDATE
      USING (company_id = (SELECT my_company_id()))
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );
  END IF;

  IF to_regclass('public.portal_messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "portal_messages_select" ON public.portal_messages;
    CREATE POLICY "portal_messages_select" ON public.portal_messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.client_tokens ct
          WHERE ct.id = token_id AND ct.company_id = (SELECT my_company_id())
        )
      );

    DROP POLICY IF EXISTS "portal_messages_insert_company" ON public.portal_messages;
    CREATE POLICY "portal_messages_insert_company" ON public.portal_messages
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.client_tokens ct
          WHERE ct.id = token_id AND ct.company_id = (SELECT my_company_id())
        )
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );
  END IF;
END $$;

-- ─── 022: invoices, contracts, projects, *_items (full reissue) ──────────────

DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    DROP POLICY IF EXISTS "invoices_all"    ON public.invoices;
    DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
    DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
    DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
    DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;

    CREATE POLICY "invoices_select" ON public.invoices
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    CREATE POLICY "invoices_insert" ON public.invoices
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager','accountant')
      );

    CREATE POLICY "invoices_update" ON public.invoices
      FOR UPDATE
      USING (company_id = (SELECT my_company_id()))
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager','accountant')
      );

    CREATE POLICY "invoices_delete" ON public.invoices
      FOR DELETE USING (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin')
      );
  END IF;

  IF to_regclass('public.contracts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "contracts_all"    ON public.contracts;
    DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
    DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
    DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
    DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;

    CREATE POLICY "contracts_select" ON public.contracts
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    CREATE POLICY "contracts_insert" ON public.contracts
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    CREATE POLICY "contracts_update" ON public.contracts
      FOR UPDATE
      USING (company_id = (SELECT my_company_id()))
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    CREATE POLICY "contracts_delete" ON public.contracts
      FOR DELETE USING (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin')
      );
  END IF;

  IF to_regclass('public.cost_estimate_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "cei_select" ON public.cost_estimate_items;
    DROP POLICY IF EXISTS "cei_insert" ON public.cost_estimate_items;
    DROP POLICY IF EXISTS "cei_update" ON public.cost_estimate_items;
    DROP POLICY IF EXISTS "cei_delete" ON public.cost_estimate_items;
    DROP POLICY IF EXISTS "cost_estimate_items_select_v47" ON public.cost_estimate_items;
    DROP POLICY IF EXISTS "cost_estimate_items_insert_v47" ON public.cost_estimate_items;
    DROP POLICY IF EXISTS "cost_estimate_items_update_v47" ON public.cost_estimate_items;
    DROP POLICY IF EXISTS "cost_estimate_items_delete_v47" ON public.cost_estimate_items;

    CREATE POLICY "cei_select" ON public.cost_estimate_items
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.cost_estimates ce
          WHERE ce.id = cost_estimate_id AND ce.company_id = (SELECT my_company_id())
        )
      );

    CREATE POLICY "cei_insert" ON public.cost_estimate_items
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.cost_estimates ce
          WHERE ce.id = cost_estimate_id AND ce.company_id = (SELECT my_company_id())
        )
      );

    CREATE POLICY "cei_update" ON public.cost_estimate_items
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.cost_estimates ce
          WHERE ce.id = cost_estimate_id AND ce.company_id = (SELECT my_company_id())
        )
      );

    CREATE POLICY "cei_delete" ON public.cost_estimate_items
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.cost_estimates ce
          WHERE ce.id = cost_estimate_id AND ce.company_id = (SELECT my_company_id())
        )
      );
  END IF;

  IF to_regclass('public.invoice_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "ii_select" ON public.invoice_items;
    DROP POLICY IF EXISTS "ii_insert" ON public.invoice_items;
    DROP POLICY IF EXISTS "ii_update" ON public.invoice_items;
    DROP POLICY IF EXISTS "ii_delete" ON public.invoice_items;
    DROP POLICY IF EXISTS "invoice_items_select" ON public.invoice_items;
    DROP POLICY IF EXISTS "invoice_items_insert" ON public.invoice_items;
    DROP POLICY IF EXISTS "invoice_items_update" ON public.invoice_items;
    DROP POLICY IF EXISTS "invoice_items_delete" ON public.invoice_items;

    CREATE POLICY "ii_select" ON public.invoice_items
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_id AND i.company_id = (SELECT my_company_id())
        )
      );

    CREATE POLICY "ii_insert" ON public.invoice_items
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_id AND i.company_id = (SELECT my_company_id())
        )
      );

    CREATE POLICY "ii_update" ON public.invoice_items
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_id AND i.company_id = (SELECT my_company_id())
        )
      );

    CREATE POLICY "ii_delete" ON public.invoice_items
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_id AND i.company_id = (SELECT my_company_id())
        )
      );
  END IF;
END $$;

-- ─── 025: projects (OR-based bullet-proof) ───────────────────────────────────
-- Preserves OR-with-legacy-user_id branch for backward compat.

DO $$
DECLARE _pol record;
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    FOR _pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', _pol.policyname);
    END LOOP;

    CREATE POLICY "projects_all" ON public.projects
      FOR ALL
      USING (
        company_id = (SELECT my_company_id())
        OR user_id = (SELECT auth.uid())
      )
      WITH CHECK (
        company_id = (SELECT my_company_id())
        OR user_id = (SELECT auth.uid())
      );
  END IF;
END $$;

-- ─── 018: project_documents, project_timeline, assignment_queue, export_jobs ──

DO $$
BEGIN
  IF to_regclass('public.project_documents') IS NOT NULL THEN
    DROP POLICY IF EXISTS "pd_all"    ON public.project_documents;
    DROP POLICY IF EXISTS "pd_select" ON public.project_documents;
    DROP POLICY IF EXISTS "pd_insert" ON public.project_documents;
    DROP POLICY IF EXISTS "pd_update" ON public.project_documents;
    DROP POLICY IF EXISTS "pd_delete" ON public.project_documents;

    CREATE POLICY "pd_select" ON public.project_documents
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    CREATE POLICY "pd_insert" ON public.project_documents
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    CREATE POLICY "pd_update" ON public.project_documents
      FOR UPDATE
      USING (company_id = (SELECT my_company_id()))
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    CREATE POLICY "pd_delete" ON public.project_documents
      FOR DELETE USING (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin')
      );
  END IF;

  IF to_regclass('public.project_timeline') IS NOT NULL THEN
    DROP POLICY IF EXISTS "pt_select" ON public.project_timeline;
    DROP POLICY IF EXISTS "pt_insert" ON public.project_timeline;

    CREATE POLICY "pt_select" ON public.project_timeline
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    CREATE POLICY "pt_insert" ON public.project_timeline
      FOR INSERT WITH CHECK (company_id = (SELECT my_company_id()));
  END IF;

  IF to_regclass('public.assignment_queue') IS NOT NULL THEN
    DROP POLICY IF EXISTS "aq_all"    ON public.assignment_queue;
    DROP POLICY IF EXISTS "aq_select" ON public.assignment_queue;
    DROP POLICY IF EXISTS "aq_insert" ON public.assignment_queue;
    DROP POLICY IF EXISTS "aq_update" ON public.assignment_queue;

    CREATE POLICY "aq_select" ON public.assignment_queue
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    CREATE POLICY "aq_insert" ON public.assignment_queue
      FOR INSERT WITH CHECK (company_id = (SELECT my_company_id()));

    CREATE POLICY "aq_update" ON public.assignment_queue
      FOR UPDATE
      USING (company_id = (SELECT my_company_id()))
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );
  END IF;

  IF to_regclass('public.export_jobs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "ej_select" ON public.export_jobs;
    DROP POLICY IF EXISTS "ej_insert" ON public.export_jobs;

    CREATE POLICY "ej_select" ON public.export_jobs
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    CREATE POLICY "ej_insert" ON public.export_jobs
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );
  END IF;
END $$;

-- ─── 034: project_portal_tokens, project_threads, project_messages,
--          project_timeline_events, cost_approvals (operator side) ───────────

DO $$
BEGIN
  IF to_regclass('public.project_portal_tokens') IS NOT NULL THEN
    DROP POLICY IF EXISTS "portal_tokens_operator_rw" ON public.project_portal_tokens;
    CREATE POLICY "portal_tokens_operator_rw" ON public.project_portal_tokens
      FOR ALL
      USING  (company_id = (SELECT my_company_id()))
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );
  END IF;

  IF to_regclass('public.project_threads') IS NOT NULL THEN
    DROP POLICY IF EXISTS "threads_operator_select" ON public.project_threads;
    CREATE POLICY "threads_operator_select" ON public.project_threads
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    DROP POLICY IF EXISTS "threads_operator_insert" ON public.project_threads;
    CREATE POLICY "threads_operator_insert" ON public.project_threads
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager','worker')
      );

    DROP POLICY IF EXISTS "threads_operator_update" ON public.project_threads;
    CREATE POLICY "threads_operator_update" ON public.project_threads
      FOR UPDATE
      USING  (company_id = (SELECT my_company_id()))
      WITH CHECK (company_id = (SELECT my_company_id()));

    DROP POLICY IF EXISTS "threads_operator_delete" ON public.project_threads;
    CREATE POLICY "threads_operator_delete" ON public.project_threads
      FOR DELETE USING (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin')
      );
  END IF;

  IF to_regclass('public.project_messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "messages_operator_select" ON public.project_messages;
    CREATE POLICY "messages_operator_select" ON public.project_messages
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    DROP POLICY IF EXISTS "messages_operator_insert" ON public.project_messages;
    CREATE POLICY "messages_operator_insert" ON public.project_messages
      FOR INSERT WITH CHECK (
        company_id  = (SELECT my_company_id())
        AND sender_type = 'operator'
      );

    DROP POLICY IF EXISTS "messages_operator_update" ON public.project_messages;
    CREATE POLICY "messages_operator_update" ON public.project_messages
      FOR UPDATE
      USING  (company_id = (SELECT my_company_id()))
      WITH CHECK (company_id = (SELECT my_company_id()));
  END IF;

  IF to_regclass('public.project_timeline_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "timeline_operator_select" ON public.project_timeline_events;
    CREATE POLICY "timeline_operator_select" ON public.project_timeline_events
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    DROP POLICY IF EXISTS "timeline_operator_insert" ON public.project_timeline_events;
    CREATE POLICY "timeline_operator_insert" ON public.project_timeline_events
      FOR INSERT WITH CHECK (company_id = (SELECT my_company_id()));
  END IF;

  IF to_regclass('public.cost_approvals') IS NOT NULL THEN
    DROP POLICY IF EXISTS "approvals_operator_select" ON public.cost_approvals;
    CREATE POLICY "approvals_operator_select" ON public.cost_approvals
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    DROP POLICY IF EXISTS "approvals_operator_insert" ON public.cost_approvals;
    CREATE POLICY "approvals_operator_insert" ON public.cost_approvals
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager','worker')
      );

    DROP POLICY IF EXISTS "approvals_operator_update" ON public.cost_approvals;
    CREATE POLICY "approvals_operator_update" ON public.cost_approvals
      FOR UPDATE
      USING  (company_id = (SELECT my_company_id()))
      WITH CHECK (company_id = (SELECT my_company_id()));
  END IF;
END $$;

-- ─── 040: client_accounts, project_client_access (operator side) ─────────────

DO $$
BEGIN
  IF to_regclass('public.client_accounts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "ca_operator_select" ON public.client_accounts;
    CREATE POLICY "ca_operator_select" ON public.client_accounts
      FOR SELECT USING (company_id = (SELECT my_company_id()));

    DROP POLICY IF EXISTS "ca_operator_insert" ON public.client_accounts;
    CREATE POLICY "ca_operator_insert" ON public.client_accounts
      FOR INSERT WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    DROP POLICY IF EXISTS "ca_operator_update" ON public.client_accounts;
    CREATE POLICY "ca_operator_update" ON public.client_accounts
      FOR UPDATE
      USING  (company_id = (SELECT my_company_id()))
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );
  END IF;

  IF to_regclass('public.project_client_access') IS NOT NULL THEN
    DROP POLICY IF EXISTS "pca_operator_select" ON public.project_client_access;
    CREATE POLICY "pca_operator_select" ON public.project_client_access
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = project_id AND p.company_id = (SELECT my_company_id())
        )
      );

    DROP POLICY IF EXISTS "pca_operator_insert" ON public.project_client_access;
    CREATE POLICY "pca_operator_insert" ON public.project_client_access
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = project_id AND p.company_id = (SELECT my_company_id())
        )
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );

    DROP POLICY IF EXISTS "pca_operator_delete" ON public.project_client_access;
    CREATE POLICY "pca_operator_delete" ON public.project_client_access
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = project_id AND p.company_id = (SELECT my_company_id())
        )
        AND (SELECT my_role()) IN ('owner','admin','manager')
      );
  END IF;
END $$;

-- ─── 070: operator_notifications ─────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.operator_notifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS on_operator_select ON public.operator_notifications;
    CREATE POLICY on_operator_select ON public.operator_notifications
      FOR SELECT
      USING (
        company_id = (SELECT my_company_id())
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      );

    DROP POLICY IF EXISTS on_operator_update ON public.operator_notifications;
    CREATE POLICY on_operator_update ON public.operator_notifications
      FOR UPDATE
      USING (
        company_id = (SELECT my_company_id())
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      );
  END IF;
END $$;

-- ─── 072 + 074: signature_requests, signature_participants,
--               signature_events, signature_artifacts, approval_events ───────

DO $$
BEGIN
  IF to_regclass('public.signature_requests') IS NOT NULL THEN
    DROP POLICY IF EXISTS sig_req_operator_all    ON public.signature_requests;
    DROP POLICY IF EXISTS sig_req_operator_select ON public.signature_requests;
    DROP POLICY IF EXISTS sig_req_operator_insert ON public.signature_requests;
    DROP POLICY IF EXISTS sig_req_operator_update ON public.signature_requests;
    DROP POLICY IF EXISTS sig_req_operator_delete ON public.signature_requests;

    CREATE POLICY sig_req_operator_all ON public.signature_requests
      FOR ALL
      USING (
        company_id = (SELECT public.my_company_id())
        AND (SELECT public.my_app_role()) NOT IN ('client', 'anonymous')
      )
      WITH CHECK (
        company_id = (SELECT public.my_company_id())
        AND (SELECT public.my_app_role()) NOT IN ('client', 'anonymous')
      );
  END IF;

  IF to_regclass('public.signature_participants') IS NOT NULL THEN
    DROP POLICY IF EXISTS sig_part_operator_all ON public.signature_participants;
    CREATE POLICY sig_part_operator_all ON public.signature_participants
      FOR ALL
      USING (
        signature_request_id IN (
          SELECT id FROM public.signature_requests
          WHERE company_id = (SELECT my_company_id())
        )
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      )
      WITH CHECK (
        signature_request_id IN (
          SELECT id FROM public.signature_requests
          WHERE company_id = (SELECT my_company_id())
        )
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      );
  END IF;

  IF to_regclass('public.signature_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS sig_events_operator_select ON public.signature_events;
    DROP POLICY IF EXISTS sig_events_operator_all    ON public.signature_events;
    CREATE POLICY sig_events_operator_all ON public.signature_events
      FOR ALL
      USING (
        signature_request_id IN (
          SELECT id FROM public.signature_requests
          WHERE company_id = (SELECT my_company_id())
        )
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      )
      WITH CHECK (
        signature_request_id IN (
          SELECT id FROM public.signature_requests
          WHERE company_id = (SELECT my_company_id())
        )
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      );
  END IF;

  IF to_regclass('public.signature_artifacts') IS NOT NULL THEN
    DROP POLICY IF EXISTS sig_art_operator_select ON public.signature_artifacts;
    DROP POLICY IF EXISTS sig_art_operator_all    ON public.signature_artifacts;
    CREATE POLICY sig_art_operator_all ON public.signature_artifacts
      FOR ALL
      USING (
        signature_request_id IN (
          SELECT id FROM public.signature_requests
          WHERE company_id = (SELECT my_company_id())
        )
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      )
      WITH CHECK (
        signature_request_id IN (
          SELECT id FROM public.signature_requests
          WHERE company_id = (SELECT my_company_id())
        )
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      );
  END IF;

  IF to_regclass('public.approval_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS approval_evt_operator_all ON public.approval_events;
    CREATE POLICY approval_evt_operator_all ON public.approval_events
      FOR ALL
      USING (
        company_id = (SELECT my_company_id())
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      )
      WITH CHECK (
        company_id = (SELECT my_company_id())
        AND (SELECT my_app_role()) NOT IN ('client', 'anonymous')
      );
  END IF;
END $$;

-- ─── 115: invoice_reminders (uses company_members IN-subquery, wrap auth.uid)
-- Existing policies do not call my_company_id()/my_role(); they query
-- company_members. Rewrap auth.uid() to be safe (auth.uid() is STABLE).

DO $$
BEGIN
  IF to_regclass('public.invoice_reminders') IS NOT NULL THEN
    DROP POLICY IF EXISTS "invoice_reminders_operator_select" ON public.invoice_reminders;
    CREATE POLICY "invoice_reminders_operator_select"
      ON public.invoice_reminders FOR SELECT
      USING (
        company_id IN (
          SELECT company_id FROM public.company_members
          WHERE user_id = (SELECT auth.uid())
        )
      );

    DROP POLICY IF EXISTS "invoice_reminders_operator_insert" ON public.invoice_reminders;
    CREATE POLICY "invoice_reminders_operator_insert"
      ON public.invoice_reminders FOR INSERT
      WITH CHECK (
        company_id IN (
          SELECT company_id FROM public.company_members
          WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- 2. INDEX FIXES (must run OUTSIDE transaction — CONCURRENTLY)
-- =============================================================================
-- NOTE: CONCURRENTLY cannot run inside a transaction block. Each statement
-- below is executed as its own statement by psql / Supabase migration runner.

-- core multi-tenant hot paths
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_company_created
  ON public.projects (company_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_company_created
  ON public.clients (company_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_company_created
  ON public.contracts (company_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cost_approvals_company
  ON public.cost_approvals (company_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_notifications_company
  ON public.client_notifications (company_id);

-- critical access path optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_client_access_client
  ON public.project_client_access (client_account_id);

-- FK indexes for items tables (IF NOT EXISTS prevents duplicates)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cost_estimate_items_fk
  ON public.cost_estimate_items (cost_estimate_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_items_fk
  ON public.invoice_items (invoice_id);

-- =============================================================================
-- VALIDATION CHECKLIST:
-- 1. RLS policies use (SELECT my_company_id()) pattern
-- 2. No bare STABLE function calls in WHERE clauses
-- 3. company_id indexes exist on all hot tables
-- 4. FK indexes exist on *_items tables
-- 5. No duplicate indexes created
-- =============================================================================
