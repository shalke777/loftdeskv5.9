-- Migration 108: Close Sprint F governance gaps
-- 1. Heavy PDF flag: input_file_size_bytes column
-- 2. Catalog match ratio: exposed in v_ai_run_stats
-- 3. Weekly company usage view

-- ── 1. Heavy PDF: file size column ─────────────────────────────────────────

ALTER TABLE public.ai_analysis_runs
  ADD COLUMN IF NOT EXISTS input_file_size_bytes INT;

ALTER TABLE public.project_analysis_jobs
  ADD COLUMN IF NOT EXISTS input_file_size_bytes INT;

COMMENT ON COLUMN public.ai_analysis_runs.input_file_size_bytes
  IS 'Total input file size in bytes (images sum or PDF size)';
COMMENT ON COLUMN public.project_analysis_jobs.input_file_size_bytes
  IS 'PDF file size in bytes';

-- ── 2. Extend v_ai_run_stats with match counts + heavy PDF ────────────────

CREATE OR REPLACE VIEW public.v_ai_run_stats AS
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
  r.input_file_size_bytes,

  -- Heavy PDF flag: > 5 MB
  COALESCE(r.input_file_size_bytes > 5242880, false)                             AS is_heavy_pdf,

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

  -- Catalog match counts (Gap 2)
  COUNT(s.id) FILTER (WHERE s.library_id IS NOT NULL)::int                      AS catalog_matched_count,
  COUNT(s.id) FILTER (WHERE s.library_id IS NULL)::int                          AS catalog_unmatched_count,

  -- Catalog match rate: 0–100 or NULL if no items
  CASE
    WHEN COUNT(s.id) = 0 THEN NULL
    ELSE ROUND(
      (COUNT(s.id) FILTER (WHERE s.library_id IS NOT NULL)::numeric
        / COUNT(s.id)::numeric) * 100,
      1
    )
  END                                                                            AS catalog_match_rate,

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
         r.draft_created, r.input_file_size_bytes;

-- ── 3. Weekly company usage view ──────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_ai_company_usage_weekly AS
SELECT
  r.company_id,
  DATE_TRUNC('week', r.created_at)::date                                         AS week_start,
  COUNT(*)::int                                                                  AS total_runs,
  COUNT(*) FILTER (WHERE r.status = 'completed')::int                            AS completed_runs,
  COUNT(*) FILTER (WHERE r.status = 'failed')::int                               AS failed_runs,
  COUNT(*) FILTER (WHERE COALESCE(r.timeout_occurred, false))::int               AS timeout_runs,
  COUNT(*) FILTER (WHERE COALESCE(r.retry_count, 0) > 0)::int                   AS retried_runs,
  COUNT(*) FILTER (WHERE COALESCE(r.draft_created, false))::int                  AS drafts_created,
  COUNT(*) FILTER (WHERE COALESCE(r.input_file_size_bytes, 0) > 5242880)::int    AS heavy_pdf_runs,
  AVG(r.request_duration_ms)::int                                                AS avg_duration_ms,
  SUM(COALESCE(r.input_token_count, 0) + COALESCE(r.output_token_count, 0))::int AS total_tokens,
  -- Estimated cost: gpt-4o-mini ~ $0.15/1M input + $0.60/1M output
  ROUND(
    (SUM(COALESCE(r.input_token_count, 0))  * 0.00000015 +
     SUM(COALESCE(r.output_token_count, 0)) * 0.0000006)::numeric,
    4
  )                                                                              AS estimated_cost_usd,
  -- Assistant queries this week
  (
    SELECT COUNT(*)::int
    FROM   public.ai_assistant_queries aq
    WHERE  aq.company_id = r.company_id
    AND    DATE_TRUNC('week', aq.created_at) = DATE_TRUNC('week', r.created_at)
  )                                                                              AS assistant_queries
FROM  public.ai_analysis_runs r
WHERE r.company_id = my_company_id()
GROUP BY r.company_id, DATE_TRUNC('week', r.created_at)::date;

GRANT SELECT ON public.v_ai_company_usage_weekly TO authenticated;

-- ── 4. Extend daily view with heavy_pdf_runs ──────────────────────────────

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
  COUNT(*) FILTER (WHERE COALESCE(r.input_file_size_bytes, 0) > 5242880)::int    AS heavy_pdf_runs,
  AVG(r.request_duration_ms)::int                                                AS avg_duration_ms,
  SUM(COALESCE(r.input_token_count, 0) + COALESCE(r.output_token_count, 0))::int AS total_tokens,
  ROUND(
    (SUM(COALESCE(r.input_token_count, 0))  * 0.00000015 +
     SUM(COALESCE(r.output_token_count, 0)) * 0.0000006)::numeric,
    4
  )                                                                              AS estimated_cost_usd
FROM  public.ai_analysis_runs r
WHERE r.company_id = my_company_id()
GROUP BY r.company_id, DATE_TRUNC('day', r.created_at)::date;

GRANT SELECT ON public.v_ai_company_usage TO authenticated;
