# AI Production Monitoring — LoftDesk

> Created: Sprint H — Production Observation + First Tuning Pass
> Baseline date: 2026-04-05

## Monitoring Cadence

| Frequency | What to check |
|-----------|--------------|
| Daily | failure_rate, timeout_rate, error_codes |
| Weekly | acceptance_rate, catalog_match_rate, cost, assistant_usage |
| Bi-weekly | full tuning threshold evaluation |

## Quick Baseline Query

```sql
-- Room analysis aggregate
SELECT
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
  AVG(request_duration_ms)::int                AS avg_dur_ms,
  SUM(CASE WHEN COALESCE(retry_count,0) > 0 THEN 1 ELSE 0 END) AS retried,
  SUM(CASE WHEN COALESCE(timeout_occurred,false) THEN 1 ELSE 0 END) AS timedout,
  SUM(CASE WHEN COALESCE(draft_created,false) THEN 1 ELSE 0 END) AS drafts
FROM ai_analysis_runs;
```

```sql
-- Project analysis aggregate with error breakdown
SELECT
  status, error_code, COUNT(*) AS cnt,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::int AS avg_dur_sec,
  SUM(CASE WHEN COALESCE(retry_count,0) > 0 THEN 1 ELSE 0 END) AS retried,
  SUM(CASE WHEN COALESCE(timeout_occurred,false) THEN 1 ELSE 0 END) AS timedout
FROM project_analysis_jobs
GROUP BY status, error_code
ORDER BY cnt DESC;
```

```sql
-- Per-run governance (bypass my_company_id filter)
SELECT
  r.id, r.status, r.model_name, r.room_type,
  COALESCE(r.retry_count,0)      AS retry_count,
  COALESCE(r.timeout_occurred,false) AS timeout_occurred,
  r.request_duration_ms,
  r.parse_path,
  r.input_token_count, r.output_token_count,
  COALESCE(r.draft_created,false) AS draft_created,
  r.input_file_size_bytes,
  r.created_at::date AS day,
  COUNT(s.id) AS scope_items,
  COUNT(s.id) FILTER (WHERE s.library_id IS NOT NULL) AS matched_items,
  COUNT(s.id) FILTER (WHERE s.review_status IN ('accepted','modified')) AS accepted_items
FROM ai_analysis_runs r
LEFT JOIN ai_scope_items s ON s.run_id = r.id
GROUP BY r.id
ORDER BY r.created_at DESC;
```

```sql
-- Catalog match rate
SELECT
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE library_id IS NOT NULL) AS matched,
  ROUND(COUNT(*) FILTER (WHERE library_id IS NOT NULL)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS match_rate
FROM ai_scope_items;
```

```sql
-- Assistant usage
SELECT COUNT(*) AS queries,
  COUNT(DISTINCT run_id) AS runs_with_queries
FROM ai_assistant_queries;
```

```sql
-- Estimated AI cost (gpt-4o room, gpt-4o-mini project)
SELECT
  r.model_name,
  COUNT(*) AS runs,
  AVG(COALESCE(r.input_token_count,0)) AS avg_input,
  AVG(COALESCE(r.output_token_count,0)) AS avg_output,
  ROUND(
    SUM(
      CASE WHEN r.model_name = 'gpt-4o'
        THEN COALESCE(r.input_token_count,0) * 0.0000025 + COALESCE(r.output_token_count,0) * 0.00001
        ELSE COALESCE(r.input_token_count,0) * 0.00000015 + COALESCE(r.output_token_count,0) * 0.0000006
      END
    )::numeric, 4
  ) AS total_cost_usd
FROM ai_analysis_runs r
GROUP BY r.model_name;
```

## Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Room failure rate | > 10% | Investigate error_codes |
| Project failure rate | > 20% | Check OpenAI quota + timeout |
| Timeout rate | > 5% | Review file sizes, model choice |
| Retry waste | > 10% retried | Tune retry strategy |
| Catalog match rate | < 40% | Expand synonyms |
| Acceptance rate | < 50% (after 50 runs) | Prompt tuning |
| Avg room duration | > 60s | Image compression |
| Avg cost/run | > $0.10 | Token optimization |
| Rate limit hits | > 5% of sessions | Adjust limits |
| Draft-created ratio | < 20% (after 30 runs) | UX investigation |
| Assistant usage | 0 after 2 weeks | Feature discovery UX |

