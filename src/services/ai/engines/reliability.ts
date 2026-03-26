// =============================================================================
// reliability.ts — AI Reliability Framework v1
// =============================================================================
// Provides a unified quality-control layer for all AI engine outputs.
//
// Philosophy:
//   "100% quality control, not 100% AI certainty"
//   The system never passes uncertain data as certain.
//
// ReliabilityState tiers:
//   strong  — high confidence, no critical issues, ready to use
//   partial — moderate confidence or minor issues, review recommended
//   weak    — low confidence or multiple warnings, manual review required
//   blocked — critical validation failure, cannot proceed without correction
//
// Validators are called per-engine and return ReliabilityIssue[]:
//   validateDocumentResult(result)  → document arithmetic, dates, parties
//   validateRoomResult(result)      → scope consistency, prerequisites
//   validateProjectResult(result)   → scope completeness
//   validateComparisonResult(result)→ data availability checks
//
// Each engine exposes computeXxxReliability() which runs validators,
// derives ReliabilityState, and builds the full ReliabilityReport.
// =============================================================================

import type { DocumentAnalysisResult } from './document.types'
import type { RoomAnalysisResult }      from './room.types'
import type { ProjectAnalysisResult, ProjectComparisonResult } from './project.types'
import type { AnalysisResult } from '../analysis.types'

import { validateDocumentResult }    from '../validators/document.validator'
import { validateRoomResult }        from '../validators/room.validator'
import { validateProjectResult }     from '../validators/project.validator'
import { validateComparisonResult }  from '../validators/comparison.validator'

// ── Core types ─────────────────────────────────────────────────────────────

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

// ── State derivation ────────────────────────────────────────────────────────

/**
 * Derive ReliabilityState from confidence and issues list.
 *
 * Priority order (highest wins):
 *   1. blocked — any critical issue present
 *   2. weak    — confidence < 40, OR ≥ 3 warnings
 *   3. partial — confidence < 70, OR ≥ 1 warning
 *   4. strong  — confidence ≥ 70, no critical, ≤ 0 warnings
 */
export function deriveReliabilityState(
  confidence: number,
  issues: ReliabilityIssue[],
): ReliabilityState {
  const hasCritical   = issues.some(i => i.severity === 'critical')
  const warningCount  = issues.filter(i => i.severity === 'warning').length

  if (hasCritical)                              return 'blocked'
  if (confidence < 40 || warningCount >= 3)     return 'weak'
  if (confidence < 70 || warningCount >= 1)     return 'partial'
  return 'strong'
}

// ── Summary sentences ────────────────────────────────────────────────────────

function buildSummary(
  state: ReliabilityState,
  confidence: number,
  issues: ReliabilityIssue[],
): string {
  const criticals = issues.filter(i => i.severity === 'critical')
  if (state === 'blocked') {
    return criticals.length > 0
      ? `Wykryto ${criticals.length} krytyczn${criticals.length === 1 ? 'y błąd' : 'e błędy'} — wymagana korekta przed użyciem.`
      : 'Wynik zablokowany — dane nie spełniają wymagań walidacji.'
  }
  if (state === 'weak') {
    return `Niska pewność ekstrakcji (${confidence}%) — wymagane ręczne sprawdzenie całości.`
  }
  if (state === 'partial') {
    const warnings = issues.filter(i => i.severity === 'warning')
    return warnings.length > 0
      ? `Umiarkowana pewność (${confidence}%) — ${warnings.length} ${warnings.length === 1 ? 'kwestia' : 'kwestie'} do weryfikacji.`
      : `Umiarkowana pewność (${confidence}%) — zalecane przejrzenie wyników przed użyciem.`
  }
  return `Wysoka pewność ekstrakcji (${confidence}%) — wyniki gotowe do użycia.`
}

// ── Per-engine compute functions ─────────────────────────────────────────────

/**
 * Compute reliability for a DocumentAnalysisResult.
 * Runs: arithmetic validator, date sanity, party presence checks.
 */
