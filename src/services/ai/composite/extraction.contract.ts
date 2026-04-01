// =============================================================================
// src/services/ai/composite/extraction.contract.ts
// =============================================================================
// Extraction Contract — the shared output shape every extractor MUST return.
//
// This is the EVIDENCE layer, not the final scope. Extractors return facts,
// hypotheses, dimensions, fixtures, materials, and missing-data flags.
// The fusion engine (future P1 phase) merges evidence into scope items.
//
// Design principles from calibration batch 1 (R-08 to R-30):
//   - Never return empty output (R-08, R-19)
//   - Explicit missing_data flags — no silent gaps (R-10)
//   - Separate electrical layer (R-18)
//   - Tile spec from zestawienie = gold truth, confidence 0.95 (R-26)
//   - Two tile zones = two evidence items (R-21)
//   - Read legend first — source_role determines parsing strategy (R-14)
//   - confidence_reason must explain the score (R-12 hierarchy)
// =============================================================================

// ── Evidence payload types (content JSONB schema by evidence_type) ────────────

/** evidence_type: 'dimension' */
export interface DimensionEvidence {
  subject:       'floor_area' | 'wall_area' | 'height_floor_to_ceiling' | 'height_sp' | 'room_width' | 'room_depth' | 'other'
  value:         number
  unit:          'm2' | 'm' | 'cm'
  room_label?:   string
  note?:         string
}

/** evidence_type: 'fixture' */
export interface FixtureEvidence {
  name:         string              // 'wanna zabudowana', 'parawan nawanny', 'WC wiszące'
  category:     'sanitary' | 'heating' | 'storage' | 'door' | 'window' | 'other'
  brand?:       string | null
  model?:       string | null
  dims?:        string | null       // '70×160', '120×150'
  confirmed:    boolean             // false = hypothesis (R-10)
  quantity:     number
  note?:        string
}

/** evidence_type: 'material' */
export interface MaterialEvidence {
  name:         string              // 'Tubądzin Aulla Grey', 'gres 60×60'
  category:     'floor_tiles' | 'wall_tiles' | 'paint' | 'wood' | 'glass' | 'adhesive' | 'grout' | 'other'
  format?:      string | null       // '75.8×75.8', '24×12 romb'
  area_netto?:  number | null       // m² netto from zestawienie (R-26 gold truth)
  waste_multi?: number              // 1.10 standard, 1.20 romb/cegiełka (R-21)
  zone?:        string | null       // 'ściany główne', 'wnęka prysznicowa', 'podłoga'
  note?:        string
}

/** evidence_type: 'tile_spec' — R-26 gold truth source */
export interface TileSpecEvidence {
  product:       string             // 'Tubądzin Aulla Grey'
  format:        string             // '75.8×75.8 cm'
  area_netto:    number             // m² as stated in zestawienie
  waste_multi:   number             // 1.10 rect, 1.20 romb/cegiełka
  zone:          string             // 'ściany główne', 'obudowa wanny + wnęka'
  source_page?:  string             // 'ZESTAWIENIE OKŁADZIN ŚCIENNYCH, str. 3'
}

/** evidence_type: 'installation' */
export interface InstallationEvidence {
  type:          'hydraulics' | 'electrical' | 'hvac' | 'underfloor' | 'other'
  description:   string            // 'grzejnik drabinkowy Poppy 500×1310'
  layer:         'in_scope' | 'separate_layer' | 'unknown'
  question_id?:  string            // e.g. 'Q-GRZEJNIK-TYP' (R-24)
  note?:         string
}

/** evidence_type: 'scope_hint' */
export interface ScopeHintEvidence {
  description:   string            // 'Obudowa wanny front i bok ~2m²'
  category:      string            // 'tiling' | 'plumbing' | 'demolition' | 'carpentry' | 'electrical'
  quantity?:     number | null
  unit?:         string | null
  rule?:         string            // calibration rule that triggered this (e.g. 'R-22')
  priority:      'required' | 'likely' | 'optional'
}

/** evidence_type: 'missing_data' */
export interface MissingDataEvidence {
  subject:       string            // 'rzut_wod-kan', 'wymiar_powierzchni', 'typ_grzejnika'
  impact:        string            // human-readable: 'Brak możliwości weryfikacji hydrauliki'
  required_question?: string       // question ID from questions model (e.g. 'Q-WODKAN-ZMIANA')
  severity:      'critical' | 'important' | 'optional'
}

