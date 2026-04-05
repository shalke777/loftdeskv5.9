# POST-SPRINT AI RELEASE VERIFICATION + TUNING PLAN
## LoftDesk v5.9 — Sprinty A–F Complete

---

## 1. RELEASE VERIFICATION CHECKLIST

### 1.1 Pre-Deploy
- [ ] Migrations 106, 107, 108 deployed via `supabase db push`
- [ ] Verify `my_company_id()` function exists (required by all governance views)
- [ ] Verify `check_rate_limit` RPC exists
- [ ] Confirm env vars on Netlify:
  - `OPENAI_API_KEY` — active, paid account
  - `VITE_AI_ENGINE_ENABLED=true`
  - `AI_DAILY_LIMIT` (default: 50)
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 1.2 Room Analysis (analyze-room-photo)
| # | Test | Expected | Pass |
|---|------|----------|------|
| 1 | Upload 1 photo łazienki (< 1MB), run analysis | Completes < 60s, scope items generated | [ ] |
| 2 | Upload 3 photos łazienki (total ~5MB) | Completes < 120s | [ ] |
| 3 | Upload 5 photos (max) | All processed, governance row populated | [ ] |
| 4 | Verify governance row in `ai_analysis_runs` | `retry_count`, `request_duration_ms`, `parse_path='vision'`, `input_file_size_bytes`, token counts present | [ ] |
| 5 | Trigger 9th request within 10 min | 429 rate limit returned | [ ] |
| 6 | Verify daily limit at 50 | Counter increments in ai_daily_usage | [ ] |

### 1.3 Project Analysis (analyze-project-bg-background)
| # | Test | Expected | Pass |
|---|------|----------|------|
| 7 | Upload small PDF (< 2 MB) with text | Completes via text path, `parse_path='text'` | [ ] |
| 8 | Upload medium PDF (5–10 MB) with images | Vision path used, `parse_path='vision'` | [ ] |
| 9 | Upload heavy PDF (20–30 MB) | Completes within 300s timeout, `is_heavy_pdf=true` in view | [ ] |
| 10 | Upload 41 MB file | Rejected with `file_too_large` error | [ ] |
| 11 | Verify `project_analysis_jobs` row | `retry_count`, `timeout_occurred`, `request_duration_ms`, `parse_path`, `input_file_size_bytes` all populated | [ ] |

### 1.4 Review → Draft Estimate
| # | Test | Expected | Pass |
|---|------|----------|------|
| 12 | Accept 3+ scope items, click "Utwórz wycenę roboczą" | Draft estimate created, `draft_created=true` in runs table | [ ] |
| 13 | Reopen same run | Shows "Otwórz wyceny →" instead of create button | [ ] |
| 14 | Reject all items | Message: "Wszystkie pozycje zostały odrzucone" | [ ] |
| 15 | Accept items with missing prices | Yellow warning banner about 0 zł prices | [ ] |
| 16 | Verify `cost_estimates.ai_source_run_id` links to run | FK correct | [ ] |

### 1.5 Catalog Match Visibility
| # | Test | Expected | Pass |
|---|------|----------|------|
| 17 | Run with standard bathroom items | 📚 green badges on matched items | [ ] |
| 18 | Run with unusual items | ✍️ gray badges on unmatched items | [ ] |
| 19 | Check "📚 Katalog: X/Y (Z%)" summary | Counts match actual items | [ ] |
| 20 | Match rate < 50% | "⚠ niska pokrywalność" warning visible | [ ] |

### 1.6 AI Assistant Panel
| # | Test | Expected | Pass |
|---|------|----------|------|
| 21 | Click preset chip "Co AI wykryło?" | Instant local answer (no API call) | [ ] |
| 22 | Click all 6 preset chips | Each returns distinct answer from run data | [ ] |
| 23 | Type custom question, click "Zapytaj" | Backend call, answer with "(odpowiedź AI)" badge | [ ] |
| 24 | Send 21st custom question within 10 min | 429 rate limit message | [ ] |
| 25 | Verify `ai_assistant_queries` row | `company_id`, `project_id`, `run_id`, `user_id`, `question`, `answer_source='ai'`, `duration_ms` all populated | [ ] |

### 1.7 Governance Telemetry
| # | Test | Expected | Pass |
|---|------|----------|------|
| 26 | Query `v_ai_run_stats` for completed run | All governance columns populated: retry_count, timeout_occurred, duration, tokens, draft_created, match counts | [ ] |
| 27 | Query `v_ai_company_usage` | Daily row with total_runs, completed_runs, estimated_cost_usd, heavy_pdf_runs | [ ] |
| 28 | Query `v_ai_company_usage_weekly` | Weekly aggregation correct | [ ] |
| 29 | Verify governance bar in UI | Shows 🧠 model, ⏱ duration, 📎 parse_path, 🔢 tokens, 📦 file size | [ ] |
| 30 | Run with timeout (simulate via large payload) | ⚠ timeout badge visible, timeout_occurred=true in DB | [ ] |