export function computeDocumentReliability(
  result: DocumentAnalysisResult,
): ReliabilityReport {
  const issues = validateDocumentResult(result)
  const state  = deriveReliabilityState(result.confidence, issues)

  const evidence: ReliabilityEvidence[] = []

  // Amounts
  if (result.amounts.gross !== null) {
    evidence.push({
      field: 'amounts.gross',
      source: 'ocr',
      confidence: result.confidence,
      note: `${result.amounts.gross} ${result.amounts.currency}`,
    })
  }
  if (result.amounts.net !== null && result.amounts.vat !== null) {
    const sum = Math.round((result.amounts.net + result.amounts.vat) * 100) / 100
    evidence.push({
      field: 'amounts.net+vat',
      source: 'deterministic_check',
      confidence: Math.abs(sum - (result.amounts.gross ?? 0)) < 0.03 ? 100 : 0,
      note: `netto+VAT=${sum}, brutto=${result.amounts.gross}`,
    })
  }

  // Parties
  for (const p of result.parties) {
    if (p.name) {
      evidence.push({
        field: `party.${p.role}.name`,
        source: 'ocr',
        confidence: result.confidence,
        note: p.name,
      })
    }
  }

  // Line items
  if (result.line_items.length > 0) {
    evidence.push({
      field: 'line_items',
      source: 'ocr',
      confidence: result.confidence,
      note: `${result.line_items.length} pozycji`,
    })
  }

  const sorted = [...issues].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 }
    return rank[a.severity] - rank[b.severity]
  })

  return {
    state,
    confidence: result.confidence,
    issues: sorted,
    evidence,
    requires_review:       state !== 'strong',
    requires_confirmation: state === 'weak' || state === 'blocked',
    summary: buildSummary(state, result.confidence, issues),
  }
}

/**
 * Compute reliability for a RoomAnalysisResult.
 * Runs: scope consistency checks, prerequisite checks.
 */
export function computeRoomReliability(
  result: RoomAnalysisResult,
): ReliabilityReport {
  const issues = validateRoomResult(result)
  const state  = deriveReliabilityState(result.confidence, issues)

  const evidence: ReliabilityEvidence[] = []

  // Observed elements
  for (const el of result.observed_elements.slice(0, 10)) {
    evidence.push({
      field: `observed.${el.type}`,
      source: 'ai_inferred',
      confidence: el.confidence,
      note: el.label,
    })
  }

  // Required scope items
  for (const item of result.required_work_scope.slice(0, 5)) {
    evidence.push({
      field: `scope.required`,
      source: 'ai_inferred',
      confidence: item.confidence,
      note: item.description,
    })
  }

  const sorted = [...issues].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 }
    return rank[a.severity] - rank[b.severity]
  })

  return {
    state,
    confidence: result.confidence,
    issues: sorted,
    evidence,
    requires_review:       state !== 'strong',
    requires_confirmation: state === 'weak' || state === 'blocked',
    summary: buildSummary(state, result.confidence, issues),
  }
}

/**
 * Compute reliability for a ProjectAnalysisResult.
 * Runs: scope completeness checks.
 */
export function computeProjectReliability(
  result: ProjectAnalysisResult,
): ReliabilityReport {
  const issues = validateProjectResult(result)
  const state  = deriveReliabilityState(result.confidence, issues)

  const evidence: ReliabilityEvidence[] = []

  // High-confidence scope items as direct evidence
  const highConf = result.work_scope_from_project.filter(i => i.confidence >= 60)
  for (const item of highConf.slice(0, 5)) {
    evidence.push({
      field: 'scope.item',
      source: 'ai_inferred',
      confidence: item.confidence,
      note: item.description,
    })
  }

  if (result.assumptions.length > 0) {
    evidence.push({
      field: 'assumptions',
      source: 'ai_inferred',
      confidence: 50,
      note: `${result.assumptions.length} założen AI`,
    })
  }

  const sorted = [...issues].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 }
    return rank[a.severity] - rank[b.severity]
  })

  return {
    state,
    confidence: result.confidence,
    issues: sorted,
    evidence,
    requires_review:       state !== 'strong',
    requires_confirmation: state === 'weak' || state === 'blocked',
    summary: buildSummary(state, result.confidence, issues),
  }
}

/**
 * Compute reliability for a ProjectComparisonResult.
 * Runs: data availability and agreement ratio checks.
 */
export function computeComparisonReliability(
  result: ProjectComparisonResult,
): ReliabilityReport {
  const issues = validateComparisonResult(result)
  const state  = deriveReliabilityState(result.confidence, issues)

  const total     = result.diffs.length
  const matching  = result.diffs.filter(d => d.category === 'matching').length
  const uncertain = result.diffs.filter(d => d.category === 'uncertain').length

  const evidence: ReliabilityEvidence[] = []

  if (total > 0) {
    evidence.push({
      field: 'comparison.agreement_ratio',
      source: 'deterministic_check',
      confidence: Math.round((matching / total) * 100),
      note: `${matching}/${total} zgodnych`,
    })
  }

  if (uncertain > 0) {
    evidence.push({
      field: 'comparison.uncertain_count',
      source: 'deterministic_check',
      confidence: 0,
      note: `${uncertain} niepotwierdzonych`,
    })
  }

  if (result.scope_additions.length > 0) {
    evidence.push({
      field: 'comparison.scope_additions',
      source: 'ai_inferred',
      confidence: result.confidence,
      note: `${result.scope_additions.length} nowych prac ze zdjęć`,
    })
  }

  const sorted = [...issues].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 }
    return rank[a.severity] - rank[b.severity]
  })

  return {
    state,
    confidence: result.confidence,
    issues: sorted,
    evidence,
    requires_review:       state !== 'strong',
    requires_confirmation: state === 'weak' || state === 'blocked',
    summary: buildSummary(state, result.confidence, issues),
  }
}

