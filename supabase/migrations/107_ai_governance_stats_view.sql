-- =============================================================================
-- 107_ai_governance_stats_view.sql
-- =============================================================================
-- Sprint F: Replace v_ai_run_stats with v_ai_governance_stats — a richer
-- per-run view adding retry/timeout/duration/cost metrics alongside the
-- existing acceptance and quality data.
--
-- Also keeps backward-compatible v_ai_run_stats via CREATE OR REPLACE.
-- =============================================================================

-- ── Extend v_ai_run_stats with governance columns ──────────────────────────

-- Must DROP first: original 092 view has different column order; CREATE OR REPLACE
-- cannot reorder/rename existing columns (SQLSTATE 42P16).
DROP VIEW IF EXISTS public.v_ai_run_stats CASCADE;

CREATE VIEW public.v_ai_run_stats AS
SELECT
  r.id                                  AS run_id,
  r.company_id,
  r.project_id,
  r.room_type,
  r.status,
  r.confidence_summary,
  r.created_at,
  r.model_name,
  r.started_at,
  r.completed_at,
  r.error_code,

  -- Governance fields (Sprint F)
  COALESCE(r.retry_count, 0)                                                    AS retry_count,
  COALESCE(r.timeout_occurred, false)                                            AS timeout_occurred,
  r.request_duration_ms,
  r.parse_path,
  COALESCE(r.input_token_count, 0)                                               AS input_token_count,
  COALESCE(r.output_token_count, 0)                                              AS output_token_count,
  COALESCE(r.draft_created, false)                                               AS draft_created,

  -- Duration in seconds (convenience)
  CASE
    WHEN r.started_at IS NOT NULL AND r.completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (r.completed_at - r.started_at))::numeric(10,1)
    ELSE NULL
  END                                                                            AS duration_seconds,

  -- Scope item counts
  COUNT(s.id)::int                                                               AS total_scope_items,
  COUNT(s.id) FILTER (WHERE s.review_status = 'accepted')::int                  AS accepted_count,
  COUNT(s.id) FILTER (WHERE s.review_status = 'modified')::int                  AS modified_count,
  COUNT(s.id) FILTER (WHERE s.review_status = 'rejected')::int                  AS rejected_count,
  COUNT(s.id) FILTER (WHERE s.review_status = 'pending')::int                   AS pending_count,

  -- Acceptance rate: 0–100 or NULL if no items exist
  CASE
    WHEN COUNT(s.id) = 0 THEN NULL
    ELSE ROUND(
      (COUNT(s.id) FILTER (WHERE s.review_status IN ('accepted', 'modified'))::numeric
        / COUNT(s.id)::numeric) * 100,
      1
    )
  END                                                                            AS acceptance_rate,

  -- Candidates = accepted + modified scope items
  COUNT(s.id) FILTER (
    WHERE s.review_status IN ('accepted', 'modified')
  )::int                                                                         AS estimate_candidate_count,

  -- Missing price: accepted/modified items with no operator-confirmed price
  COUNT(s.id) FILTER (
    WHERE s.review_status IN ('accepted', 'modified')
    AND   s.missing_price = true
    AND   s.price_confirmed_by_operator IS NULL
  )::int                                                                         AS missing_price_count,

  -- Whether a draft estimate was created from this run
  EXISTS (
    SELECT 1
    FROM   public.cost_estimates ce
    WHERE  ce.ai_source_run_id = r.id
  )                                                                              AS has_estimate_draft,

  -- Assistant usage count for this run (Sprint F)
  (
    SELECT COUNT(*)::int
    FROM   public.ai_assistant_queries aq
    WHERE  aq.run_id = r.id
  )                                                                              AS assistant_query_count

FROM  public.ai_analysis_runs r
LEFT  JOIN public.ai_scope_items s ON s.run_id = r.id
WHERE r.company_id = my_company_id()
GROUP BY r.id, r.company_id, r.project_id, r.room_type,
         r.status, r.confidence_summary, r.created_at,
         r.model_name, r.started_at, r.completed_at, r.error_code,
         r.retry_count, r.timeout_occurred, r.request_duration_ms,
         r.parse_path, r.input_token_count, r.output_token_count,
         r.draft_created;

GRANT SELECT ON public.v_ai_run_stats TO authenticated;

-- ── Company-level aggregate view ───────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_ai_company_usage AS
SELECT
  r.company_id,
  DATE_TRUNC('day', r.created_at)::date                                          AS day,
  COUNT(*)::int                                                                  AS total_runs,
  COUNT(*) FILTER (WHERE r.status = 'completed')::int                            AS completed_runs,
  COUNT(*) FILTER (WHERE r.status = 'failed')::int                               AS failed_runs,
  COUNT(*) FILTER (WHERE COALESCE(r.timeout_occurred, false))::int               AS timeout_runs,
  COUNT(*) FILTER (WHERE COALESCE(r.retry_count, 0) > 0)::int                   AS retried_runs,
  COUNT(*) FILTER (WHERE COALESCE(r.draft_created, false))::int                  AS drafts_created,
  AVG(r.request_duration_ms)::int                                                AS avg_duration_ms,
  SUM(COALESCE(r.input_token_count, 0) + COALESCE(r.output_token_count, 0))::int AS total_tokens,
  -- Estimated cost: gpt-4o-mini ~ $0.15/1M input + $0.60/1M output
  ROUND(
    (SUM(COALESCE(r.input_token_count, 0))  * 0.00000015 +
     SUM(COALESCE(r.output_token_count, 0)) * 0.0000006)::numeric,
    4
  )                                                                              AS estimated_cost_usd
FROM  public.ai_analysis_runs r
WHERE r.company_id = my_company_id()
GROUP BY r.company_id, DATE_TRUNC('day', r.created_at)::date;

GRANT SELECT ON public.v_ai_company_usage TO authenticated;

COMMENT ON VIEW public.v_ai_run_stats IS 'Per-run governance metrics: acceptance, quality, retry, timeout, cost';
COMMENT ON VIEW public.v_ai_company_usage IS 'Per-company daily AI usage and estimated cost';

NOTIFY pgrst, 'reload schema';
