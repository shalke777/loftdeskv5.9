-- =============================================================================
-- Migration 042: my_app_role() + RLS policies dla roli 'client'
-- LoftDesk v6.0
-- =============================================================================
-- Zasada bezpieczeństwa:
--   1. Klient NIGDY nie widzi: expense_invoices, kosztów wewnętrznych, danych admin
--   2. Klient widzi tylko projekty w project_client_access
--   3. Token portalu to entry point — nie zastępuje project_client_access
--   4. Brak polityki INSERT/UPDATE/DELETE na dokument-tables dla klienta
-- =============================================================================

-- ── 1. Funkcja my_app_role() ──────────────────────────────────────────────────
-- Zwraca: 'client' | 'owner' | 'admin' | 'manager' | 'worker' | 'accountant' | 'anonymous'

CREATE OR REPLACE FUNCTION public.my_app_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    -- najpierw sprawdź czy to client_account
    (SELECT 'client' FROM public.client_accounts
     WHERE auth_user_id = auth.uid() LIMIT 1),
    -- jeśli nie — sprawdź company_members
    (SELECT role FROM public.company_members
     WHERE user_id = auth.uid() LIMIT 1),
    -- fallback
    'anonymous'
  )
$$;

-- Helper: project_ids dostępne dla zalogowanego klienta
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
$$;

-- ── 2. RLS: projects ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "proj_client_select" ON public.projects;
CREATE POLICY "proj_client_select" ON public.projects
  FOR SELECT USING (
    id IN (SELECT my_client_project_ids())
  );

-- ── 3. RLS: cost_estimates ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "est_client_select"  ON public.cost_estimates;
CREATE POLICY "est_client_select" ON public.cost_estimates
  FOR SELECT USING (
    project_id IN (SELECT my_client_project_ids())
  );

-- ── 4. RLS: invoices ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "inv_client_select"  ON public.invoices;
CREATE POLICY "inv_client_select" ON public.invoices
  FOR SELECT USING (
    project_id IS NOT NULL
    AND project_id IN (SELECT my_client_project_ids())
  );

-- ── 5. RLS: contracts ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "con_client_select"  ON public.contracts;
CREATE POLICY "con_client_select" ON public.contracts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cost_estimates ce
      WHERE ce.id = estimate_id
        AND ce.project_id IN (SELECT my_client_project_ids())
    )
  );

-- ── 6. RLS: project_threads (visibility=client_shared/approval) ─────────────
DROP POLICY IF EXISTS "threads_client_select" ON public.project_threads;
CREATE POLICY "threads_client_select" ON public.project_threads
  FOR SELECT USING (
    visibility IN ('client_shared','approval')
    AND project_id IN (SELECT my_client_project_ids())
  );

-- ── 7. RLS: project_messages (visibility=client_shared) ─────────────────────
DROP POLICY IF EXISTS "messages_client_select" ON public.project_messages;
CREATE POLICY "messages_client_select" ON public.project_messages
  FOR SELECT USING (
    visibility IN ('client_shared','approval')
    AND project_id IN (SELECT my_client_project_ids())
  );

DROP POLICY IF EXISTS "messages_client_insert" ON public.project_messages;
CREATE POLICY "messages_client_insert" ON public.project_messages
  FOR INSERT WITH CHECK (
    visibility = 'client_shared'
    AND project_id IN (SELECT my_client_project_ids())
    AND sender_type = 'client'
  );

-- ── 8. RLS: cost_approvals ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "approvals_client_select" ON public.cost_approvals;
CREATE POLICY "approvals_client_select" ON public.cost_approvals
  FOR SELECT USING (
    project_id IN (SELECT my_client_project_ids())
  );

DROP POLICY IF EXISTS "approvals_client_respond" ON public.cost_approvals;
CREATE POLICY "approvals_client_respond" ON public.cost_approvals
  FOR UPDATE
  USING  (project_id IN (SELECT my_client_project_ids()) AND status = 'pending_client')
  WITH CHECK (project_id IN (SELECT my_client_project_ids()));

-- ── 9. RLS: project_timeline_events (visibility=client_shared) ───────────────
-- Zakłada kolumnę visibility na project_timeline_events, jeśli istnieje
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_timeline_events' AND column_name = 'visibility'
  ) THEN
    EXECUTE $exec$
      DROP POLICY IF EXISTS "te_client_select" ON public.project_timeline_events;
      CREATE POLICY "te_client_select" ON public.project_timeline_events
        FOR SELECT USING (
          visibility IN ('client_shared')
          AND project_id IN (SELECT my_client_project_ids())
        )
    $exec$;
  END IF;
END $outer$;

-- ── 10. expense_invoices: BRAK POLITYKI DLA KLIENTA ──────────────────────────
-- NIE DODAJEMY żadnej polityki SELECT/INSERT/UPDATE/DELETE dla klienta
-- na tabelach: expense_invoices, expense_invoice_items
-- Domyślnie RLS blokuje dostęp bez jawnej polityki → zero dostępu dla klienta

-- ── 11. Trigger: auth_user → client_account sync ─────────────────────────────
-- Po zalogowaniu magic linkiem Supabase tworzy auth.users.
-- Szukamy pasującego client_accounts (po email) i ustawiamy auth_user_id.

CREATE OR REPLACE FUNCTION public.sync_client_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.client_accounts
  SET    auth_user_id = NEW.id,
         updated_at   = now()
  WHERE  lower(email) = lower(NEW.email::text)
    AND  auth_user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_auth_user ON auth.users;
CREATE TRIGGER trg_sync_client_auth_user
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_auth_user();
