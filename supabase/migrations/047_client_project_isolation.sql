-- =============================================================================
-- Migration 047: Client project isolation — cross-company data leak fix
-- LoftDesk v6.0 security hardening   (P1 / privacy)
-- =============================================================================
--
-- ROOT CAUSE
-- ----------
-- client_accounts has UNIQUE(company_id, email).
-- One email address can therefore produce multiple client_account rows —
-- one row per company that invited it — all with the SAME auth_user_id
-- (Supabase auth user is email-global).
--
-- my_client_project_ids() (migration 042) joins on auth_user_id = auth.uid()
-- WITHOUT a company_id scope.  Result: a client whose email was invited by
-- Company A (ProjectA) and Company B (ProjectB) sees BOTH projects, including
-- all messages, documents, and investment data of the company they did NOT
-- originate from.
--
-- SCHEMA STATE WHEN THIS BECOMES A PROBLEM
-- -----------------------------------------
-- Two companies, two separate operators, same client email:
--   client_accounts row 1: (company_id=A, email='x@y.pl', auth_user_id=<u>)
--   client_accounts row 2: (company_id=B, email='x@y.pl', auth_user_id=<u>)
--   project_client_access row 1: (project=PA, account=row1)
--   project_client_access row 2: (project=PB, account=row2)
-- → my_client_project_ids() returns {PA, PB}
-- → proj_client_select lets the user see BOTH projects
-- → CompanyB's messages/documents/investment data leaks to CompanyA's client
--
-- FIX
-- ---
-- 1. Scope my_client_project_ids() to the client's primary company (oldest
--    client_account for this auth_user_id).  This is consistent with how the
--    session resolver picks the company_id for the frontend session.
--
-- 2. Add my_app_role() = 'client' guard to proj_client_select (defence-in-depth
--    + avoids evaluating the subquery for every operator SELECT on projects).
--
-- 3. Add my_app_role() = 'client' guard to all other client SELECT policies for
--    the same reason.
--
-- IDEMPOTENT: safe to run multiple times.
-- =============================================================================

-- ── 1. Scope my_client_project_ids() by primary company ──────────────────────

CREATE OR REPLACE FUNCTION public.my_client_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT pca.project_id
  FROM   public.project_client_access pca
  JOIN   public.client_accounts ca ON ca.id = pca.client_account_id
  WHERE  ca.auth_user_id = auth.uid()
    AND  ca.company_id = (
           -- Primary company = oldest client_account for this auth user.
           -- Consistent with resolveSupabaseSession() which calls resolve_my_client_account()
           -- which also returns a single row ordered by precedence.
           SELECT company_id
           FROM   public.client_accounts
           WHERE  auth_user_id = auth.uid()
           ORDER BY created_at ASC
           LIMIT 1
         )
$$;

-- ── 2. Tighten proj_client_select — add role guard ────────────────────────────

DROP POLICY IF EXISTS "proj_client_select" ON public.projects;
CREATE POLICY "proj_client_select" ON public.projects
  FOR SELECT USING (
    public.my_app_role() = 'client'
    AND id IN (SELECT public.my_client_project_ids())
  );

-- ── 3. Add role guard to all other client SELECT / INSERT policies ────────────

-- cost_estimates
DROP POLICY IF EXISTS "est_client_select" ON public.cost_estimates;
CREATE POLICY "est_client_select" ON public.cost_estimates
  FOR SELECT USING (
    public.my_app_role() = 'client'
    AND project_id IN (SELECT public.my_client_project_ids())
  );

-- invoices
DROP POLICY IF EXISTS "inv_client_select" ON public.invoices;
CREATE POLICY "inv_client_select" ON public.invoices
  FOR SELECT USING (
    public.my_app_role() = 'client'
    AND project_id IS NOT NULL
    AND project_id IN (SELECT public.my_client_project_ids())
  );

-- project_threads / project_messages / cost_approvals / timeline_events
-- (guarded: these tables are created in migration 034; skip if absent)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_threads'
  ) THEN
    RAISE NOTICE '047: Migration 034 not applied — skipping threads/messages/approvals/timeline guards';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "threads_client_select" ON public.project_threads';
  EXECUTE $pol$
    CREATE POLICY "threads_client_select" ON public.project_threads
      FOR SELECT USING (
        public.my_app_role() = 'client'
        AND visibility IN ('client_shared','approval')
        AND project_id IN (SELECT public.my_client_project_ids())
      )
  $pol$;

  EXECUTE 'DROP POLICY IF EXISTS "messages_client_select" ON public.project_messages';
  EXECUTE $pol$
    CREATE POLICY "messages_client_select" ON public.project_messages
      FOR SELECT USING (
        public.my_app_role() = 'client'
        AND visibility IN ('client_shared','approval')
        AND project_id IN (SELECT public.my_client_project_ids())
      )
  $pol$;

  EXECUTE 'DROP POLICY IF EXISTS "messages_client_insert" ON public.project_messages';
  EXECUTE $pol$
    CREATE POLICY "messages_client_insert" ON public.project_messages
      FOR INSERT WITH CHECK (
        public.my_app_role() = 'client'
        AND visibility = 'client_shared'
        AND project_id IN (SELECT public.my_client_project_ids())
        AND sender_type = 'client'
      )
  $pol$;

  EXECUTE 'DROP POLICY IF EXISTS "approvals_client_select" ON public.cost_approvals';
  EXECUTE $pol$
    CREATE POLICY "approvals_client_select" ON public.cost_approvals
      FOR SELECT USING (
        public.my_app_role() = 'client'
        AND project_id IN (SELECT public.my_client_project_ids())
      )
  $pol$;

  EXECUTE 'DROP POLICY IF EXISTS "approvals_client_respond" ON public.cost_approvals';
  EXECUTE $pol$
    CREATE POLICY "approvals_client_respond" ON public.cost_approvals
      FOR UPDATE
      USING  (
        public.my_app_role() = 'client'
        AND project_id IN (SELECT public.my_client_project_ids())
        AND status = 'pending_client'
      )
      WITH CHECK (
        public.my_app_role() = 'client'
        AND project_id IN (SELECT public.my_client_project_ids())
      )
  $pol$;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_timeline_events' AND column_name = 'visibility'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "te_client_select" ON public.project_timeline_events';
    EXECUTE $pol$
      CREATE POLICY "te_client_select" ON public.project_timeline_events
        FOR SELECT USING (
          public.my_app_role() = 'client'
          AND visibility IN ('client_shared')
          AND project_id IN (SELECT public.my_client_project_ids())
        )
    $pol$;
  END IF;

END $do$;

-- ── 4. Flush PostgREST schema cache ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
