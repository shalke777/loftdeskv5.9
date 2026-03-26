// =============================================================================
// project.validator.ts — Deterministic validators for ProjectAnalysisResult
// =============================================================================
// Structural completeness checks for project document analysis output.
//
// Warnings (require review):
//   ZERO_SCOPE_ITEMS    — no work scope items extracted from project
//   ZERO_ESTIMATE_ITEMS — no estimate line items generated
//   ZERO_ROOMS          — no rooms detected in project
//   ALL_LOW_CONFIDENCE  — all scope items have confidence < 40
//
// Info (transparency):
//   HIGH_ASSUMPTION_COUNT — more than 5 AI assumptions made
//   COMPARISON_NOT_READY  — project not suitable for room comparison
// =============================================================================

import type { ProjectAnalysisResult } from '../engines/project.types'
import type { ReliabilityIssue }      from '../engines/reliability'

/**
 * Run all deterministic validators on a ProjectAnalysisResult.
 * Returns array of issues, empty when everything checks out.
 */
export function validateProjectResult(result: ProjectAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  issues.push(...validateScopeCompleteness(result))
  issues.push(...validateConfidenceDistribution(result))
  issues.push(...validateTransparency(result))

  return issues
}

// ── Scope completeness ────────────────────────────────────────────────────────

function validateScopeCompleteness(result: ProjectAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  if (result.work_scope_from_project.length === 0) {
    issues.push({
      code: 'ZERO_SCOPE_ITEMS',
      severity: 'warning',
      message: 'Analiza projektu nie wyłoniła żadnych pozycji zakresu prac — sprawdź typ i jakość dokumentu.',
      field: 'work_scope_from_project',
    })
  }

  if (result.suggested_estimate_items.length === 0) {
    issues.push({
      code: 'ZERO_ESTIMATE_ITEMS',
      severity: 'warning',
      message: 'Brak propozycji pozycji kosztorysu — AI nie wygenerowało żadnych elementów do wyceny.',
      field: 'suggested_estimate_items',
    })
  }

  if (result.rooms_detected.length === 0) {
    issues.push({
      code: 'ZERO_ROOMS',
      severity: 'warning',
      message: 'AI nie wykryło żadnych pomieszczeń w projekcie — mogą być potrzebne lepsze dokumenty lub opis miejsca.',
      field: 'rooms_detected',
    })
  }

  return issues
}

// ── Confidence distribution ───────────────────────────────────────────────────

function validateConfidenceDistribution(result: ProjectAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  const scopeItems = result.work_scope_from_project
  if (scopeItems.length > 0) {
    const lowConf = scopeItems.filter(i => i.confidence < 40)
    if (lowConf.length === scopeItems.length) {
      issues.push({
        code: 'ALL_LOW_CONFIDENCE',
        severity: 'warning',
        message: `Wszystkie pozycje zakresu prac mają niską pewność (<40%) — wyniki wymagają pełnej weryfikacji.`,
        field: 'work_scope_from_project',
      })
    }
  }

  return issues
}

// ── Transparency validators ───────────────────────────────────────────────────

function validateTransparency(result: ProjectAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  if (result.assumptions.length > 5) {
    issues.push({
      code: 'HIGH_ASSUMPTION_COUNT',
      severity: 'info',
      message: `AI przyjęło ${result.assumptions.length} założeń — wynik opiera się częściowo na domysłach.`,
      field: 'assumptions',
    })
  }

  if (!result.comparison_ready) {
    issues.push({
      code: 'COMPARISON_NOT_READY',
      severity: 'info',
      message: 'Projekt nie jest gotowy do porównania z zdjęciami — brakuje danych geometrycznych lub zakresu.',
      field: 'comparison_ready',
    })
  }

  return issues
}
