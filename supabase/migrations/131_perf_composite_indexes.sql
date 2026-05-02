-- =============================================================================
-- 131 — Performance composite indexes (hot-path lists)
-- =============================================================================
-- Targets the most common list queries:
--   1. cost_estimates: WHERE company_id = ? ORDER BY created_at DESC LIMIT 50
--   2. invoices:       WHERE company_id = ? AND status = ?
--   3. project_messages: WHERE thread_id = ? ORDER BY created_at DESC
--
-- Note: NOT CONCURRENTLY — Supabase migration runner wraps in transaction.
-- Apply during low-traffic window or rerun manually with CONCURRENTLY in psql.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_cost_estimates_company_created
  ON public.cost_estimates (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_company_status
  ON public.invoices (company_id, status);

CREATE INDEX IF NOT EXISTS idx_project_messages_thread_created_desc
  ON public.project_messages (thread_id, created_at DESC);