/** evidence_type: 'conflict' */
export interface ConflictEvidence {
  subject:         string          // 'sp_height', 'wanna_type', 'tile_area'
  value_this:      unknown         // value from this asset
  value_other:     unknown         // value from conflicting asset
  with_asset_id:   string          // ai_bundle_assets.id of conflicting asset
  resolution_hint: string          // 'Use lower value', 'Ask operator', 'Prefer zestawienie'
}

/** evidence_type: 'hypothesis' */
export interface HypothesisEvidence {
  description:   string            // 'Prawdopodobnie sufit podwieszany GK'
  basis:         string            // 'Widok A sugeruje sp z wnęką LED, brak potwierdzenia w przekroju'
  rule?:         string            // e.g. 'R-15'
  confirm_with?: string            // 'Q-SUFIT'
}

// ── Content union type ────────────────────────────────────────────────────────

export type EvidenceContent =
  | DimensionEvidence
  | FixtureEvidence
  | MaterialEvidence
  | TileSpecEvidence
  | InstallationEvidence
  | ScopeHintEvidence
  | MissingDataEvidence
  | ConflictEvidence
  | HypothesisEvidence

// ── Evidence item (maps to ai_extraction_results row) ────────────────────────

export type EvidenceType =
  | 'dimension'
  | 'fixture'
  | 'material'
  | 'installation'
  | 'tile_spec'
  | 'scope_hint'
  | 'missing_data'
  | 'conflict'
  | 'hypothesis'

export type ExtractorType =
  | 'document_ai'
  | 'room_vision'
  | 'project_vision'
  | 'text_nlp'
  | 'manual'

export interface ExtractedEvidenceItem {
  evidence_type:      EvidenceType
  content:            EvidenceContent
  room_label?:        string | null
  confidence_score:   number          // 0.00–1.00
  confidence_reason:  string          // required — must explain score
  source_anchor?:     string | null   // 'WIDOK A, str. 3', 'ZESTAWIENIE OKŁADZIN'
  conflict_ids?:      string[]        // IDs of conflicting evidence items
}

// ── Extractor output contract ─────────────────────────────────────────────────
//
// Every extractor (document_ai, room_vision, project_vision, text_nlp)
// MUST return ExtractionContractOutput. No exceptions.
//
// Rules:
//   - evidence[] MUST NOT be empty (R-08, R-19)
//   - If nothing detected: emit at least one MissingDataEvidence item
//   - confidence_summary = mean of all item confidence scores
//   - missing_data = true if ANY MissingDataEvidence exists
//   - questions[] are propagated to ai_questions_risks (downstream, future)

export interface ExtractionContractOutput {
  extractor_type:     ExtractorType
  asset_id:           string            // ai_bundle_assets.id
  bundle_id:          string            // ai_analysis_bundles.id
  company_id:         string
  project_id:         string

  // Evidence items — minimum 1 (even if it's a missing_data item)
  evidence:           ExtractedEvidenceItem[]

  // Roll-up metrics
  confidence_summary: number            // 0.00–1.00
  missing_data:       boolean

  // Questions the extraction identified (human-readable + machine ID)
  questions: Array<{
    id:        string                   // 'Q-GRZEJNIK-TYP', 'Q-AREA', etc.
    text:      string                   // Polish, operator-facing
    priority:  'critical' | 'important' | 'optional'
    rule?:     string                   // calibration rule reference
  }>

  // Risks identified during extraction
  risks: Array<{
    description:  string
    severity:     'high' | 'medium' | 'low'
    rule?:        string
  }>

  // Metadata
  model_name?:        string
  extraction_ms?:     number            // processing time for observability
}

// ── Validation helper ─────────────────────────────────────────────────────────

/** Minimal contract validation — called before persisting to DB */
export function validateExtractionOutput(
  output: ExtractionContractOutput,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!output.asset_id)  errors.push('asset_id is required')
  if (!output.bundle_id) errors.push('bundle_id is required')
  if (!output.company_id) errors.push('company_id is required')
  if (!output.project_id) errors.push('project_id is required')

  if (!output.evidence || output.evidence.length === 0) {
    errors.push('evidence[] must not be empty — emit MissingDataEvidence if nothing detected (R-08, R-19)')
  }

  for (const item of output.evidence ?? []) {
    if (!item.confidence_reason || item.confidence_reason.trim() === '') {
      errors.push(`evidence item [${item.evidence_type}] missing confidence_reason`)
    }
    if (item.confidence_score < 0 || item.confidence_score > 1) {
      errors.push(`evidence item [${item.evidence_type}] confidence_score out of range: ${item.confidence_score}`)
    }
  }

  return { valid: errors.length === 0, errors }
}
