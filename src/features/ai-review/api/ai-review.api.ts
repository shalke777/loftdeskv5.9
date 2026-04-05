// =============================================================================
// src/features/ai-review/api/ai-review.api.ts
// =============================================================================
// Read model for AI analysis data. Provides typed query helpers for:
//   - listing runs per project
//   - loading a single run with its full bundle
//   - recording operator review actions
//
// All queries are scoped to the authenticated user's company via Supabase RLS.
// company_id is enforced by the database — never sent in query params.

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Row types (minimal — extend as UI needs grow) ─────────────────────────────

export interface AiAnalysisRun {
  id:                  string
  company_id:          string
  project_id:          string
  created_by:          string
  status:              'draft' | 'processing' | 'completed' | 'failed'
  room_type:           'bathroom' | 'wc'
  text_description:    string | null
  clarification:       Record<string, unknown> | null
  dimensions_json:     Record<string, unknown> | null
  notes:               string | null
  input_summary:       string | null
  missing_data:        boolean
  confidence_summary:  number | null
  model_name:          string | null
  started_at:          string | null
  completed_at:        string | null
  error_code:          string | null
  error_message:       string | null
  created_at:          string
  updated_at:          string
  // Sprint F governance fields (nullable — populated after migration 106)
  retry_count?:           number | null
  timeout_occurred?:      boolean | null
  request_duration_ms?:   number | null
  parse_path?:            string | null
  input_token_count?:     number | null
  output_token_count?:    number | null
  draft_created?:         boolean | null
  input_file_size_bytes?: number | null
}

export interface AiScopeItem {
  id:                          string
  run_id:                      string
  company_id:                  string
  project_id:                  string
  library_id:                  string | null
  title:                       string | null
  description:                 string
  category:                    string
  unit:                        string | null
  quantity_suggested:          number | null
  price_suggested_by_ai:       number | null
  confidence:                  number | null
  sort_order:                  number
  source_kind:                 'direct_detected' | 'dependency_inferred' | 'confirmation_needed' | null
  scope_layer:                 'EXECUTION_SCOPE' | 'HIDDEN_PROBABLE_SCOPE' | null
  review_status:               'pending' | 'accepted' | 'modified' | 'rejected'
  quantity_final:              number | null
  price_confirmed_by_operator: number | null
  missing_price:               boolean
  created_at:                  string
}

export interface AiQuestion {
  id:              string
  run_id:          string
  text:            string
  severity:        'critical_for_scope' | 'important_for_accuracy' | 'optional_detail'
  category:        string | null
  answer_type:     'text' | 'yesno' | 'choice' | 'number'
  options:         Array<{ value: string; label: string }> | null
  status:          'unanswered' | 'answered' | 'skipped'
  operator_answer: string | null
  sort_order:      number
  created_at:      string
}

export interface AiRisk {
  id:             string
  run_id:         string
  title:          string
  description:    string | null
  severity:       'high' | 'medium' | 'low'
  risk_type:      'scope' | 'technical' | 'timeline' | 'compliance'
  status:         'open' | 'acknowledged' | 'resolved'
  operator_notes: string | null
  sort_order:     number
  created_at:     string
}

export interface AiInputAsset {
  id:                string
  run_id:            string
  company_id:        string
  project_id:        string
  storage_path:      string
  original_filename: string
  mime_type:         string
  file_size:         number
  status:            'uploaded' | 'failed'
  created_at:        string
}

