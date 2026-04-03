// =============================================================================
// src/features/ai-review/hooks/useAiReview.ts
// =============================================================================
// TanStack Query hooks for the AI review read model and mutations.
// Wraps ai-review.api.ts — all queries are scoped to the current user via RLS.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { estimatesApi } from '@/features/estimates/api/estimates.api'
import {
  getAiRunsForProject,
  getAiScopeItems,
  getAiQuestions,
  getAiRisks,
  insertReviewAction,
  getEstimateByAiRunId,
  getAiRunStatsForProject,
  type AiAnalysisRun,
  type AiScopeItem,
  type AiReviewActionInsert,
  type ExistingAiEstimate,
  type AiRunStats,
} from '../api/ai-review.api'
import {
  mapAiScopeToEstimateItems,
  buildAiEstimateName,
} from '../lib/mapAiScopeToEstimate'

// ── Query key factory ─────────────────────────────────────────────────────────

export const aiKeys = {
  runs:           (projectId: string) => ['ai-review', 'runs', projectId]        as const,
  scope:          (runId: string)     => ['ai-review', 'scope', runId]            as const,
  questions:      (runId: string)     => ['ai-review', 'questions', runId]        as const,
  risks:          (runId: string)     => ['ai-review', 'risks', runId]            as const,
  estimateForRun: (runId: string)     => ['ai-review', 'estimate-for-run', runId] as const,
  stats:          (projectId: string) => ['ai-review', 'stats', projectId]        as const,
}

// Re-export for consumers that import from the hook layer
export type { AiRunStats }

// ── Read hooks ────────────────────────────────────────────────────────────────

export function useAiRunsForProject(projectId: string) {
  return useQuery({
    queryKey: aiKeys.runs(projectId),
    queryFn:  () => getAiRunsForProject(supabase!, projectId),
    enabled:  Boolean(supabase && projectId),
  })
}

/**
 * Sprint 5 — Fetches v_ai_run_stats for all runs in a project (single query).
 * Returns an array; caller builds a Record<runId, AiRunStats> map as needed.
 */
export function useAiRunStatsForProject(projectId: string) {
  return useQuery<AiRunStats[]>({
    queryKey: aiKeys.stats(projectId),
    queryFn:  () => getAiRunStatsForProject(supabase!, projectId),
    enabled:  Boolean(supabase && projectId),
  })
}

export function useAiScopeItems(runId: string | null) {
  return useQuery({
    queryKey: aiKeys.scope(runId ?? ''),
    queryFn:  () => getAiScopeItems(supabase!, runId!),
    enabled:  Boolean(supabase && runId),
  })
}

export function useAiQuestions(runId: string | null) {
  return useQuery({
    queryKey: aiKeys.questions(runId ?? ''),
    queryFn:  () => getAiQuestions(supabase!, runId!),
    enabled:  Boolean(supabase && runId),
  })
}

export function useAiRisks(runId: string | null) {
  return useQuery({
    queryKey: aiKeys.risks(runId ?? ''),
    queryFn:  () => getAiRisks(supabase!, runId!),
    enabled:  Boolean(supabase && runId),
  })
}

// ── Mutation hook ─────────────────────────────────────────────────────────────

/**
 * Checks whether an estimate draft was already created from the given AI run.
 * Returns the existing estimate (id + number + name) or undefined if none.
 * This is the UI layer of the duplicate-prevention guard — the DB unique index
 * (migration 091) is the authoritative enforcement layer.
 */
export function useExistingAiEstimate(runId: string | null) {
  return useQuery<ExistingAiEstimate | null>({
    queryKey: aiKeys.estimateForRun(runId ?? ''),
    queryFn:  () => getEstimateByAiRunId(supabase!, runId!),
    enabled:  Boolean(supabase && runId),
  })
}

export function useInsertReviewAction(runId: string, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (action: AiReviewActionInsert) => insertReviewAction(supabase!, action),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiKeys.scope(runId) })
      void qc.invalidateQueries({ queryKey: aiKeys.questions(runId) })
      void qc.invalidateQueries({ queryKey: aiKeys.risks(runId) })
      void qc.invalidateQueries({ queryKey: aiKeys.runs(projectId) })
      void qc.invalidateQueries({ queryKey: aiKeys.estimateForRun(runId) })
    },
  })
}

// ── Sprint 4: AI → Estimate draft mutation ────────────────────────────────────

export interface CreateEstimateFromRunInput {
  run:        AiAnalysisRun
  scopeItems: AiScopeItem[]
  companyId:  string
  projectId:  string
}

export interface CreateEstimateFromRunResult {
  estimateId:     string
  estimateNumber: string
  itemCount:      number
}

/**
 * Creates an estimate draft from the accepted/modified scope items of an AI run.
 * Only explicit operator CTA — never called automatically.
 * Writes ai_source_run_id to cost_estimates for full audit trail.
 */
export function useCreateEstimateFromRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      run,
      scopeItems,
      companyId,
      projectId,
    }: CreateEstimateFromRunInput): Promise<CreateEstimateFromRunResult> => {
      const items = mapAiScopeToEstimateItems(scopeItems)
      if (items.length === 0) {
        throw new Error('Brak zaakceptowanych pozycji. Zaakceptuj lub zmodyfikuj co najmniej jedną pozycję zakresu.')
      }

      const name = buildAiEstimateName(run.room_type, run.created_at)

      const estimate = await estimatesApi.create({
        company_id:       companyId,
        project_id:       projectId,
        client_id:        null,   // operator fills client in estimate editor
        name,
        status:           'draft',
        notes:            undefined,
        valid_until:      null,
        items,
        ai_source_run_id: run.id,
      })

      return {
        estimateId:     estimate.id,
        estimateNumber: estimate.number,
        itemCount:      items.length,
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate the DB guard query so the panel immediately shows the
      // "already exists" notice if reopened or if the same run is opened
      // in another tab after creation.
      void qc.invalidateQueries({ queryKey: aiKeys.estimateForRun(variables.run.id) })
    },
  })
}
