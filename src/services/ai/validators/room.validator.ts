// =============================================================================
// room.validator.ts — Deterministic validators for RoomAnalysisResult
// =============================================================================
// These are structural and prerequisite-logic checks — not AI re-scoring.
// They run client-side after the room/photo analysis engine returns its result.
//
// Warnings (require review):
//   ZERO_REQUIRED_SCOPE     — required_work_scope is empty (no must-do items)
//   WATERPROOFING_EXPECTED  — wet zone detected but no waterproofing scope item
//   MISSING_DEMOLITION      — stage is before_renovation but no demolition scope
//
// Info (transparency):
//   MISSING_SPACE_TYPE      — space_type not identified
//   TILING_WITHOUT_SUBSTRATE— tiling scope present, no substrate/prep work
//   ZERO_OBSERVED_ELEMENTS  — no elements detected in photo
// =============================================================================

import type { RoomAnalysisResult, ScopeItem } from '../engines/room.types'
import type { ReliabilityIssue }              from '../engines/reliability'

/**
 * Run all deterministic validators on a RoomAnalysisResult.
 * Returns array of issues, empty when everything checks out.
 */
export function validateRoomResult(result: RoomAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  issues.push(...validateScope(result))
  issues.push(...validatePrerequisites(result))
  issues.push(...validateStructure(result))

  return issues
}

// ── Scope validators ──────────────────────────────────────────────────────────

function validateScope(result: RoomAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  const allScope = [
    ...result.required_work_scope,
    ...result.likely_work_scope,
    ...result.optional_work_scope,
  ]

  if (result.required_work_scope.length === 0) {
    // If there any scope at all it's just a partial match — info level
    // If there truly nothing it's a warning (might be shell/finished state)
    const hasAnyScope = allScope.length > 0
    issues.push({
      code: 'ZERO_REQUIRED_SCOPE',
      severity: hasAnyScope ? 'info' : 'warning',
      message: hasAnyScope
        ? 'Brak prac obowiązkowych — AI nie wyłoniło prac koniecznych, tylko opcjonalne lub prawdopodobne.'
        : 'Analiza nie wyłoniła żadnych prac — sprawdź jakość zdjęć lub stan pomieszczenia.',
      field: 'required_work_scope',
    })
  }

  return issues
}

// ── Prerequisite validators ───────────────────────────────────────────────────

/** True if any scope item in the list has a category matching the given pattern */
function hasCategory(items: ScopeItem[], pattern: RegExp): boolean {
  return items.some(i => pattern.test(i.category) || pattern.test(i.description.toLowerCase()))
}

function validatePrerequisites(result: RoomAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  const allScope = [
    ...result.required_work_scope,
    ...result.likely_work_scope,
    ...result.optional_work_scope,
  ]

  const hasTiling       = hasCategory(allScope, /tiling|glazur|płytk|gres|okładzin/i)
  const hasSubstrate    = hasCategory(allScope, /substrate|podłoże|wyrównan|wylewk|jastrych/i)
  const hasWaterproofing = hasCategory(allScope, /waterproof|hydroizolac|uszczelni/i)
  const hasDemolition   = hasCategory(allScope, /demolition|rozbiórk|wyburzeni|demontaż|skuwani/i)

  // Check: wet zone detected but no waterproofing
  const wetZoneDetected = result.observed_elements.some(el =>
    /prysznic|kabina|wanna|shower|walk-in|mokra strefa/i.test(el.label),
  ) || /łazienka|bathroom|wet room/i.test(result.space_type ?? '')

  if (wetZoneDetected && !hasWaterproofing && allScope.length > 0) {
    issues.push({
      code: 'WATERPROOFING_EXPECTED',
      severity: 'warning',
      message: 'Wykryto strefę mokrą, ale w zakresie brak hydroizolacji — prawdopodobnie pominięta przez AI.',
      field: 'required_work_scope',
    })
  }

  // Check: stage is before_renovation but no demolition
  if (result.stage_of_work === 'before_renovation' && !hasDemolition && allScope.length > 0) {
    issues.push({
      code: 'MISSING_DEMOLITION',
      severity: 'warning',
      message: 'Pomieszczenie jest przed remontem, ale brak prac rozbiórkowo-demontażowych w zakresie.',
      field: 'required_work_scope',
    })
  }

  // Check: tiling without substrate prep (info-level)
  if (hasTiling && !hasSubstrate && allScope.length > 2) {
    issues.push({
      code: 'TILING_WITHOUT_SUBSTRATE',
      severity: 'info',
      message: 'Zakres zawiera układanie płytek, ale brak przygotowania podłoża — sprawdź, czy jest uwzględnione.',
      field: 'work_scope',
    })
  }

  return issues
}

// ── Structural validators ─────────────────────────────────────────────────────

function validateStructure(result: RoomAnalysisResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  if (!result.space_type) {
    issues.push({
      code: 'MISSING_SPACE_TYPE',
      severity: 'info',
      message: 'AI nie zidentyfikowało typu pomieszczenia — wyniki mogą być mniej dopasowane do biblioteki zadań.',
      field: 'space_type',
    })
  }

  if (result.observed_elements.length === 0) {
    issues.push({
      code: 'ZERO_OBSERVED_ELEMENTS',
      severity: 'warning',
      message: 'Brak wykrytych elementów na zdjęciach — jakość zdjęcia może być niewystarczająca do analizy.',
      field: 'observed_elements',
    })
  }

  return issues
}
