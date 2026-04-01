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
import {
  listBundlesForProject,
  getBundleWithAssets,
  getBundleEvidenceSummary,
} from '../api/ai-bundle.api'

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
