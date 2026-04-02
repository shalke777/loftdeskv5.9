// =============================================================================
// src/services/ai/composite/bundle-readiness.ts
// =============================================================================
// Bundle Readiness Processor — minimal P1 skeleton.
//
// Evaluates whether a bundle is ready for composite extraction / fusion.
// Does NOT generate scope, estimate, or run extractors — only assesses readiness.
//
// Consumes foundation wired in previous P1 steps:
//   - isBundleEligibleForComposite() — R-C-37 visualization_pack guard
//   - getStructuralMissingData() — format-level missing-data signals
//   - DOCUMENT_LAYER_META — mustUse / confidenceCap per layer
//   - BUNDLE_DOCUMENT_TYPES — expectedMustUseLayers per document type
//
// Does NOT touch P0 tables or confidence-model.ts.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AiAnalysisBundle,
  AiBundleAsset,
  AssetSourceRole,
  BundleDocumentType,
  DocumentLayerType,
  StructuralMissingDataSignal,
} from './bundle.types'
import {
  BUNDLE_DOCUMENT_TYPES,
  DOCUMENT_LAYER_META,
} from './bundle.types'
import {
  getStructuralMissingData,
  isBundleEligibleForComposite,
} from './bundle.service'

// ── Eligibility reason codes ──────────────────────────────────────────────────

export type EligibilityReason =
  | 'eligible'                        // projekt_wykonawczy with assets
  | 'insufficient_technical_layers'   // too few mustUse layers present
  | 'visualization_only'              // visualization_pack — R-C-37 guard
  | 'needs_more_sources'              // <2 assets in the bundle
  | 'unknown_document_type'           // document_type not set
  | 'no_assets'                       // bundle has 0 assets

// ── Readiness summary shape ───────────────────────────────────────────────────

export interface BundleReadinessSummary {
  bundle_id:               string
  document_type:           BundleDocumentType | null
  eligible_for_composite:  boolean
  eligibility_reason:      EligibilityReason
  asset_count:             number
  layer_counts:            Partial<Record<DocumentLayerType, number>>
  source_role_counts:      Partial<Record<AssetSourceRole, number>>
  must_use_present:        DocumentLayerType[]
  must_use_missing:        DocumentLayerType[]
  structural_missing_data: StructuralMissingDataSignal[]
  warnings:                string[]
  ready_for_extraction:    boolean
  ready_for_fusion:        false   // always false at this P1 stage
}

// ── Core processor ────────────────────────────────────────────────────────────

/**
 * Evaluates bundle readiness for composite analysis.
 * Reads bundle + assets, checks eligibility, computes layer/role counts,
 * and returns a stable summary object.
 *
 * Can be called with either RLS-filtered or service-role client.
 */
