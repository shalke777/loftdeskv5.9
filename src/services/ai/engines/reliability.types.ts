// =============================================================================
// reliability.types.ts — Shared type definitions for the AI Reliability Framework
// =============================================================================
// Extracted from reliability.ts to break the circular dependency:
//   reliability.ts  → imports validators (validateDocumentResult, etc.)
//   validators/*.ts → imported ReliabilityIssue from reliability.ts  ← cycle!
//
// Resolution:
//   reliability.types.ts  — pure types, no imports from this codebase
//   validators/*.ts       — import ReliabilityIssue from reliability.types (no cycle)
//   reliability.ts        — imports from reliability.types + re-exports for consumers
// =============================================================================

/** Quality tier for an AI engine result. */
export type ReliabilityState = 'strong' | 'partial' | 'weak' | 'blocked'

/**
 * A single quality-control finding.
 * critical → blocks handoff
 * warning  → requires human review / confirmation
 * info     → surfaced for transparency, no action required
 */
export interface ReliabilityIssue {
  /** Machine-readable code, UPPER_SNAKE_CASE */
  code: string
  severity: 'critical' | 'warning' | 'info'
  /** Polish human-readable explanation */
  message: string
  /** Optional: which field or section triggered this */
  field?: string
}

/**
 * A single piece of evidence supporting a field or finding.
 * Provides traceability from output back to data source.
 */
export interface ReliabilityEvidence {
  field: string
  /** Where this value came from */
  source: 'ocr' | 'ai_inferred' | 'computed' | 'user_input' | 'deterministic_check'
  /** Confidence 0–100 for this specific field */
  confidence: number
  note?: string
}

/**
 * Full quality report returned for every AI engine result.
 */
export interface ReliabilityReport {
  state: ReliabilityState
  /** Overall confidence 0–100 (from the engine result, not recomputed) */
  confidence: number
  /** All detected issues, sorted critical-first */
  issues: ReliabilityIssue[]
  /** Traceability: which fields are supported by what evidence */
  evidence: ReliabilityEvidence[]
  /** true when human review is recommended (partial or worse) */
  requires_review: boolean
  /**
   * true when a confirmation dialog must be shown before any downstream
   * action (estimate handoff, save, etc.) — set for weak & blocked states
   */
  requires_confirmation: boolean
  /** Polish one-liner suitable for display next to confidence badge */
  summary: string
}