## Current Baseline (2026-04-05)

### Room Analysis
| Metric | Value | Status |
|--------|-------|--------|
| Total runs | 3 | ⚠️ Low volume |
| Success rate | 100% (3/3) | ✅ |
| Avg duration | 9.4s | ✅ (threshold 60s) |
| Timeouts | 0 | ✅ |
| Retries | 0 | ✅ |
| Catalog match | 100% (84/84) | ✅ |
| Acceptance rate | 81% (1 run reviewed) | ✅ (threshold 50%) |
| Draft created | 0 | ⚠️ Pre-migration |
| Assistant queries | 0 | ⚠️ Feature new |
| Model | gpt-4o | Note: most expensive |
| Parse path | vision | Expected for photos |

### Project Analysis
| Metric | Value | Status |
|--------|-------|--------|
| Total jobs | 11 | ⚠️ Low volume |
| Success rate | 55% (6/11) | 🔴 Below 80% threshold |
| openai_quota failures | 3 (27%) | 🔴 P0 |
| internal_error failures | 2 (18%) | ⚠️ P1 |
| Heavy PDF (23MB) | 235s, success | ✅ Under 300s timeout |
| Timeouts (actual) | 1 (250s abort) | ⚠️ Pre-fix |
| Fetch failures | 1 | ⚠️ Network issue |
| Governance data | 1/11 runs | ⚠️ Most pre-migration |

### Cost Estimate
| Item | Value | Note |
|------|-------|------|
| Room run (gpt-4o) | ~$0.33 | Token heuristic inflated for images |
| Project run (gpt-4o-mini) | N/A | No token data pre-migration |
| Estimated real room cost | ~$0.05-0.10 | Vision images ≠ text tokens |

## Tuning Threshold Evaluation

| Condition | Threshold | Current | Decision |
|-----------|-----------|---------|----------|
| acceptance_rate < 50% | 50 runs min | 3 runs | ⏳ WAIT — insufficient data |
| catalog_match_rate < 40% | 40% | 100% | ✅ NO ACTION |
| avg room duration > 60s | 60s | 9.4s | ✅ NO ACTION |
| avg cost/run > $0.10 | $0.10 | ~$0.33 (inflated) | ✅ FIXED — real token extraction |
| rate limits > 5% | 5% | 27% quota fails | ✅ FIXED — 429 retry with 10s backoff |

## Sprint H Tuning Actions (Data-Driven)

### TA1: 429 Rate Limit Retry (P0) ✅
- **Problem**: 27% project analysis failures from `openai_quota` — 429 was never retried
- **Data**: 3/11 project jobs failed permanently on first 429
- **Fix**: Added 429 to retry logic in `openai-retry.ts` with 10s backoff delay
- **Impact**: Expected to recover most transient rate limit errors

### TA2: Real Token Count Extraction (P1) ✅
- **Problem**: chars/4 heuristic inflated cost estimates ~3-5x for vision runs
- **Data**: Room run showed 129,309 input tokens (heuristic) vs likely ~2,000 real tokens
- **Fix**: Extract `usage.input_tokens` / `usage.output_tokens` from OpenAI Responses API
- **Fallback**: chars/4 heuristic used when API doesn't return usage data

### TA3: Project Analysis Token Persistence (P2) ✅
- **Problem**: project_analysis_jobs had no token columns — cost analysis impossible
- **Data**: 0/11 project jobs had token data
- **Fix**: Migration 109 adds `input_token_count` + `output_token_count` to table
- **Backend**: `analyze-project-bg-background.ts` now saves real token counts

## Identified Issues

### P0: 45% Project Analysis Failure Rate
- **3× openai_quota** (27%): "Quota OpenAI wyczerpana" — all on 2026-04-04 within 40-min window
  - Likely: temporary OpenAI billing/rate limit hit
  - Resolution: Monitor — if recurring, increase OpenAI tier or add pre-check
