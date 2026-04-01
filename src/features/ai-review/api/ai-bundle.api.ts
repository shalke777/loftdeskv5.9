// =============================================================================
// src/features/ai-review/api/ai-bundle.api.ts
// =============================================================================
// Read model for Composite Project Analysis bundles.
// Provides typed query helpers for:
//   - listing bundles per project
//   - loading a single bundle with its assets
//   - reading extraction evidence summary per bundle
//
// All queries are scoped via Supabase RLS (company_id enforced by DB).
// These queries use the user-facing client (not service role).
//
// NOT a replacement for ai-review.api.ts — that remains frozen for P0.
// This file extends the ai-review feature read surface for P1 bundles.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiAnalysisBundle, AiBundleAsset } from '@/services/ai/composite/bundle.types'

// ── Extraction result read shape (subset of ai_extraction_results) ────────────

export interface AiExtractionResultRow {
  id:                 string
  bundle_id:          string
  asset_id:           string
  evidence_type:      string
  content:            Record<string, unknown>
  room_label:         string | null
  confidence_score:   number | null
  confidence_reason:  string | null
  source_anchor:      string | null
  conflict_ids:       string[]
  fused:              boolean
  created_at:         string
}

export interface BundleWithAssets {
  bundle:  AiAnalysisBundle
  assets:  AiBundleAsset[]
}

export interface BundleEvidenceSummary {
  bundle_id:           string
  total_evidence:      number
  by_type:             Record<string, number>
  has_tile_spec:       boolean     // R-26 gold truth present
  has_conflicts:       boolean
  missing_data_count:  number
  unfused_count:       number
}

// ── Query: list bundles per project ──────────────────────────────────────────

export async function listBundlesForProject(
  client:    SupabaseClient,
  projectId: string,
): Promise<AiAnalysisBundle[]> {
  const { data, error } = await client
    .from('ai_analysis_bundles')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`listBundlesForProject failed: ${error.message}`)
  return (data ?? []) as AiAnalysisBundle[]
}

// ── Query: get a single bundle with its assets ────────────────────────────────

export async function getBundleWithAssets(
  client:   SupabaseClient,
  bundleId: string,
): Promise<BundleWithAssets | null> {
  const [bundleRes, assetsRes] = await Promise.all([
    client
      .from('ai_analysis_bundles')
      .select('*')
      .eq('id', bundleId)
      .single(),
    client
      .from('ai_bundle_assets')
      .select('*')
      .eq('bundle_id', bundleId)
      .order('source_priority', { ascending: true }),
  ])

  if (bundleRes.error) throw new Error(`getBundleWithAssets bundle: ${bundleRes.error.message}`)
  if (!bundleRes.data) return null
  if (assetsRes.error) throw new Error(`getBundleWithAssets assets: ${assetsRes.error.message}`)

  return {
    bundle: bundleRes.data as AiAnalysisBundle,
    assets: (assetsRes.data ?? []) as AiBundleAsset[],
  }
}

// ── Query: extraction evidence per bundle ─────────────────────────────────────

export async function getExtractionResultsForBundle(
  client:   SupabaseClient,
  bundleId: string,
): Promise<AiExtractionResultRow[]> {
  const { data, error } = await client
    .from('ai_extraction_results')
    .select('*')
    .eq('bundle_id', bundleId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`getExtractionResultsForBundle failed: ${error.message}`)
  return (data ?? []) as AiExtractionResultRow[]
}

// ── Query: evidence summary (derived — no extra table) ────────────────────────

export async function getBundleEvidenceSummary(
  client:   SupabaseClient,
  bundleId: string,
): Promise<BundleEvidenceSummary> {
  const rows = await getExtractionResultsForBundle(client, bundleId)

  const by_type: Record<string, number> = {}
  for (const row of rows) {
    by_type[row.evidence_type] = (by_type[row.evidence_type] ?? 0) + 1
  }

  return {
    bundle_id:          bundleId,
    total_evidence:     rows.length,
    by_type,
    has_tile_spec:      (by_type['tile_spec'] ?? 0) > 0,
    has_conflicts:      (by_type['conflict'] ?? 0) > 0,
    missing_data_count: by_type['missing_data'] ?? 0,
    unfused_count:      rows.filter((r) => !r.fused).length,
  }
}
