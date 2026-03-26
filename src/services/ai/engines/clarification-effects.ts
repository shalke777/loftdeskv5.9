// =============================================================================
// clarification-effects.ts — Apply user clarification answers to AnalysisResult
// =============================================================================
// Pure function. No side effects. No API calls. Client-side only.
//
// Usage (RoomAnalysisPage):
//   const displayResult = useMemo(
//     () => applyAnswersToResult(result, answers, result.clarification_questions ?? []),
//     [result, answers],
//   )
// =============================================================================

import type { AnalysisResult, SuggestedEstimateItem } from '@/services/ai/analysis.types'
import type { ClarificationQuestion, ClarificationAnswer } from './clarification.types'

// ── Single-choice: answer value → task effects ────────────────────────────────
// Maps questionId → choiceLabel → { boost: taskIds[], reduce: taskIds[] }
// boost  → confidence raised to ≥85, source/provenance upgraded to 'dependency_inferred'
// reduce → confidence lowered to ≤15  (item is removed if it was confirmation_needed)

const CHOICE_EFFECTS: Record<string, Record<string, { boost?: string[]; reduce?: string[] }>> = {
  // Bateria prysznicowa podtynkowa / natynkowa
  'wi_q2': {
    'Podtynkowa': { boost: ['plumb_mixing_valve'], reduce: ['fit_shower_set'] },
    'Natynkowa':  { boost: ['fit_shower_set'],     reduce: ['plumb_mixing_valve'] },
  },
  // Wanna wolnostojąca / zabudowana GK
  'bt_q2': {
    'Wolnostojąca':    { boost: ['fix_freestanding_bath'], reduce: ['gk_bath_panel'] },
    'Zabudowana w GK': { boost: ['gk_bath_panel'],         reduce: ['fix_freestanding_bath'] },
  },
  // Bateria wannowa
  'bt_q3': {
    'Podtynkowa': { reduce: ['fit_bathtub_tap'] },
    'Natynkowa':  { boost: ['fit_bathtub_tap'] },
  },
  // Ogrzewanie podłogowe elektryczne / wodne
  'uh_q1': {
    'Elektryczne':  { boost: ['underfloor_thermostat', 'elec_circuit_breaker'], reduce: ['underfloor_hydro'] },
    'Wodne (C.O.)': { boost: ['underfloor_hydro'],                              reduce: ['underfloor_thermostat'] },
  },
  // Grzejnik drabinkowy wodny / elektryczny
  'tr_q1': {
    'Wodny (C.O.)': { boost: ['plumb_cold_point', 'plumb_hot_point'], reduce: ['elec_underfloor'] },
    'Elektryczny':  { boost: ['elec_underfloor'],                      reduce: ['plumb_cold_point', 'plumb_hot_point'] },
  },
  // Zabudowa kotła wykafelkowana / malowana
  'bc_q1': {
    'Wykafelkowana': { boost: ['tile_wall_full'] },
    'Malowana':      { reduce: ['tile_wall_full'] },
  },
  // Zabudowa pionów wykafelkowana / malowana
  'pc_q2': {
    'Wykafelkowana': { boost: ['tile_wall_full'] },
    'Malowana':      { reduce: ['tile_wall_full'] },
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function boostItem(item: SuggestedEstimateItem): void {
  item.confidence = Math.max(item.confidence, 85)
  if (item.source    === 'confirmation_needed') item.source    = 'dependency_inferred'
  if (item.provenance === 'confirmation_needed') item.provenance = 'dependency_inferred'
}

function reduceItem(item: SuggestedEstimateItem): void {
  item.confidence = Math.min(item.confidence, 15)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Derives a new AnalysisResult that reflects user-provided clarification answers.
 *
 * The original `result` is never mutated — a shallow clone with deep-cloned
 * estimate items is returned. When there are no answers, the original reference
 * is returned unchanged so downstream useMemo comparisons stay cheap.
 *
 * @param result    Raw AnalysisResult from the AI engine
 * @param answers   User answers collected so far (from useState in RoomAnalysisPage)
 * @param questions Original clarification questions (from result.clarification_questions)
 */
export function applyAnswersToResult(
  result:    AnalysisResult,
  answers:   ClarificationAnswer[],
  questions: ClarificationQuestion[],
): AnalysisResult {
  if (answers.length === 0) return result

  const questionMap = new Map(questions.map(q => [q.id, q]))
  const answeredIds = new Set(answers.map(a => a.questionId))

  // Shallow clone so we don't mutate the cached original
  const next: AnalysisResult = { ...result }

  // Deep-clone estimate items — these are what we will mutate
  next.suggested_estimate_items = (result.suggested_estimate_items ?? []).map(i => ({ ...i }))

  // Build a library_id → item lookup for O(1) effect application
  const estimateMap = new Map<string, SuggestedEstimateItem>()
  for (const item of next.suggested_estimate_items) {
    if (item.library_id) estimateMap.set(item.library_id, item)
  }

  // Apply effects for each answered question
  for (const answer of answers) {
    const q = questionMap.get(answer.questionId)
    if (!q) continue

    if (q.answerType === 'yes_no') {
      const confirmed = answer.answerValue === true || answer.answerValue === 'Tak'
      for (const taskId of q.relatedTaskIds) {
        const item = estimateMap.get(taskId)
        if (!item) continue
        if (confirmed) boostItem(item)
        else           reduceItem(item)
      }
    }

    if (q.answerType === 'single_choice') {
      const choice  = String(answer.answerValue)
      const effects = CHOICE_EFFECTS[q.id]?.[choice]
      if (effects) {
        for (const taskId of effects.boost  ?? []) { const it = estimateMap.get(taskId); if (it) boostItem(it)  }
        for (const taskId of effects.reduce ?? []) { const it = estimateMap.get(taskId); if (it) reduceItem(it) }
      }
    }

    // number / text answers: no task confidence effect in v1
    // They just mark the question as answered in the UI
  }

  // Remove items that were "confirmation_needed" but user said no (reduced to ≤15)
  next.suggested_estimate_items = next.suggested_estimate_items.filter(
    item => !(item.confidence <= 15
      && (item.source === 'confirmation_needed' || item.provenance === 'confirmation_needed')),
  )

  // Improve overall extraction_confidence proportionally to answered critical questions
  const criticalQuestions    = questions.filter(q => q.severity === 'critical_for_scope')
  const answeredCriticalCount = criticalQuestions.filter(q => answeredIds.has(q.id)).length
  if (answeredCriticalCount > 0 && criticalQuestions.length > 0) {
    const boost = Math.round((answeredCriticalCount / criticalQuestions.length) * 12)
    next.extraction_confidence = Math.min(97, next.extraction_confidence + boost)
  }

  return next
}