---

## 2. KEY METRICS TO OBSERVE POST-RELEASE

### 2.1 Reliability Metrics

| Metric | Source | Query |
|--------|--------|-------|
| **Retry rate** | v_ai_run_stats | `SELECT COUNT(*) FILTER (WHERE retry_count > 0)::float / COUNT(*) FROM v_ai_run_stats WHERE created_at > NOW() - INTERVAL '7 days'` |
| **Timeout rate** | v_ai_run_stats | `... FILTER (WHERE timeout_occurred)` |
| **Failure rate** | v_ai_run_stats | `... FILTER (WHERE status = 'failed')` |
| **Avg request duration** | v_ai_run_stats | `AVG(request_duration_ms)` grouped by parse_path |
| **P95 request duration** | v_ai_run_stats | `PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY request_duration_ms)` |

### 2.2 Quality Metrics

| Metric | Source | Query |
|--------|--------|-------|
| **Parse path distribution** | v_ai_run_stats | `COUNT(*) GROUP BY parse_path` |
| **Draft created ratio** | v_ai_run_stats | `COUNT(*) FILTER (WHERE draft_created) / COUNT(*) FILTER (WHERE status = 'completed')` |
| **Acceptance rate** | v_ai_run_stats | `AVG(acceptance_rate) WHERE status = 'completed'` |
| **Catalog match rate** | v_ai_run_stats | `AVG(catalog_match_rate) WHERE total_scope_items > 0` |
| **Items per run** | v_ai_run_stats | `AVG(total_scope_items)` |

### 2.3 Usage & Cost Metrics

| Metric | Source | Query |
|--------|--------|-------|
| **Runs per day** | v_ai_company_usage | `SUM(total_runs)` by day |
| **Estimated cost per run** | v_ai_run_stats | `(input_token_count * 0.00000015 + output_token_count * 0.0000006)` |
| **Daily cost per company** | v_ai_company_usage | `estimated_cost_usd` |
| **Weekly cost trend** | v_ai_company_usage_weekly | `estimated_cost_usd` by week |
| **Heavy PDF frequency** | v_ai_company_usage | `heavy_pdf_runs / total_runs` |
| **Assistant usage** | v_ai_company_usage_weekly | `assistant_queries` per week |

---

## 3. ALERT THRESHOLDS

| Metric | 🟢 Healthy | 🟡 Warning | 🔴 Critical | Action |
|--------|-----------|------------|-------------|--------|
| **Timeout rate** | < 5% | 5–15% | > 15% | Increase timeoutMs or investigate model latency |
| **Retry rate** | < 10% | 10–25% | > 25% | Check OpenAI status page, consider fallback |
| **Failure rate** | < 5% | 5–15% | > 15% | Check error_code distribution, may need retry tuning |
| **Avg duration (room)** | < 30s | 30–60s | > 60s | Review image count/size, consider compression |
| **Avg duration (project text)** | < 40s | 40–90s | > 90s | Check PDF text extraction quality |
| **Avg duration (project vision)** | < 120s | 120–200s | > 200s | Heavy PDF path, may need chunking |
| **Draft created ratio** | > 40% | 20–40% | < 20% | AI output quality too low, review prompt |
| **Acceptance rate** | > 60% | 40–60% | < 40% | Prompt tuning needed, items not useful |
| **Catalog match rate** | > 50% | 30–50% | < 30% | Expand synonym map, improve library_id matching |
| **Cost per run** | < $0.05 | $0.05–0.15 | > $0.15 | Check if vision path overused, optimize tokens |
| **Daily cost per company** | < $2 | $2–5 | > $5 | Review daily limit, consider tier-based caps |
| **Heavy PDF ratio** | < 20% | 20–40% | > 40% | Users uploading large files; text-first path mitigates |
| **Items per run** | 5–40 | 1–4 or 41–80 | 0 or > 80 | Prompt scope calibration needed |

---

## 4. FIRST TUNING PASS (Data-Driven, No Broad Refactor)

### Phase 1: Observation (Week 1–2)
- Deploy migrations, enable governance tracking
- Collect baseline from first 50–100 runs
- Identify actual timeout/retry/failure distributions
- Verify token count estimates vs. real patterns

### Phase 2: Quick Wins (Week 2–3, based on data)

| Signal | Tuning Action | Effort |
|--------|--------------|--------|
| Vision path overused (> 60%) | Tune `isPdfProjectTextUsable()` — lower threshold for text quality | 2h |
| Catalog match < 40% | Expand synonym map in `CATALOG_REFERENCE`, add common misspellings | 3h |
| Acceptance rate < 50% | Adjust prompt confidence thresholds, improve `source_kind` classification | 3h |
| Timeout > 10% on room photos | Reduce default image dimensions before base64 encoding | 2h |
| Avg cost per run > $0.10 | Consider `max_output_tokens` reduction (6000→4000 for room, 8000→6000 for project) | 1h |
| Draft ratio < 25% | Add post-analysis nudge CTA or improve review UX flow | 3h |
| Assistant questions repetitive | Add more preset chips based on most common custom questions | 2h |

