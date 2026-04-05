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
// SCALE AUTO-DETECTION:
//   P0 pipeline (analyze-room-photo) stores confidence_summary on a 0–100 scale.
//   P1 pipeline (extraction.contract) uses a 0–1 scale.
//   Pass either scale — values > 1 are automatically normalised by dividing by 100.
//
// PENALTY RULES (applied to normalised 0–1 score):
//   missing_data flag      → −0.20  (hard cap: max 0.49 when missing_data is true)
//   photo-only structural  → −0.10  (P0: no drawings, all inputs are site/progress photos)
//   per open question      → −0.04 each, max −0.16 total
//   per open risk          → −0.05 each, max −0.20 total
//
// BAND THRESHOLDS (after penalties):
//   < 0.30   → "Niska pewność"    — critical gaps, do not use for estimate
//   0.30–0.49 → "Warunkowa"       — usable only with operator corrections
//   0.50–0.69 → "Umiarkowana"     — reasonable basis, verify key items
//   ≥ 0.70   → "Wysoka"          — requires complete docs + no missing data + few open items
//
// STRUCTURAL CAP TABLE (trust ceiling per input source):
//   architectural_drawing / technical_spec  → no additional cap (hard documents)
//   installation_drawing / design_visualization → −0.05 cap
//   site_photo / progress_photo (P0 default) → −0.10 (photoOnly flag)
//   derived geometry / hypothesis            → score already reflects model uncertainty
//   missing_data fallback                    → max 0.49 (hard cap)
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
  /**
   * Raw model output. Accepts EITHER scale automatically:
   *   0–1   (P1 extraction.contract scale)
   *   0–100 (P0 analyze-room-photo scale — confidence_summary stored in DB)
   * Values > 1 are divided by 100 before any computation.
   */
  rawScore:            number
  /** True when run is flagged as missing critical input data */
  hasMissingData:      boolean
  /** Count of questions with status 'unanswered' */
  openQuestionsCount:  number
  /** Count of risks with status 'open' */
  openRisksCount:      number
  /**
   * True for P0 photo-only runs (no drawings, no technical specs).
   * Applies a structural −0.10 penalty: photos alone cannot reach "Wysoka".
   * Always pass `true` for ai_analysis_runs from analyze-room-photo.
   */
  photoOnly?:          boolean
}

/**
 * Computes a penalised confidence band from the raw model score + run context.
 *
 * Used in both AiRunReviewPanel (full data: questions + risks available)
 * and AiRunsList (partial data: only missing_data flag available).
 * Pass 0 for openQuestionsCount / openRisksCount when those are unavailable.
 */
export function computeConfidenceBand(input: ConfidenceInput): ConfidenceBandResult {
  // Normalise: P0 stores 0–100, P1 uses 0–1. Both accepted.
  const raw = input.rawScore > 1 ? input.rawScore / 100 : input.rawScore
  let score = Math.min(1, Math.max(0, raw))

  // Structural penalty: photo-only inputs (no hard-document source)
  if (input.photoOnly) score -= 0.10

  // Penalty: missing data — most impactful single signal
  if (input.hasMissingData) score -= 0.20

  // Penalty: unanswered questions (each one signals scope uncertainty)
  score -= Math.min(0.16, input.openQuestionsCount * 0.04)

  // Penalty: open risks (each one signals execution uncertainty)
  score -= Math.min(0.20, input.openRisksCount * 0.05)

  // Hard cap: analysis with missing data cannot reach 'moderate' or higher
  if (input.hasMissingData) score = Math.min(score, 0.49)

  score = Math.max(0, score)

  if (score < 0.30) {
    return {
      band:  'low',
      label: 'Niska pewność',
      color: 'var(--color-danger, var(--color-error))',
      score,
    }
  }
  if (score < 0.50) {
    return {
      band:  'conditional',
      label: 'Warunkowa',
      color: 'var(--color-warning, var(--color-accent))',
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
    color: 'var(--color-success, var(--color-brand))',
    score,
  }
}
