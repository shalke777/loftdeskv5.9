-- =============================================================================
-- 092_ai_run_stats_view.sql
-- =============================================================================
-- Read-only view: v_ai_run_stats — per-run observability metrics for Sprint 5.
-- No new table, no materialized view, no new flow.
--
-- Columns per contract:
--   run_id, company_id, project_id, status, confidence_summary, created_at
--   total_scope_items, accepted_count, modified_count, rejected_count, pending_count
--   acceptance_rate (0–100 or NULL when no items)
--   estimate_candidate_count  (accepted + modified scope items — candidates, not
--                              real cost_estimate_items; see naming note below)
--   missing_price_count       (accepted/modified items still lacking a price)
--   has_estimate_draft        (whether a cost_estimate row links back to this run)
--
-- Naming note:
--   estimate_candidate_count  = items from ai_scope_items with accepted/modified status
--   This is NOT the count of cost_estimate_items rows (which can be edited post-creation).
--   Do not confuse with a physical join on cost_estimate_items.
--
-- RLS / access:
--   The WHERE clause explicitly filters by my_company_id() so the view is always
--   scoped to the current operator's company, regardless of the view owner role.
--   The GRANT gives authenticated users SELECT access.
-- =============================================================================

CREATE OR REPLACE VIEW public.v_ai_run_stats AS
SELECT
  r.id                                  AS run_id,
  r.company_id,
  r.project_id,
  r.room_type,
  r.status,
  r.confidence_summary,
  r.created_at,

  -- Scope item counts
  COUNT(s.id)::int                                                               AS total_scope_items,
  COUNT(s.id) FILTER (WHERE s.review_status = 'accepted')::int                  AS accepted_count,
  COUNT(s.id) FILTER (WHERE s.review_status = 'modified')::int                  AS modified_count,
  COUNT(s.id) FILTER (WHERE s.review_status = 'rejected')::int                  AS rejected_count,
  COUNT(s.id) FILTER (WHERE s.review_status = 'pending')::int                   AS pending_count,

  -- acceptance_rate: 0–100 or NULL if no items exist
  CASE
    WHEN COUNT(s.id) = 0 THEN NULL
    ELSE ROUND(
      (COUNT(s.id) FILTER (WHERE s.review_status IN ('accepted', 'modified'))::numeric
        / COUNT(s.id)::numeric) * 100,
      1
    )
  END                                                                            AS acceptance_rate,

  -- Candidates = accepted + modified scope items (NOT physical estimate items)
  COUNT(s.id) FILTER (
    WHERE s.review_status IN ('accepted', 'modified')
  )::int                                                                         AS estimate_candidate_count,

  -- Missing price: accepted/modified items with no operator-confirmed price
  COUNT(s.id) FILTER (
    WHERE s.review_status IN ('accepted', 'modified')
    AND   s.missing_price = true
    AND   s.price_confirmed_by_operator IS NULL
  )::int                                                                         AS missing_price_count,

  -- Whether a draft estimate was created from this run (migration 091 guarantees at most one)
  EXISTS (
    SELECT 1
    FROM   public.cost_estimates ce
    WHERE  ce.ai_source_run_id = r.id
  )                                                                              AS has_estimate_draft

FROM  public.ai_analysis_runs r
LEFT  JOIN public.ai_scope_items s ON s.run_id = r.id
-- Explicit company filter: ensures my_company_id() scoping regardless of view owner role
WHERE r.company_id = my_company_id()
GROUP BY r.id, r.company_id, r.project_id, r.room_type,
         r.status, r.confidence_summary, r.created_at;

-- Grant SELECT to authenticated role (Supabase convention)
GRANT SELECT ON public.v_ai_run_stats TO authenticated;

NOTIFY pgrst, 'reload schema';
