// =============================================================================
// comparison.ts — Project vs Reality Comparison Engine (MVP v1)
// =============================================================================
// Client-side pure function. No Netlify function needed.
// Accepts:
//   - ProjectAnalysisResult (from analyze-project Netlify function)
//   - AnalysisResult (from analyze-room-photo Netlify function)
// Returns:
//   - ProjectComparisonResult (matching / missing / changed / uncertain / scope_additions)
//
// Design principles:
//   - No false certainty: when data is ambiguous, use 'uncertain' not 'matching'
//   - Category-level matching: broad taxonomy match is enough for scope comparison
//   - Name-level similarity: fuzzy polish string matching for materials
//   - Transparency: all assumptions explicit in warnings[]
//   - No AI calls: fully deterministic, fast, offline-capable
//
// Matching axes:
//   1. finish_materials (project) vs detected_materials (room) — by category + name
//   2. work_scope_from_project (project) vs work_scope (room) — by category
//   3. equipment_detected (project) vs detected_materials + work_scope (room) — by name
//   4. extra room scope items not in project → scope_additions[]
// =============================================================================

import type {
  ProjectAnalysisResult,
  ProjectScopeItem,
  ProjectComparisonResult,
  ComparisonCategory,
  ComparisonDiff,
} from './project.types'
import type { AnalysisResult } from '../analysis.types'

// ── String normalization ─────────────────────────────────────────────────────

/** Remove diacritics, lowercase, normalize whitespace */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')    // strip diacritics
    .replace(/[^a-z0-9 ]/g, ' ')        // keep only alphanumeric + space
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Category synonym groups ──────────────────────────────────────────────────
// Each inner array = synonyms that map to the same construction category.
// Used to bridge project-engine categories and room-engine categories.

const CATEGORY_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ['tiles', 'tiling', 'glazura', 'plytek', 'gres', 'ceramika', 'okładziny',
   'okładziny_scian', 'okładziny_podlog', 'posadzki', 'ceramiczne'],
  ['plumbing', 'hydraulika', 'wod_kan', 'instalacja_sanitarna', 'armatura', 'sanitarny'],
  ['electrical', 'elektryka', 'instalacja_elektryczna'],
  ['waterproofing', 'hydroizolacja'],
  ['demolition', 'rozbiork', 'wyburzenie', 'demontaz', 'skuwanie'],
  ['substrate', 'podloze', 'wyrownanie', 'posadzka_wylewka', 'wylewka', 'jastrych'],
  ['painting', 'paint', 'malowanie', 'farby', 'gruntowan'],
  ['flooring', 'podlog', 'panele', 'parkiet', 'deski', 'winyl'],
  ['drywall', 'gips', 'zabudowa_gk', 'gipsokart', 'plyta_gk'],
  ['finishing', 'wykonczenie', 'listwowanie', 'silikon', 'fugi'],
  ['joinery', 'stolarka', 'drzwi', 'okna'],
  ['insulation', 'izolacja', 'ocieplenie', 'styropian'],
  ['sanitary', 'wc', 'toaleta', 'miska', 'umywalka', 'wanna', 'prysznic',
   'muszla', 'sedes'],
]

/** True if two category strings belong to the same synonym group */
function sameCategory(a: string, b: string): boolean {
  const na = norm(a)
  const nb = norm(b)
  if (na === nb || na.includes(nb) || nb.includes(na)) return true
  for (const group of CATEGORY_GROUPS) {
    const ng = group.map(s => norm(s))
    const inA = ng.some(g => na.includes(g) || g.includes(na))
    const inB = ng.some(g => nb.includes(g) || g.includes(nb))
    if (inA && inB) return true
  }
  return false
}

/** True if two name strings have at least one meaningful word in common */
function nameSimilarity(a: string, b: string): boolean {
  const na = norm(a)
  const nb = norm(b)
  if (na.includes(nb) || nb.includes(na)) return true
  const wordsA = na.split(' ').filter(w => w.length >= 4)
  const wordsB = nb.split(' ').filter(w => w.length >= 4)
  return wordsA.some(wa => wordsB.some(wb => wa.includes(wb) || wb.includes(wa)))
}

// ── Comparison engine ─────────────────────────────────────────────────────────

/**
 * compareProjectToReality — client-side comparison of project result vs room result.
 *
 * Returns ProjectComparisonResult with diffs[] bucketed into:
 *   matching          — project and reality agree
 *   missing_from_reality — project specifies it, not seen in room analysis
 *   changed           — category matches but material/element differs
 *   uncertain         — insufficient data to classify
 *
 * Plus scope_additions[] — work items found in room that are NOT in the project.
 */
