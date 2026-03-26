// =============================================================================
// comparison.validator.ts — Validators for ProjectComparisonResult
// =============================================================================
// Checks data availability and result quality for comparison engine output.
//
// Warnings (require review):
//   NO_COMPARABLE_DATA   — both diffs and scope_additions are empty
//   HIGH_UNCERTAIN_RATIO — >50% of diffs are 'uncertain'
//
// Info:
//   ALL_UNCERTAIN        — every diff is uncertain (no confirmed matches)
// =============================================================================

import type { ProjectComparisonResult } from '../engines/project.types'
import type { ReliabilityIssue }        from '../engines/reliability'

/**
 * Run all deterministic validators on a ProjectComparisonResult.
 * Returns array of issues, empty when everything checks out.
 */
export function validateComparisonResult(result: ProjectComparisonResult): ReliabilityIssue[] {
  const issues: ReliabilityIssue[] = []

  const total     = result.diffs.length
  const uncertain = result.diffs.filter(d => d.category === 'uncertain').length

  if (total === 0 && result.scope_additions.length === 0) {
    issues.push({
      code: 'NO_COMPARABLE_DATA',
      severity: 'warning',
      message: 'Porównanie nie znalazło żadnych danych do zestawienia — sprawdź, czy projekt i zdjęcia dotyczą tego samego miejsca.',
      field: 'diffs',
    })
    return issues
  }

  if (total > 0) {
    const uncertainRatio = uncertain / total
    if (uncertainRatio > 0.5) {
      issues.push({
        code: 'HIGH_UNCERTAIN_RATIO',
        severity: 'warning',
        message: `${uncertain} z ${total} pozycji (${Math.round(uncertainRatio * 100)}%) to niepotwierdzenia — za mało danych do wiarygodnego porównania.`,
        field: 'diffs',
      })
    } else if (uncertain === total) {
      issues.push({
        code: 'ALL_UNCERTAIN',
        severity: 'info',
        message: 'Wszystkie pozycje są niepotwierdzone — AI nie mogło nic jednoznacznie potwierdzić.',
        field: 'diffs',
      })
    }
  }

  return issues
}
