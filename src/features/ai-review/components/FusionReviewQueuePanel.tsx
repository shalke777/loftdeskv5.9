// =============================================================================
// FusionReviewQueuePanel — operator-facing fusion review queue
// =============================================================================
// Displays the FusionReviewQueue for the latest bundle, sorted
// blocked → needs_review → ready.
//
// Mounted in ProjectAiTab only when bundle is eligible_for_composite.
// Read-only — no mutations in v1.
// =============================================================================

import type { FusionReviewQueue, ReviewQueueItem } from '@/services/ai/composite/fusion.types'

interface Props {
  queue:      FusionReviewQueue | null
  isLoading?: boolean
  error?:     Error | null
}

// ── Bucket style map ──────────────────────────────────────────────────────────

const BUCKET_STYLE: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  blocked:      { bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444', label: 'Zablokowany'   },
  needs_review: { bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', label: 'Do sprawdzenia' },
  ready:        { bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E', label: 'Gotowy'          },
}

// ── Single item row ───────────────────────────────────────────────────────────

function ReviewItemRow({ item }: { item: ReviewQueueItem }) {
  const style = BUCKET_STYLE[item.review_readiness] ?? BUCKET_STYLE.needs_review
  const ctxLabel = (item.strong_context_count + item.fallback_context_count) > 0
    ? `ctx ${item.strong_context_count}s/${item.fallback_context_count}f`
    : 'brak kontekstu'

  return (
    <div
      style={{
        display:      'grid',
        gap:           4,
        padding:      '9px 12px',
        borderRadius:  6,
        background:   style.bg,
        border:       `1px solid ${style.border}`,
        fontSize:      12,
      }}
    >
      {/* Top row: dot + type + room + conf + ctx */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: style.dot, flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, color: 'var(--color-text)', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.04em' }}>
          {item.evidence_type}
        </span>
        {item.room_label && (
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {item.room_label}
          </span>
        )}
        <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
          {Math.round(item.confidence * 100)}% · {ctxLabel}
        </span>
      </div>

      {/* Subject */}
      <div style={{ color: 'var(--color-text)', fontWeight: 500, paddingLeft: 16 }}>
        {item.subject}
      </div>

      {/* Action label */}
      <div style={{ color: style.dot, paddingLeft: 16, fontSize: 11, fontWeight: 500 }}>
        {item.action_label}
      </div>

      {/* Conflict summaries */}
      {item.conflicts_summary.map((cs, i) => (
        <div key={i} style={{ paddingLeft: 16, color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
          ⚠ {cs}
        </div>
      ))}

      {/* Source anchors (first 2) */}
      {item.source_anchors.length > 0 && (
        <div style={{ paddingLeft: 16, color: 'var(--color-text-secondary)', fontSize: 10 }}>
          {item.source_anchors.slice(0, 2).map((a, i) => (
            <span key={i} style={{ display: 'block' }}>
              ↳ {a.split(' | ').slice(0, 3).join(' › ')}
            </span>
          ))}
          {item.source_anchors.length > 2 && (
            <span>+{item.source_anchors.length - 2} więcej</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function FusionReviewQueuePanel({ queue, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div
        style={{
          padding:      '12px 14px',
          borderRadius:  8,
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          fontSize:      12,
          color:        'var(--color-text-secondary)',
        }}
      >
        Ładowanie kolejki review…
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding:      '12px 14px',
          borderRadius:  8,
          background:   '#FEF2F2',
          border:       '1px solid #FECACA',
          fontSize:      12,
          color:        '#DC2626',
        }}
      >
        Błąd fusion review: {error.message}
      </div>
    )
  }

  if (!queue) {
    return null
  }

  const { summary, items } = queue

  return (
    <div
      style={{
        display:      'grid',
        gap:           8,
        padding:      '12px 14px',
        borderRadius:  8,
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 13 }}>
          Fusion Review
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
          {summary.total} kandydatów
        </span>
        {/* Summary badges */}
        {summary.blocked > 0 && (
          <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
            {summary.blocked} zablok.
          </span>
        )}
        {summary.needs_review > 0 && (
          <span style={{ background: '#FEF3C7', color: '#D97706', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
            {summary.needs_review} do spraw.
          </span>
        )}
        {summary.ready > 0 && (
          <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
            {summary.ready} gotowych
          </span>
        )}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
          Brak kandydatów w bundlu.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {items.map(item => (
            <ReviewItemRow key={item.candidate_id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
