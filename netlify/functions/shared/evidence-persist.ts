// =============================================================================
// netlify/functions/shared/evidence-persist.ts
// =============================================================================
// Persists ExtractionContractOutput (P1 evidence layer) to:
//   - ai_extraction_results  (one row per evidence item)
//   - ai_bundle_assets       (extraction_status update)
//   - ai_analysis_bundles    (counter update via RPC)
//
// Called from composite-extract-asset.ts using the Supabase service-role client.
// Does NOT write to P0 tables (ai_analysis_runs, ai_scope_items, etc.).
//
// Flat evidence items (from OpenAI response) are mapped to typed content JSONB
// before writing: prefix-stripped fields are grouped by evidence_type.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Flat evidence item as returned by OpenAI (prefix fields) ─────────────────
// All fields are nullable except evidence_type, confidence_score, confidence_reason.
// The model fills only the fields relevant to the declared evidence_type.

export interface FlatEvidenceItem {
  evidence_type:      string
  room_label:         string | null
  confidence_score:   number
  confidence_reason:  string
  source_anchor:      string | null

  // dimension (dim_)
  dim_subject:        string | null
  dim_value:          number | null
  dim_unit:           string | null
  dim_note:           string | null

  // fixture (fix_)
  fix_name:           string | null
  fix_category:       string | null
  fix_confirmed:      boolean | null
  fix_quantity:       number | null
  fix_dims:           string | null
  fix_note:           string | null

  // material (mat_)
  mat_name:           string | null
  mat_category:       string | null
  mat_format:         string | null
  mat_area_netto:     number | null
  mat_waste_multi:    number | null
  mat_zone:           string | null
  mat_note:           string | null

  // tile_spec (ts_) — R-26 gold truth
  ts_product:         string | null
  ts_format:          string | null
  ts_area_netto:      number | null
  ts_waste_multi:     number | null
  ts_zone:            string | null
  ts_source_page:     string | null

  // installation (inst_)
  inst_type:          string | null
  inst_description:   string | null
  inst_layer:         string | null
  inst_question_id:   string | null
  inst_note:          string | null

  // scope_hint (sh_)
  sh_description:     string | null
  sh_category:        string | null
  sh_quantity:        number | null
  sh_unit:            string | null
  sh_rule:            string | null
  sh_priority:        string | null

  // missing_data (md_)
  md_subject:         string | null
  md_impact:          string | null
  md_question:        string | null
  md_severity:        string | null

  // hypothesis (hyp_)
  hyp_description:    string | null
  hyp_basis:          string | null
  hyp_rule:           string | null
  hyp_confirm_with:   string | null
}

export interface FlatExtractionOutput {
  evidence:           FlatEvidenceItem[]
  questions: Array<{
    id:       string
    text:     string
    priority: string
    rule:     string | null
  }>
  risks: Array<{
    description: string
    severity:    string
    rule:        string | null
  }>
  confidence_summary: number
  missing_data:       boolean
}

export interface PersistEvidenceInput {
  sb:             SupabaseClient   // service-role client
  asset_id:       string
  bundle_id:      string
  company_id:     string
  project_id:     string
  extractor_type: string
  output:         FlatExtractionOutput
  extraction_ms?: number
}

export interface PersistEvidenceResult {
  ok:             boolean
  evidence_count: number
  error?:         string
}

// ── Content mapper: flat → typed JSONB ───────────────────────────────────────

