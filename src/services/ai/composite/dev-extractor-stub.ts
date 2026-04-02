// =============================================================================
// src/services/ai/composite/dev-extractor-stub.ts
// =============================================================================
// DEV-ONLY: stub extractor that produces synthetic evidence for a bundle asset.
// Used to test the full pipeline (register → extract → persist → readiness)
// without calling real AI inference.
//
// Produces:
//   - 1 DimensionEvidence (floor_area 24.5 m²)
//   - 1 MissingDataEvidence (signals a missing hydraulics layer)
//
// Callable from browser console or test scripts:
//   import { runStubExtraction } from '@/services/ai/composite/dev-extractor-stub'
//   await runStubExtraction(supabaseClient, assetId)
//
// Does NOT touch P0. Output goes through the real persistExtractionOutput path.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiBundleAsset } from './bundle.types'
import type { ExtractionContractOutput } from './extraction.contract'
import { persistExtractionOutput } from './bundle.service'

/**
 * Runs a stub extraction on a single asset and persists
 * the result through the real extraction pipeline.
 *
 * Returns the ExtractionContractOutput that was written.
 */
export async function runStubExtraction(
  client: SupabaseClient,
  assetId: string,
): Promise<ExtractionContractOutput> {
  // 1. Load asset to get IDs
  const { data: asset, error } = await client
    .from('ai_bundle_assets')
    .select('*')
    .eq('id', assetId)
    .single()

  if (error || !asset) {
    throw new Error(`runStubExtraction: asset not found (${error?.message ?? 'no data'})`)
  }

  const a = asset as AiBundleAsset

  // 2. Build synthetic output
  const output: ExtractionContractOutput = {
    extractor_type:     'document_ai',
    asset_id:           a.id,
    bundle_id:          a.bundle_id,
    company_id:         a.company_id,
    project_id:         a.project_id,

    evidence: [
      {
        evidence_type:     'dimension',
        content:           {
          subject:     'floor_area',
          value:       24.5,
          unit:        'm2' as const,
          room_label:  a.room_hint ?? 'łazienka',
          note:        'DEV STUB — not real extraction output',
        },
        room_label:        a.room_hint ?? 'łazienka',
        confidence_score:  0.75,
        confidence_reason: 'Stub extractor — synthetic score for pipeline testing',
        source_anchor:     `dev-stub:${a.original_filename}`,
      },
      {
        evidence_type:     'missing_data',
        content:           {
          subject:            'rzut_wod-kan',
          impact:             'Stub — brak rzutu hydrauliki w zestawie testowym',
          severity:           'important' as const,
        },
        confidence_score:  1.0,
        confidence_reason: 'Missing data signal — always confidence 1.0',
      },
    ],

    confidence_summary: 0.875,       // mean(0.75, 1.0)
    missing_data:       true,

    questions: [
      {
        id:       'Q-DEV-STUB',
        text:     'Czy rzut wod-kan jest dostępny? (pytanie testowe z dev stub)',
        priority: 'important',
        rule:     'dev-stub',
      },
    ],

    risks: [
      {
        description: 'Stub extraction — nie jest to prawdziwe wyjście AI',
        severity:    'low',
        rule:        'dev-stub',
      },
    ],

    model_name:     'dev-stub-v1',
    extraction_ms:  0,
  }

  // 3. Persist through the real pipeline (validates + writes + updates asset status)
  await persistExtractionOutput(client, output)

  return output
}