export async function assessBundleReadiness(
  client: SupabaseClient,
  bundleId: string,
): Promise<BundleReadinessSummary> {
  // 1. Fetch bundle
  const { data: bundle, error: bundleErr } = await client
    .from('ai_analysis_bundles')
    .select('*')
    .eq('id', bundleId)
    .single()

  if (bundleErr || !bundle) {
    throw new Error(`assessBundleReadiness: bundle not found (${bundleErr?.message ?? 'no data'})`)
  }

  const b = bundle as AiAnalysisBundle

  // 2. Fetch assets
  const { data: rawAssets, error: assetsErr } = await client
    .from('ai_bundle_assets')
    .select('*')
    .eq('bundle_id', bundleId)
    .order('source_priority', { ascending: true })

  if (assetsErr) {
    throw new Error(`assessBundleReadiness: assets query failed (${assetsErr.message})`)
  }

  const assets = (rawAssets ?? []) as AiBundleAsset[]

  // 3. Compute counts
  const layerCounts = countBy(assets, (a) => a.layer_type)
  const roleCounts  = countBy(assets, (a) => a.source_role)

  // 4. Determine must-use coverage
  const { present: mustUsePresent, missing: mustUseMissing } =
    computeMustUseCoverage(b.document_type, layerCounts)

  // 5. Structural missing-data
  const structuralMissing = getStructuralMissingData(b.document_type)

  // 6. Eligibility + warnings
  const warnings: string[] = []
  const { eligible, reason } = evaluateEligibility(
    b.document_type,
    assets.length,
    mustUseMissing,
    warnings,
  )

  // 7. Extraction readiness: eligible + has at least 1 pending asset
  const hasPendingAssets = assets.some((a) => a.extraction_status === 'pending')
  const readyForExtraction = eligible && hasPendingAssets

  if (eligible && !hasPendingAssets && assets.length > 0) {
    warnings.push('Wszystkie assety zostały już przetworzone lub pominięte.')
  }

  if (structuralMissing.length > 0) {
    for (const signal of structuralMissing) {
      warnings.push(`Ograniczenie formatu: ${signal.description}`)
    }
  }

  return {
    bundle_id:               bundleId,
    document_type:           b.document_type,
    eligible_for_composite:  eligible,
    eligibility_reason:      reason,
    asset_count:             assets.length,
    layer_counts:            layerCounts,
    source_role_counts:      roleCounts,
    must_use_present:        mustUsePresent,
    must_use_missing:        mustUseMissing,
    structural_missing_data: structuralMissing,
    warnings,
    ready_for_extraction:    readyForExtraction,
    ready_for_fusion:        false,
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function evaluateEligibility(
  documentType: BundleDocumentType | null,
  assetCount: number,
  mustUseMissing: DocumentLayerType[],
  warnings: string[],
): { eligible: boolean; reason: EligibilityReason } {
  // No assets at all
  if (assetCount === 0) {
    return { eligible: false, reason: 'no_assets' }
  }

  // Document type not determined
  if (!documentType || documentType === 'unknown') {
    warnings.push('Typ dokumentu (document_type) nie został jeszcze określony.')
    return { eligible: false, reason: 'unknown_document_type' }
  }

  // R-C-37: visualization_pack guard
  if (!isBundleEligibleForComposite(documentType)) {
    return { eligible: false, reason: 'visualization_only' }
  }

  // Very few sources
  if (assetCount < 2) {
    warnings.push('Bundle zawiera mniej niż 2 assety — za mało źródeł do analizy kompozytowej.')
    return { eligible: false, reason: 'needs_more_sources' }
  }

  // Must-use layer gaps — warn but don't block (MVB threshold is VALIDATE FURTHER)
  if (mustUseMissing.length > 0) {
    const labels = mustUseMissing.map((lt) => {
      const meta = DOCUMENT_LAYER_META[lt as Exclude<DocumentLayerType, 'unknown'>]
      return meta?.label ?? lt
    })
    warnings.push(`Brakujące warstwy MUST USE: ${labels.join(', ')}`)
  }

  return { eligible: true, reason: 'eligible' }
}

function computeMustUseCoverage(
  documentType: BundleDocumentType | null,
  layerCounts: Partial<Record<DocumentLayerType, number>>,
): { present: DocumentLayerType[]; missing: DocumentLayerType[] } {
  if (!documentType || documentType === 'unknown') {
    return { present: [], missing: [] }
  }

  const typeMeta = BUNDLE_DOCUMENT_TYPES[documentType as Exclude<BundleDocumentType, 'unknown'>]
  if (!typeMeta) return { present: [], missing: [] }

  const expected = typeMeta.expectedMustUseLayers
  const present: DocumentLayerType[] = []
  const missing: DocumentLayerType[] = []

  for (const layer of expected) {
    if ((layerCounts[layer] ?? 0) > 0) {
      present.push(layer)
    } else {
      missing.push(layer)
    }
  }

  return { present, missing }
}

function countBy<T, K extends string>(
  items: T[],
  keyFn: (item: T) => K | null | undefined,
): Partial<Record<K, number>> {
  const result: Partial<Record<K, number>> = {}
  for (const item of items) {
    const key = keyFn(item)
    if (key != null) {
      result[key] = (result[key] ?? 0) + 1
    }
  }
  return result
}