function flatToContent(item: FlatEvidenceItem): Record<string, unknown> {
  switch (item.evidence_type) {
    case 'dimension':
      return {
        subject:   item.dim_subject ?? 'other',
        value:     item.dim_value   ?? 0,
        unit:      item.dim_unit    ?? 'm2',
        ...(item.room_label ? { room_label: item.room_label } : {}),
        ...(item.dim_note   ? { note:       item.dim_note   } : {}),
      }

    case 'fixture':
      return {
        name:      item.fix_name     ?? '',
        category:  item.fix_category ?? 'other',
        confirmed: item.fix_confirmed ?? false,
        quantity:  item.fix_quantity  ?? 1,
        ...(item.fix_dims ? { dims:  item.fix_dims } : {}),
        ...(item.fix_note ? { note:  item.fix_note } : {}),
      }

    case 'material':
      return {
        name:      item.mat_name     ?? '',
        category:  item.mat_category ?? 'other',
        ...(item.mat_format     ? { format:     item.mat_format     } : {}),
        ...(item.mat_area_netto !== null ? { area_netto:  item.mat_area_netto } : {}),
        ...(item.mat_waste_multi !== null ? { waste_multi: item.mat_waste_multi } : {}),
        ...(item.mat_zone       ? { zone:        item.mat_zone       } : {}),
        ...(item.mat_note       ? { note:        item.mat_note       } : {}),
      }

    case 'tile_spec':
      return {
        product:    item.ts_product    ?? '',
        format:     item.ts_format     ?? '',
        area_netto: item.ts_area_netto ?? 0,
        waste_multi: item.ts_waste_multi ?? 1.10,
        zone:       item.ts_zone       ?? '',
        ...(item.ts_source_page ? { source_page: item.ts_source_page } : {}),
      }

    case 'installation':
      return {
        type:        item.inst_type        ?? 'other',
        description: item.inst_description ?? '',
        layer:       item.inst_layer       ?? 'unknown',
        ...(item.inst_question_id ? { question_id: item.inst_question_id } : {}),
        ...(item.inst_note        ? { note:         item.inst_note        } : {}),
      }

    case 'scope_hint':
      return {
        description: item.sh_description ?? '',
        category:    item.sh_category    ?? 'other',
        priority:    item.sh_priority    ?? 'likely',
        ...(item.sh_quantity !== null ? { quantity: item.sh_quantity } : {}),
        ...(item.sh_unit    ? { unit: item.sh_unit } : {}),
        ...(item.sh_rule    ? { rule: item.sh_rule } : {}),
      }

    case 'missing_data':
      return {
        subject:  item.md_subject  ?? '',
        impact:   item.md_impact   ?? '',
        severity: item.md_severity ?? 'important',
        ...(item.md_question ? { required_question: item.md_question } : {}),
      }

    case 'hypothesis':
      return {
        description: item.hyp_description ?? '',
        basis:       item.hyp_basis       ?? '',
        ...(item.hyp_rule         ? { rule:         item.hyp_rule         } : {}),
        ...(item.hyp_confirm_with ? { confirm_with: item.hyp_confirm_with } : {}),
      }

    default:
      return {}
  }
}

// ── Main persist function ─────────────────────────────────────────────────────

export async function persistEvidenceOutput(
  input: PersistEvidenceInput,
): Promise<PersistEvidenceResult> {
  const { sb, asset_id, bundle_id, company_id, project_id, extractor_type, output } = input

  // Guard: evidence must not be empty (R-08, R-19)
  if (!output.evidence || output.evidence.length === 0) {
    await sb.from('ai_bundle_assets').update({
      extraction_status: 'failed',
      processing_error:  'Empty evidence array — violates R-08/R-19',
    }).eq('id', asset_id)
    return { ok: false, evidence_count: 0, error: 'Empty evidence array' }
  }

  // Build DB rows
  const rows = output.evidence.map((item) => ({
    bundle_id,
    asset_id,
    company_id,
    project_id,
    extractor_type,
    evidence_type:     item.evidence_type,
    content:           flatToContent(item),
    room_label:        item.room_label   ?? null,
    confidence_score:  typeof item.confidence_score === 'number' ? Math.max(0, Math.min(1, item.confidence_score)) : null,
    confidence_reason: item.confidence_reason ?? '',
    source_anchor:     item.source_anchor ?? null,
    conflict_ids:      [],
    fused:             false,
  }))

  const { error: insertErr } = await sb
    .from('ai_extraction_results')
    .insert(rows)

  if (insertErr) {
    await sb.from('ai_bundle_assets').update({
      extraction_status: 'failed',
      processing_error:  insertErr.message,
    }).eq('id', asset_id)
    return { ok: false, evidence_count: 0, error: insertErr.message }
  }

  // Mark asset as extracted
  await sb.from('ai_bundle_assets').update({
    extraction_status: 'extracted',
    processing_error:  null,
  }).eq('id', asset_id)

  // Increment bundle extracted_count (non-fatal if fails)
  try {
    await sb.rpc('increment_bundle_counter', {
      p_bundle_id: bundle_id,
      p_column:    'extracted_count',
      p_delta:     1,
    })
  } catch {
    // non-fatal
  }

  return { ok: true, evidence_count: rows.length }
}
