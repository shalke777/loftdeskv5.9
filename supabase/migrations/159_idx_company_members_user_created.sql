-- =============================================================================
-- Migration 159: Index on company_members (user_id, created_at DESC)
-- =============================================================================
-- Supports the scalar subqueries and EXISTS checks in ghost_companies_candidates
-- (migration 158) which filter by user_id and order by created_at DESC LIMIT 1.
--
-- Also benefits:
--   • get_session_context()  — ORDER BY cm.created_at DESC LIMIT 1
--   • my_company_id()        — ORDER BY created_at ASC LIMIT 1
--   • my_role()              — ORDER BY created_at ASC LIMIT 1
--
-- Idempotent: IF NOT EXISTS guard.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_company_members_user_created_desc
  ON public.company_members (user_id, created_at DESC);
