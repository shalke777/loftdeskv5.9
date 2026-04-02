// =============================================================================
// src/features/ai-review/hooks/useAiBundles.ts
// =============================================================================
// React hook for listing bundles per project and loading a single bundle
// with its assets. Ready for future UI integration.
//
// Uses TanStack Query pattern matching the rest of the ai-review feature.
// =============================================================================

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { netlifyFn } from '@/shared/lib/functions'
import {
  listBundlesForProject,
  getBundleWithAssets,
  getBundleEvidenceSummary,
} from '../api/ai-bundle.api'
import { assessBundleReadiness } from '@/services/ai/composite/bundle-readiness'
import type { BundleReadinessSummary } from '@/services/ai/composite/bundle-readiness'
import { buildReviewQueue } from '@/services/ai/composite/fusion.review'
import type { FusionReviewQueue } from '@/services/ai/composite/fusion.types'

export function useBundlesForProject(projectId: string | undefined) {
  return useQuery({
    queryKey:  ['ai-bundles', projectId],
    queryFn:   () => listBundlesForProject(supabase!, projectId!),
    enabled:   Boolean(projectId) && Boolean(supabase),
    staleTime: 30_000,
  })
}

export function useBundleWithAssets(bundleId: string | undefined) {
  return useQuery({
    queryKey:  ['ai-bundle', bundleId],
    queryFn:   () => getBundleWithAssets(supabase!, bundleId!),
    enabled:   Boolean(bundleId) && Boolean(supabase),
    staleTime: 15_000,
  })
}

export function useBundleEvidenceSummary(bundleId: string | undefined) {
  return useQuery({
    queryKey:  ['ai-bundle-evidence-summary', bundleId],
    queryFn:   () => getBundleEvidenceSummary(supabase!, bundleId!),
    enabled:   Boolean(bundleId) && Boolean(supabase),
    staleTime: 15_000,
  })
}

export function useBundleReadiness(bundleId: string | undefined) {
  return useQuery({
    queryKey:  ['ai-bundle-readiness', bundleId],
    queryFn:   () => assessBundleReadiness(supabase!, bundleId!),
    enabled:   Boolean(bundleId) && Boolean(supabase),
    staleTime: 30_000,
  })
}

/**
 * Project-scoped readiness: finds the latest bundle for a project,
 * then assesses its composite readiness.
 * Returns { readiness, bundleCount, isLoading, isError }.
 */
export function useProjectBundleReadiness(projectId: string | undefined) {
  const bundlesQuery = useBundlesForProject(projectId)
  const latestBundleId = bundlesQuery.data?.[0]?.id
  const readinessQuery = useBundleReadiness(latestBundleId)

  return {
    readiness:   readinessQuery.data as BundleReadinessSummary | undefined,
    bundleCount: bundlesQuery.data?.length ?? 0,
    isLoading:   bundlesQuery.isLoading || (Boolean(latestBundleId) && readinessQuery.isLoading),
    isError:     bundlesQuery.isError || readinessQuery.isError,
  }
}

/**
 * Fetch fusion output via bundle-fusion Netlify function,
 * then build a FusionReviewQueue client-side using buildReviewQueue().
 *
 * Only enabled when bundleId is provided and the bundle is eligible.
 * Stale time: 60s — fusion is pure compute, result is deterministic.
 */
async function fetchFusionReviewQueue(bundleId: string): Promise<FusionReviewQueue> {
  if (!supabase) throw new Error('Supabase not initialised')
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const res = await fetch(netlifyFn('bundle-fusion'), {
    method:  'POST',
    headers,
    body:    JSON.stringify({ bundle_id: bundleId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `bundle-fusion error ${res.status}`)
  }
  const output = await res.json()
  return buildReviewQueue(output)
}

export function useFusionReviewQueue(
  bundleId: string | undefined,
  eligible: boolean,
) {
  return useQuery<FusionReviewQueue, Error>({
    queryKey:  ['fusion-review-queue', bundleId],
    queryFn:   () => fetchFusionReviewQueue(bundleId!),
    enabled:   Boolean(bundleId) && eligible,
    staleTime: 60_000,
    retry:     1,
  })
}
