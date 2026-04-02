// =============================================================================
// src/services/ai/composite/fusion.types.ts
// =============================================================================
// Fused output contract for Fusion Skeleton v1.
//
// Input:  ai_extraction_results (all rows for a bundle) + asset source_priority map
// Output: FusedBundleOutput — scope candidates, questions, risks, provenance
//
// Fusible types:   fixture | tile_spec | material | installation
// Pass-through:    dimension | scope_hint | missing_data | hypothesis
//
// Fusion is additive and read-only in v1 — no DB writes, no fused=true updates.
// =============================================================================

// ── Conflict shape ─────────────────────────────────────────────────────────────

export interface FusedConflict {
  /** Which payload field has conflicting values */
  field: string
  /** All reported values with their origin */
  values: Array<{
    value:         unknown
    source_anchor: string | null
    asset_id:      string
    confidence:    number
  }>
  /**
   * How the conflict was resolved:
   * - 'highest_priority': lower source_priority asset wins (more authoritative)
   * - 'unresolved': same source_priority on all — human review required
   */
  resolution:      'highest_priority' | 'unresolved'
  resolved_value:  unknown | null
}

// ── Fused scope candidate ──────────────────────────────────────────────────────

export interface FusedScopeCandidate {
  /** Deterministic ID derived from group key (stable across re-runs) */
  id:             string
  evidence_type:  'fixture' | 'tile_spec' | 'material' | 'installation'
  room_label:     string | null
  category:       string | null   // fix_category / mat_category / inst_type
  subject:        string          // primary display label (name / product / type+layer)
  zone:           string | null   // tile_spec.zone / material.zone
  confidence:     number          // max confidence among merged items

  /** Provenance */
  merged_from_count: number
  evidence_ids:      string[]     // ai_extraction_results.id[]
  source_anchors:    string[]     // deduplicated

  /** Conflicts detected in this group */
  conflicts: FusedConflict[]

  /**
   * R-F-hard-2: True when another candidate in the same bundle shares
   * room_label + evidence_type + category but has a different subject (name/product),
   * AND the canonical fixture types are the same (or unresolvable).
   * Indicates two items that may be the same real-world object described differently
   * — requires human review to decide if they should be merged or kept separate.
   *
   * NOT set when canonical types differ (e.g. toilet + shower in same bathroom)
   * — those are coexistence_ok and are NOT flagged.
   */
  category_peer_conflict: boolean
  /** IDs of peer candidates that triggered the category_peer_conflict flag */
  category_peer_ids: string[]
  /**
   * R-F-peer2: Semantic peer conflict classification.
   * - 'peer_review_needed': same canonical fixture type in same room (may be duplicate)
   * - null: no peer relationship, or coexistence_ok (different canonical types suppressed)
   */
  peer_conflict_type: 'peer_review_needed' | null

  /** Winning merged payload from highest-priority source */
  payload:    Record<string, unknown>

  /**
   * R-F-enrich-dim: Dimension evidence items from the same room, linked to this candidate.
   * Safe match: dimension.room_label === candidate.room_label (non-null).
   * Consumers may use these to contextualise area/count/length without a DB lookup.
   */
  linked_dimensions:  LinkedDimension[]

  /**
   * R-F-enrich-scope: Scope hint items from the same room, linked to this candidate.
   * Safe match: scope_hint.room_label === candidate.room_label (non-null).
   */
  linked_scope_hints: LinkedScopeHint[]
}

// ── Pass-through items (not merged, just collected) ────────────────────────────

export interface PassthroughItem {
  id:            string
  evidence_type: string
  room_label:    string | null
  source_anchor: string | null
  confidence:    number
  payload:       Record<string, unknown>
}

// ── Enrichment links — pass-through evidence attached to a candidate ───────────

/**
 * A dimension evidence item linked to this fused candidate.
 * Linked when dimension.room_label === candidate.room_label (non-null match).
 */
export interface LinkedDimension {
  source_id:     string          // PassthroughItem.id (original evidence row id)
  subject:       string | null   // e.g. "łazienka — pow. podłogi"
  unit:          string | null   // "m2", "cm", "szt", "mb"
  value:         number | null
  source_anchor: string | null
}

/**
 * A scope_hint evidence item linked to this fused candidate.
 * Linked when scope_hint.room_label === candidate.room_label (non-null match).
 */
export interface LinkedScopeHint {
  source_id:     string
  category:      string | null   // scope_hint.category field
  unit:          string | null
  priority:      string | null   // "wysoki", "krytyczny" etc.
  note:          string | null   // scope_hint.note / text if present
  source_anchor: string | null
}

// ── Questions and risks ────────────────────────────────────────────────────────

export interface FusedQuestion {
  id:           string
  text:         string
  priority:     'critical' | 'important' | 'optional'
  rule?:        string | null
  /** Source evidence or question entry that produced this */
  evidence_ids: string[]
}

export interface FusedRisk {
  description:  string
  severity:     'high' | 'medium' | 'low'
  rule?:        string | null
  evidence_ids: string[]
}

// ── Fusion stats ───────────────────────────────────────────────────────────────

export interface FusionStats {
  input_evidence_count:  number
  fusible_count:         number    // fixture + tile_spec + material + installation
  passthrough_count:     number    // dimension + scope_hint + missing_data + hypothesis
  merged_groups:         number    // groups produced
  conflict_count:        number    // total conflicts across all groups
  null_room_count:       number    // items with room_label = null
  rooms_found:           string[]  // distinct room_labels
  types_processed:       string[]  // evidence_types seen in input
}

// ── Top-level output ───────────────────────────────────────────────────────────

export interface FusedBundleOutput {
  bundle_id:              string
  fused_at:               string   // ISO timestamp (local compute, not persisted)
  /** Merged scope candidates — the core product of fusion */
  fused_scope_candidates: FusedScopeCandidate[]
  /** Pass-through items: dimensions, scope_hints, missing_data, hypotheses */
  passthrough_items:      PassthroughItem[]
  /** Aggregated questions from ai_questions_risks */
  fused_questions:        FusedQuestion[]
  /** Aggregated risks from ai_questions_risks */
  fused_risks:            FusedRisk[]
  stats:                  FusionStats
}