export interface AiReviewActionInsert {
  company_id:       string
  project_id:       string
  run_id:           string
  scope_item_id?:   string
  question_id?:     string
  risk_id?:         string
  // scope item actions: 'accepted' | 'modified' | 'rejected'
  // question actions:   'answered'
  // risk actions:       'acknowledged' | 'resolved'
  action_type:      'accepted' | 'modified' | 'rejected' | 'answered' | 'acknowledged' | 'resolved'
  original_payload: Record<string, unknown>
  review_payload?:  Record<string, unknown>  // contains operator answer / notes
  review_reason?:   string
  reviewed_by:      string
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** List all AI runs for a project, newest first. */
export async function getAiRunsForProject(
  sb: SupabaseClient,
  projectId: string,
): Promise<AiAnalysisRun[]> {
  const { data, error } = await sb
    .from('ai_analysis_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AiAnalysisRun[]
}

/** Fetch a single run record by ID. */
export async function getAiRunById(
  sb: SupabaseClient,
  runId: string,
): Promise<AiAnalysisRun | null> {
  const { data, error } = await sb
    .from('ai_analysis_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle()

  if (error) throw error
  return data as AiAnalysisRun | null
}

/** Fetch scope items for a run, ordered by sort_order. */
export async function getAiScopeItems(
  sb: SupabaseClient,
  runId: string,
): Promise<AiScopeItem[]> {
  const { data, error } = await sb
    .from('ai_scope_items')
    .select('*')
    .eq('run_id', runId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as AiScopeItem[]
}

/** Fetch structured questions for a run, ordered by sort_order. */
export async function getAiQuestions(
  sb: SupabaseClient,
  runId: string,
): Promise<AiQuestion[]> {
  const { data, error } = await sb
    .from('ai_questions')
    .select('*')
    .eq('run_id', runId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as AiQuestion[]
}

/** Fetch risks for a run, ordered by severity then sort_order. */
export async function getAiRisks(
  sb: SupabaseClient,
  runId: string,
): Promise<AiRisk[]> {
  const { data, error } = await sb
    .from('ai_risks')
    .select('*')
    .eq('run_id', runId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as AiRisk[]
}

/**
 * Record an operator review action (immutable audit log).
 * For scope items: also updates the denormalized review_status on ai_scope_items.
 * For questions and risks: the action is the source of truth — no direct UPDATE
 * on ai_questions or ai_risks (those tables have no client UPDATE policy).
 */
export async function insertReviewAction(
  sb: SupabaseClient,
  action: AiReviewActionInsert,
): Promise<void> {
  const { error: actionErr } = await sb
    .from('ai_review_actions')
    .insert(action)

  if (actionErr) throw actionErr

  // Update scope item review_status (denormalized read helper) only for scope actions
  const isScopeAction = (['accepted', 'modified', 'rejected'] as AiReviewActionInsert['action_type'][]).includes(action.action_type)
  if (isScopeAction && action.scope_item_id) {
    const { error: itemErr } = await sb
      .from('ai_scope_items')
      .update({ review_status: action.action_type })
      .eq('id', action.scope_item_id)

    if (itemErr) throw itemErr
  }
}

// answerAiQuestion() and updateAiRiskStatus() are intentionally removed.
// Operator answers and risk status changes must be recorded via insertReviewAction:
//   - questions: action_type = 'answered', review_payload = { answer: '...' }
//   - risks:     action_type = 'acknowledged' | 'resolved', review_payload = { notes: '...' }
// ai_review_actions is the source of truth for all review decisions.

/** Fetch input assets (uploaded photos) recorded for a run. */
export async function getAiInputAssets(
  sb: SupabaseClient,
  runId: string,
): Promise<AiInputAsset[]> {
  const { data, error } = await sb
    .from('ai_input_assets')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as AiInputAsset[]
}

// ── Sprint 4 / 091: duplicate-estimate guard ──────────────────────────────────

/** Minimal shape returned when checking for an existing AI-sourced estimate. */
export interface ExistingAiEstimate {
  id:     string
  number: string
  name:   string
}

/**
 * Returns the estimate that was already created from the given AI run,
 * or null if none exists yet.
 * Used by the UI guard to replace the CTA with a "already exists" notice.
 * The DB partial-unique index (migration 091) is the real enforcement layer.
 */
export async function getEstimateByAiRunId(
  sb: SupabaseClient,
  runId: string,
): Promise<ExistingAiEstimate | null> {
  const { data, error } = await sb
    .from('cost_estimates')
    .select('id, number, name')
    .eq('ai_source_run_id', runId)
    .maybeSingle()

  if (error) throw error
  return data as ExistingAiEstimate | null
}

// ── Sprint 5 / 092: per-run observability stats ───────────────────────────────

/**
 * Row type for v_ai_run_stats (migration 092).
 * acceptance_rate is 0–100 (percentage) or null when no scope items exist.
 * estimate_candidate_count = accepted + modified scope items — NOT cost_estimate_items rows.
 */
export interface AiRunStats {
  run_id:                  string
  company_id:              string
  project_id:              string
  room_type:               'bathroom' | 'wc'
  status:                  'draft' | 'processing' | 'completed' | 'failed'
  confidence_summary:      number | null
  created_at:              string
  total_scope_items:       number
  accepted_count:          number
  modified_count:          number
  rejected_count:          number
  pending_count:           number
  acceptance_rate:         number | null
  estimate_candidate_count: number
  missing_price_count:     number
  has_estimate_draft:      boolean
}

/**
 * Fetches stats for ALL runs in a project in a single query.
 * ProjectAiTab calls this once and passes a statsMap down to child components
 * to avoid N+1 per-run queries.
 */
export async function getAiRunStatsForProject(
  sb: SupabaseClient,
  projectId: string,
): Promise<AiRunStats[]> {
  const { data, error } = await sb
    .from('v_ai_run_stats')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AiRunStats[]
}