// ── Bridge functions ──────────────────────────────────────────────────────────

/**
 * Bridge: compute reliability from AnalysisResult (room engine envelope).
 * RoomAnalysisPage uses AnalysisResult from analysis.types, not the internal
 * RoomAnalysisResult from engines/room.types.
 */
export function computeRoomReliabilityFromAnalysis(
  result: AnalysisResult,
): ReliabilityReport {
  const issues: ReliabilityIssue[] = []
  const confidence = result.extraction_confidence ?? 0

  const hasScope     = (result.work_scope?.length ?? 0) > 0
  const hasMaterials = (result.detected_materials?.length ?? 0) > 0
  if (!hasScope && !hasMaterials) {
    issues.push({
      code:     'ZERO_SCOPE',
      severity: 'warning',
      message:  'AI nie wykrył zakresu prac ani materiałów — wyniki mogą być niekompletne.',
    })
  }

  for (const w of result.extraction_warnings ?? []) {
    issues.push({ code: 'EXTRACTION_WARNING', severity: 'warning', message: w })
  }

  const state  = deriveReliabilityState(confidence, issues)
  const sorted = [...issues].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 }
    return rank[a.severity] - rank[b.severity]
  })

  const evidence: ReliabilityEvidence[] = []
  if (hasMaterials) {
    evidence.push({ field: 'detected_materials', source: 'ai_inferred', confidence, note: `${result.detected_materials!.length} materiałów` })
  }
  if (hasScope) {
    evidence.push({ field: 'work_scope', source: 'ai_inferred', confidence, note: `${result.work_scope!.length} prac` })
  }

  return {
    state,
    confidence,
    issues: sorted,
    evidence,
    requires_review:       state !== 'strong',
    requires_confirmation: state === 'weak' || state === 'blocked',
    summary: buildSummary(state, confidence, issues),
  }
}

/**
 * Bridge: compute reliability from flat ParseInvoiceResult amounts.
 * ExpensesPage uses ParseInvoiceResult from expenses.api, not DocumentAnalysisResult.
 * Call this right after OCR extraction to get a reliability report for the modal banner.
 */
export function computeDocumentReliabilityFromParseResult(
  net:        number | null,
  vat:        number | null,
  gross:      number | null,
  confidence: number,
  warnings?:  string[],
): ReliabilityReport {
  const issues: ReliabilityIssue[] = []

  if (net !== null && vat !== null && gross !== null) {
    const computed = Math.round((net + vat) * 100) / 100
    if (Math.abs(computed - gross) > 0.02) {
      issues.push({
        code:     'ARITHMETIC_MISMATCH',
        severity: 'critical',
        message:  `Niezgodność kwot: netto (${net}) + VAT (${vat}) = ${computed}, brutto = ${gross}. Sprawdź liczby przed zapisem.`,
        field:    'amounts',
      })
    }
  }

  for (const w of warnings ?? []) {
    issues.push({ code: 'EXTRACTION_WARNING', severity: 'warning', message: w })
  }

  const state  = deriveReliabilityState(confidence, issues)
  const sorted = [...issues].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 }
    return rank[a.severity] - rank[b.severity]
  })

  const evidence: ReliabilityEvidence[] = []
  if (gross !== null) {
    evidence.push({ field: 'amounts.gross', source: 'ocr', confidence, note: `${gross} PLN` })
  }
  if (net !== null && vat !== null) {
    const sum = Math.round((net + vat) * 100) / 100
    evidence.push({
      field:      'amounts.net+vat',
      source:     'deterministic_check',
      confidence: (gross !== null && Math.abs(sum - gross) < 0.03) ? 100 : 0,
      note:       `netto+VAT=${sum}, brutto=${gross}`,
    })
  }

  return {
    state,
    confidence,
    issues: sorted,
    evidence,
    requires_review:       state !== 'strong',
    requires_confirmation: state === 'weak' || state === 'blocked',
    summary: buildSummary(state, confidence, issues),
  }
}