export function compareProjectToReality(
  project: ProjectAnalysisResult,
  room: AnalysisResult,
): ProjectComparisonResult {
  const diffs: ComparisonDiff[] = []
  const scope_additions: ProjectScopeItem[] = []

  const lowConfRoom    = room.extraction_confidence < 35
  const lowConfProject = project.confidence < 35

  const roomMaterials = room.detected_materials ?? []
  const roomScope     = room.work_scope ?? []

  // ── A. Finish materials: project → reality ─────────────────────────────────
  for (const pm of project.finish_materials) {
    const label = pm.specification
      ? `${pm.name} — ${pm.specification}`
      : pm.name

    // Try to find a category + name match in room materials
    const catMatch = roomMaterials.filter(rm => sameCategory(pm.category, rm.category))
    const fullMatch = catMatch.find(rm => nameSimilarity(pm.name, rm.name))
    const scopeMatch = roomScope.find(rs =>
      sameCategory(pm.category, rs.category) && rs.confidence >= 40,
    )

    let category: ComparisonCategory
    let reality_description: string | null = null
    let impact_on_scope: string | null = null

    if (fullMatch) {
      category = 'matching'
      reality_description = fullMatch.name + (fullMatch.notes ? ` (${fullMatch.notes})` : '')
    } else if (catMatch.length > 0) {
      // Same category, different name → possible change
      category = lowConfRoom ? 'uncertain' : 'changed'
      reality_description = catMatch[0].name
      impact_on_scope = 'Inna specyfikacja niż w projekcie — sprawdź przed zamówieniem'
    } else if (scopeMatch) {
      // Found in scope (work item) but not as detected material
      category = 'matching'
      reality_description = `(zakres prac) ${scopeMatch.description}`
    } else {
      category = lowConfRoom ? 'uncertain' : 'missing_from_reality'
      impact_on_scope = lowConfRoom
        ? 'Nie można potwierdzić — niska jakość zdjęć'
        : 'Materiał z projektu niewidoczny na zdjęciach'
    }

    diffs.push({
      element: label,
      category,
      project_description: label + (pm.room ? ` (${pm.room})` : ''),
      reality_description,
      impact_on_scope,
      notes: pm.notes ?? null,
    })
  }

  // ── B. Extra room materials without project counterpart ────────────────────
  for (const rm of roomMaterials) {
    if (rm.confidence < 45) continue
    const hasProjectMatch = project.finish_materials.some(pm =>
      sameCategory(pm.category, rm.category),
    )
    if (!hasProjectMatch) {
      diffs.push({
        element: rm.name,
        category: 'uncertain',
        project_description: null,
        reality_description: rm.name + (rm.notes ? ` (${rm.notes})` : ''),
        impact_on_scope:
          'Widoczny na zdjęciach, brak w projekcie — może wymagać demontażu lub osobnej wyceny',
        notes: null,
      })
    }
  }

  // ── C. Work scope: project → reality ──────────────────────────────────────
  for (const ps of project.work_scope_from_project) {
    if (ps.priority === 'optional') continue

    // Look for a matching category in room scope
    const roomScopeMatch = roomScope.find(rs =>
      sameCategory(ps.category, rs.category) && rs.confidence >= 40,
    )

    if (roomScopeMatch) {
      diffs.push({
        element: ps.description,
        category: 'matching',
        project_description: ps.description + (ps.room ? ` (${ps.room})` : ''),
        reality_description: roomScopeMatch.description,
        impact_on_scope: null,
        notes: ps.notes ?? null,
      })
    } else {
      // Avoid duplicating items already captured in materials section
      const alreadyCaptured = diffs.some(d =>
        sameCategory(
          // try matching element label to category
          d.element.toLowerCase(),
          ps.category,
        ) && (d.category === 'matching' || d.category === 'missing_from_reality'),
      )
      if (!alreadyCaptured) {
        const category: ComparisonCategory = ps.confidence >= 65
          ? (lowConfRoom ? 'uncertain' : 'missing_from_reality')
          : 'uncertain'

        diffs.push({
          element: ps.description,
          category,
          project_description: ps.description + (ps.room ? ` (${ps.room})` : ''),
          reality_description: null,
          impact_on_scope: ps.priority === 'required'
            ? 'Praca wymagana wg projektu — nie potwierdzona na zdjęciach'
            : 'Praca prawdopodobna wg projektu — wymaga weryfikacji na miejscu',
          notes: ps.notes ?? null,
        })
      }
    }
  }

  // ── D. Extra work scope from room not in project ────────────────────────────
  for (const rs of roomScope) {
    if (rs.confidence < 50) continue
    const hasProjectMatch = project.work_scope_from_project.some(ps =>
      sameCategory(ps.category, rs.category),
    )
    if (!hasProjectMatch) {
      scope_additions.push({
        room: null,
        description: rs.description,
        category: rs.category,
        unit: rs.estimated_unit ?? null,
        quantity: rs.estimated_qty ?? null,
        priority: 'likely',
        confidence: rs.confidence,
        notes: 'Wykryto na zdjęciach — brak w projekcie',
      })
    }
  }

  // ── E. Equipment from project not in reality ───────────────────────────────
  for (const eq of project.equipment_detected) {
    const normedEq = norm(eq)
    const inMaterials = roomMaterials.some(rm => {
      const normedRm = norm(rm.name)
      return normedRm.includes(normedEq) || normedEq.includes(normedRm) ||
        normedEq.split(' ').filter(w => w.length >= 4).some(w => normedRm.includes(w))
    })
    const inScope = roomScope.some(rs => {
      const normedRs = norm(rs.description)
      return normedRs.includes(normedEq) ||
        normedEq.split(' ').filter(w => w.length >= 4).some(w => normedRs.includes(w))
    })
    // Already mentioned in finish_materials? Skip to avoid duplicate.
    const alreadyInDiffs = diffs.some(d =>
      nameSimilarity(d.element, eq),
    )
    if (!inMaterials && !inScope && !alreadyInDiffs) {
      diffs.push({
        element: eq,
        category: lowConfRoom ? 'uncertain' : 'missing_from_reality',
        project_description: eq,
        reality_description: null,
        impact_on_scope: 'Wyposażenie z projektu niewidoczne na zdjęciach',
        notes: null,
      })
    }
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const matching  = diffs.filter(d => d.category === 'matching').length
  const missing   = diffs.filter(d => d.category === 'missing_from_reality').length
  const changed   = diffs.filter(d => d.category === 'changed').length
  const uncertain = diffs.filter(d => d.category === 'uncertain').length

  // ── Confidence ─────────────────────────────────────────────────────────────
  const totalComparable = matching + missing + changed + uncertain
  let confidence = 0
  if (totalComparable > 0 && (roomMaterials.length > 0 || roomScope.length > 0)) {
    const baseConf = Math.round((project.confidence + room.extraction_confidence) / 2)
    const agreementRatio = matching / Math.max(1, totalComparable)
    confidence = lowConfRoom || lowConfProject
      ? Math.min(40, baseConf)
      : Math.round(baseConf * (0.4 + 0.6 * agreementRatio))
    confidence = Math.min(100, Math.max(0, confidence))
  }

  // ── Summary sentence ───────────────────────────────────────────────────────
  const dataAvailable = roomMaterials.length > 0 || roomScope.length > 0
  let summary: string
  if (!dataAvailable) {
    summary = 'Brak danych z analizy zdjęć do porównania. Dodaj więcej zdjęć pomieszczenia.'
  } else if (missing === 0 && changed === 0) {
    summary = `Projekt zgodny z rzeczywistością — potwierdzono ${matching} ${matching === 1 ? 'element' : 'elementów'}.`
  } else {
    const parts: string[] = []
    if (matching > 0)  parts.push(`${matching} zgodnych`)
    if (missing > 0)   parts.push(`${missing} brakujących na zdjęciach`)
    if (changed > 0)   parts.push(`${changed} różnych od projektu`)
    if (uncertain > 0) parts.push(`${uncertain} niepewnych`)
    summary = `Porównanie: ${parts.join(', ')}.`
    if (scope_additions.length > 0) {
      summary += ` Wykryto ${scope_additions.length} dodatkowych ${scope_additions.length === 1 ? 'pracę' : 'prac'} na zdjęciach.`
    }
  }

  // ── Warnings ───────────────────────────────────────────────────────────────
  const warnings: string[] = []
  warnings.push(
    'Upewnij się, że zdjęcia dotyczą tego samego pomieszczenia co analizowany projekt.',
  )
  if (lowConfRoom) {
    warnings.push('Niska pewność analizy zdjęć — wyniki porównania są orientacyjne.')
  }
  if (lowConfProject) {
    warnings.push('Niska pewność analizy projektu — wyniki porównania są orientacyjne.')
  }
  if (!dataAvailable) {
    warnings.push(
      'Analiza zdjęć nie zwróciła materiałów ani zakresu prac. Spróbuj dodać więcej zdjęć.',
    )
  }
  if (project.warnings.length > 0) {
    warnings.push(...project.warnings.map(w => `[Projekt] ${w}`))
  }
  if ((room.extraction_warnings ?? []).length > 0) {
    warnings.push(...(room.extraction_warnings ?? []).map(w => `[Zdjęcia] ${w}`))
  }

  return {
    project_type: project.project_type,
    space_type:   null,  // not available from AnalysisResult envelope
    diffs,
    summary,
    scope_additions,
    warnings,
    confidence,
  }
}
