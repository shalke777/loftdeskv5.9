// =============================================================================
// src/shared/lib/confidence-model.ts
// Rule-based confidence band model for AI analysis runs.
// =============================================================================
//
// PRINCIPLE:
//   Raw model confidence ≠ analysis quality.
//   Raw confidence = "how certain the model is about what it sees in the image".
//   Adjusted confidence = "how complete and reliable this analysis is for the operator".
//
// The model is intentionally CONSERVATIVE.
// It is better to show a lower band and be honest than to suggest false precision.
//
// PENALTY RULES (applied to raw 0–1 score):
//   missing_data flag      → −0.20  (hard cap: max 0.49 when missing_data is true)
//   per open question      → −0.04 each, max −0.16 total
//   per open risk          → −0.05 each, max −0.20 total
//
// BAND THRESHOLDS (after penalties):
//   < 0.30   → "Niska pewność"   — critical gaps, do not use for estimate
//   0.30–0.49 → "Warunkowa"      — usable with operator corrections
//   0.50–0.69 → "Umiarkowana"    — reasonable basis, verify key items
//   ≥ 0.70   → "Wysoka"         — rarely reached; requires no missing data + few open items
//
// DO NOT add machine-learning calibration here.
// This is a rule-based defensive model. Calibration is a separate future step.
// =============================================================================

export type ConfidenceBand = 'low' | 'conditional' | 'moderate' | 'high'

export interface ConfidenceBandResult {
  band:  ConfidenceBand
  /** Polish display label shown in UI */
  label: string
  /** CSS color token for the label */
  color: string
  /** Penalised score, 0–1, after all penalties applied */
  score: number
}

export interface ConfidenceInput {
  /** Raw model output, 0–1. Source: ai_analysis_runs.confidence_summary */
  rawScore:            number
  /** True when run is flagged as missing critical input data */
  hasMissingData:      boolean
  /** Count of questions with status 'unanswered' */
  openQuestionsCount:  number
  /** Count of risks with status 'open' */
  openRisksCount:      number
}

/**
 * Computes a penalised confidence band from the raw model score + run context.
 *
 * Used in both AiRunReviewPanel (full data: questions + risks available)
 * and AiRunsList (partial data: only missing_data flag available).
 * Pass 0 for openQuestionsCount / openRisksCount when those are unavailable.
 */
export function computeConfidenceBand(input: ConfidenceInput): ConfidenceBandResult {
  let score = Math.min(1, Math.max(0, input.rawScore))

  // Penalty: missing data — most impactful single signal
  if (input.hasMissingData) score -= 0.20

  // Penalty: unanswered questions (each one signals scope uncertainty)
  score -= Math.min(0.16, input.openQuestionsCount * 0.04)

  // Penalty: open risks (each one signals execution uncertainty)
  score -= Math.min(0.20, input.openRisksCount * 0.05)

  // Hard cap: analysis with missing data cannot reach 'high' certainty
  if (input.hasMissingData) score = Math.min(score, 0.49)

  score = Math.max(0, score)

  if (score < 0.30) {
    return {
      band:  'low',
      label: 'Niska pewność',
      color: 'var(--color-danger, #EF4444)',
      score,
    }
  }
  if (score < 0.50) {
    return {
      band:  'conditional',
      label: 'Warunkowa',
      color: 'var(--color-warning, #F59E0B)',
      score,
    }
  }
  if (score < 0.70) {
    return {
      band:  'moderate',
      label: 'Umiarkowana',
      color: 'var(--color-text-secondary)',
      score,
    }
  }
  return {
    band:  'high',
    label: 'Wysoka',
    color: 'var(--color-success, #10B981)',
    score,
  }
}