### Phase 3: Targeted Improvements (Week 3–4)

| Area | Action | Condition |
|------|--------|-----------|
| **Token optimization** | Compress prompt instructions, remove redundant context | If avg tokens > 4000 |
| **Timeout tuning** | Adjust per-path timeouts based on P95 observed durations | If P95 > 0.8 × timeout |
| **Rate limit tuning** | Adjust room: 8/10min and assistant: 20/10min based on actual usage patterns | If limits hit > 5% of sessions |
| **Daily limit** | Adjust from 50 based on actual usage vs. plan tier | If companies regularly hit limit |

---

## 5. TOP 5 RECOMMENDED NEXT IMPROVEMENTS

### Priority 1: Real Token Usage Tracking
**Why**: Current heuristic (chars/4) is ~30% inaccurate. Real token counts enable precise cost control.
**How**: Parse `usage` field from OpenAI Responses API (if available) or use `tiktoken` server-side.
**Impact**: Accurate cost reporting, better budget alerts.

### Priority 2: Prompt Tuning Based on Acceptance Data
**Why**: After 100+ runs, acceptance_rate reveals which item categories users consistently reject.
**How**: Query `v_ai_run_stats` for runs with < 40% acceptance → analyze rejected items → adjust prompt weighting.
**Impact**: Higher draft conversion, less operator friction.

### Priority 3: Image Compression Before Upload
**Why**: Room photos from phones are 3–8 MB each. GPT-4o processes 512px tiles internally.
**How**: Client-side resize to max 2048px before base64 encoding. Saves tokens + reduces timeout risk.
**Impact**: 50–70% token savings on room analysis, faster response.

### Priority 4: Governance Dashboard Page
**Why**: v_ai_run_stats and v_ai_company_usage exist but aren't surfaced in admin UI.
**How**: Simple read-only page with key metrics: daily runs, cost trend, timeout count, acceptance rate.
**Impact**: Operational visibility without SQL access.

### Priority 5: Catalog Match Feedback Loop
**Why**: Unmatched items indicate catalog gaps or synonym blind spots.
**How**: Aggregate `catalog_unmatched_count` patterns → auto-suggest new catalog entries or synonyms.
**Impact**: Match rate improves over time, less manual catalog maintenance.

---

## 6. KNOWN RISKS REMAINING

| Risk | Severity | Mitigation |
|------|----------|------------|
| **OpenAI outage** | High | Retry wrapper handles transient; no fallback provider for sustained outage |
| **Token cost spike** | Medium | Daily limit (50), but no per-company budget cap; v_ai_company_usage enables manual monitoring |
| **Heavy PDF timeout** | Medium | 300s timeout covers most cases; 40MB file limit helps; beyond that, chunking needed |
| **Prompt drift** | Low | Model updates (gpt-4o-mini versions) may change output quality; monitor acceptance_rate |
| **RLS bypass risk** | Low | All governance views use `my_company_id()`; audit table uses service role for writes |
| **Heuristic token counts** | Low | chars/4 approximation; real usage may differ 20–30%; affects cost estimates only |

---

## 7. SQL VERIFICATION QUERIES (Post-Migration)

```sql
-- Verify migration 108 applied
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ai_analysis_runs' AND column_name = 'input_file_size_bytes';

-- Check governance data is flowing
SELECT run_id, retry_count, timeout_occurred, request_duration_ms, parse_path,
       input_token_count, output_token_count, draft_created, input_file_size_bytes,
       is_heavy_pdf, catalog_matched_count, catalog_unmatched_count, catalog_match_rate
FROM v_ai_run_stats
ORDER BY created_at DESC LIMIT 10;

-- Daily usage
SELECT * FROM v_ai_company_usage ORDER BY day DESC LIMIT 7;

-- Weekly usage
SELECT * FROM v_ai_company_usage_weekly ORDER BY week_start DESC LIMIT 4;

-- Assistant audit
SELECT * FROM ai_assistant_queries ORDER BY created_at DESC LIMIT 10;

-- Alert: high timeout rate
SELECT
  COUNT(*) FILTER (WHERE timeout_occurred) AS timeout_count,
  COUNT(*) AS total,
  ROUND(COUNT(*) FILTER (WHERE timeout_occurred)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS timeout_pct
FROM v_ai_run_stats
WHERE created_at > NOW() - INTERVAL '7 days';
```

---

*Generated: 2026-04-05 | Sprints A–F complete | Migrations 106–108 deployed ✅ (afc6ea5c)*