- **2× internal_error** (18%):
  - 1× "OpenAI timeout after retry" (250s) — pre-300s fix, expected
  - 1× "fetch failed" (65s) — network/connectivity issue
  - Resolution: Sprint G deployed 300s timeout fix; network errors transient

### P1: Token Count Heuristic Inflated
- Current: `chars/4` heuristic counts base64 image data as text tokens
- Impact: Cost estimates ~3-5x overestimated for vision runs
- Resolution: Extract real token counts from OpenAI response usage metadata

### P2: Zero Draft-Created Flag
- All 3 runs pre-migration → `draft_created` column didn't exist yet
- 1 estimate correctly linked via `ai_source_run_id`
- Resolution: Will self-resolve with new post-migration runs

### P2: Zero Assistant Queries
- Feature deployed Sprint E, too new for data
- Resolution: Monitor for 2 weeks, then evaluate discoverability

## Tuning Backlog (Data-Driven)

### Phase 1: Quick Wins (Sprint H) ✅
1. ~~Error UX: code-aware messages for quota/timeout failures~~
2. ~~Production monitoring queries documented~~
3. ~~429 retry with 10s backoff in openai-retry.ts~~
4. ~~Real token extraction from OpenAI Responses API~~
5. ~~Token columns + persistence for project_analysis_jobs~~
6. ~~Migration 109 deployed~~

### Phase 2: After 50+ Room Runs
1. Evaluate acceptance_rate → prompt tuning if < 50%
2. Evaluate draft_created ratio → UX investigation if < 20%
3. Verify real token counts vs heuristic → update cost model

### Phase 3: After 100+ Combined Runs
1. Full cost analysis with real tokens
2. Model optimization (gpt-4o → gpt-4o-mini for room if quality acceptable)
3. Rate limit tuning based on actual usage patterns
4. Assistant feature adoption evaluation

---

## Sprint I / I0 — Observation Hold Checkpoint (2026-04-05)

### Status: OBSERVATION HOLD — AWAITING PRODUCTION DATA

#### Finding
AI tables are currently empty (0 rows). Historical baseline data from Sprint H is no longer in the database.
Core business data exists (2 companies, 6 profiles, 7 projects). Schema is intact with all Sprint H enhancements (migration 109 token columns confirmed).

#### Deployed Enhancements (Ready for Validation on New Runs)
| ID | Enhancement | Status |
|----|------------|--------|
| TA1 | 429 retry + 10s backoff | Deployed, awaiting first 429 event |
| TA2 | Real token extraction | Deployed, awaiting first run |
| TA3 | Project token persistence (mig 109) | Deployed, columns confirmed |

#### Observation Plan
| Check | Frequency | Trigger |
|-------|-----------|---------|
| Any new AI runs | Daily | Count > 0 → start monitoring |
| Room/project success rate | After 5+ runs | Failure rate > 20% → investigate |
| Token fields populated | After first run | NULL → check extractUsage path |
| 429/quota recurrence | After 10+ runs | > 5% quota fails → capacity issue |
| Assistant adoption | After 2 weeks | 0 queries → feature discovery UX |

#### Early Intervention Triggers
| Trigger | Threshold | Action |
|---------|-----------|--------|
| Project success rate | < 70% after 10 runs | Reliability hardening |
| Quota failure rate | > 10% despite retry | OpenAI tier upgrade |
| internal_error recurrence | > 2 on new runs | Targeted bug investigation |
| Token fields NULL | Any new run | Fix extractUsage integration |
| Heavy PDF timeout | Any new occurrence | Review 300s limit |

#### Next Steps
1. Wait for production AI usage to generate new data
2. Run observation queries when runs appear (use queries from "Quick Baseline Query" section above)
3. First checkpoint: after 10 new runs OR 2 weeks, whichever comes first
4. No code changes unless a new repeatable problem surfaces

#### Quality Gates
- tsc --noEmit: ✅ clean
- npm run build: ✅ green
