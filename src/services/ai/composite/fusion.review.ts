// =============================================================================
// src/services/ai/composite/fusion.review.ts
// =============================================================================
// Fusion Review Queue — operator-facing read model.
//
// Pure projection layer: takes FusedBundleOutput, returns FusionReviewQueue.
// No DB reads, no side effects, no new computation — only reshaping signals
// already present on each FusedScopeCandidate.
//
// Sort order: blocked → needs_review → ready.
// Within bucket: descending confidence.
// =============================================================================

import type {
  FusedBundleOutput,
  FusedScopeCandidate,
  FusionReviewQueue,
  ReviewQueueItem,
} from './fusion.types'

// ── Bucket sort order ─────────────────────────────────────────────────────────

const BUCKET_ORDER: Record<'ready' | 'needs_review' | 'blocked', number> = {
  blocked:      0,
  needs_review: 1,
  ready:        2,
}

// ── Action label derivation ───────────────────────────────────────────────────

/**
 * Produce a single human-readable action label from triage signals.
 * Polish — matches the product's target language.
 * Deterministic: same input → same output.
 */
function deriveActionLabel(
  readiness: 'ready' | 'needs_review' | 'blocked',
  reasons: string[],
): string {
  if (readiness === 'ready') return 'Gotowy do zatwierdzenia'

  if (readiness === 'blocked') {
    const unresolved = reasons
      .filter(r => r.startsWith('unresolved_conflict:'))
      .map(r => r.replace('unresolved_conflict:', ''))
    if (unresolved.length > 0) {
      return `Zablokowany: nierozwiązany konflikt (${unresolved.join(', ')})`
    }
    if (reasons.includes('low_confidence')) {
      return 'Zablokowany: zbyt niski poziom pewności'
    }
    return 'Zablokowany: wymagana ręczna weryfikacja'
  }

  // needs_review — pick the most informative single label
  if (reasons.includes('peer_conflict')) {
    return 'Sprawdź: możliwa duplikacja elementu'
  }
  const resolvedConflicts = reasons
    .filter(r => r.startsWith('conflict:'))
    .map(r => r.replace('conflict:', ''))
  if (resolvedConflicts.length > 0) {
    return `Sprawdź: konflikt pól (${resolvedConflicts.join(', ')})`
  }
  if (reasons.includes('no_linked_context')) {
    return 'Sprawdź: brak danych kontekstowych (wymiary / zakres)'
  }
  return 'Sprawdź: wymaga przeglądu'
}

// ── Conflict summary projection ───────────────────────────────────────────────

function buildConflictsSummary(candidate: FusedScopeCandidate): string[] {
  return candidate.conflicts.map(cf => {
    const vals = cf.values
      .map(v => String(v.value))
      .join(' vs ')
    const winner = cf.resolved_value != null ? ` → ${String(cf.resolved_value)} [${cf.resolution}]` : ` [${cf.resolution}]`
    return `${cf.field}: ${vals}${winner}`
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build an operator review queue from a fused bundle output.
 *
 * @param output - Result of runFusion()
 * @returns FusionReviewQueue sorted blocked → needs_review → ready
 */
export function buildReviewQueue(output: FusedBundleOutput): FusionReviewQueue {
  const items: ReviewQueueItem[] = output.fused_scope_candidates.map(c => ({
    candidate_id:          c.id,
    evidence_type:         c.evidence_type,
    room_label:            c.room_label,
    subject:               c.subject,
    zone:                  c.zone,
    review_readiness:      c.review_readiness,
    review_reasons:        c.review_reasons,
    action_label:          deriveActionLabel(c.review_readiness, c.review_reasons),
    confidence:            c.confidence,
    merged_from_count:     c.merged_from_count,
    strong_context_count:  c.strong_context_count,
    fallback_context_count: c.fallback_context_count,
    conflicts_summary:     buildConflictsSummary(c),
    peer_candidate_ids:    c.category_peer_ids,
    source_anchors:        c.source_anchors,
    evidence_ids:          c.evidence_ids,
  }))

  // Sort: bucket order first, then descending confidence within bucket
  items.sort((a, b) => {
    const bucketDiff = BUCKET_ORDER[a.review_readiness] - BUCKET_ORDER[b.review_readiness]
    if (bucketDiff !== 0) return bucketDiff
    return b.confidence - a.confidence
  })

  const summary = {
    total:        items.length,
    ready:        items.filter(i => i.review_readiness === 'ready').length,
    needs_review: items.filter(i => i.review_readiness === 'needs_review').length,
    blocked:      items.filter(i => i.review_readiness === 'blocked').length,
  }

  return {
    bundle_id: output.bundle_id,
    built_at:  new Date().toISOString(),
    summary,
    items,
  }
}
