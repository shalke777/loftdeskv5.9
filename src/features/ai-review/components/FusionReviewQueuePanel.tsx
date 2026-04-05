// =============================================================================
// FusionReviewQueuePanel — operator-facing fusion review queue
// =============================================================================
// v2 UX polish:
//   1. Items grouped into visual bucket sections (blocked / needs_review / ready)
//   2. Each item row is collapsed by default — click to expand detail
//      (review_reasons, conflicts, source_anchors). Blocked items auto-expand.
// =============================================================================

import { useState } from 'react'
import type { FusionReviewQueue, ReviewQueueItem } from '@/services/ai/composite/fusion.types'

interface Props {
  queue:      FusionReviewQueue | null
  isLoading?: boolean
  error?:     Error | null
}

// ── Bucket config ─────────────────────────────────────────────────────────────

const BUCKET: Record<string, { bg: string; border: string; dot: string; label: string; icon: string }> = {
  blocked:      { bg: 'var(--color-error-soft)', border: '#FECACA', dot: '#A83228', label: 'Zablokowane',    icon: '⛔' },
  needs_review: { bg: '#FFFBEB', border: '#FDE68A', dot: '#B8742A', label: 'Do sprawdzenia', icon: '⚠' },
  ready:        { bg: '#F0FDF4', border: '#BBF7D0', dot: '#1A5C32', label: 'Gotowe',          icon: '✓' },
}

// ── Format machine review_reason into readable Polish ─────────────────────────

function formatReason(r: string): string {
  if (r.startsWith('peer_conflict:')) return `konflikt: ${r.slice('peer_conflict:'.length)}`
  if (r === 'low_confidence')         return 'niska pewność'
  if (r === 'no_context')             return 'brak kontekstu'
  if (r === 'possible_duplicate')     return 'możliwa duplikacja'
  if (r === 'unresolved_conflict')    return 'nierozwiązany konflikt'
  return r
}

// ── Single item row (collapsible) ─────────────────────────────────────────────

function ReviewItemRow({ item, defaultExpanded }: { item: ReviewQueueItem; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const st = BUCKET[item.review_readiness] ?? BUCKET.needs_review

  const hasDetail =
    item.review_reasons.length > 0 ||
    item.conflicts_summary.length > 0 ||
    item.source_anchors.length > 0

  return (
    <div
      style={{
        borderRadius: 6,
        background:   st.bg,
        border:       `1px solid ${st.border}`,
        fontSize:      12,
        overflow:     'hidden',
      }}
    >
      {/* ── Summary (always visible) ── */}
      <div
        style={{ display: 'grid', gap: 3, padding: '8px 10px', cursor: hasDetail ? 'pointer' : 'default' }}
        onClick={() => hasDetail && setExpanded(e => !e)}
      >
        {/* Meta: dot + type + room/zone + confidence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em' }}>
            {item.evidence_type}
          </span>
          {(item.room_label || item.zone) && (
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>
              {[item.room_label, item.zone].filter(Boolean).join(' · ')}
            </span>
          )}
          <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'auto', fontSize: 11 }}>
            {Math.round(item.confidence * 100)}%
            {item.merged_from_count > 1 && ` · ${item.merged_from_count} źr.`}
          </span>
          {hasDetail && (
            <span style={{ color: st.dot, fontSize: 10, marginLeft: 2, userSelect: 'none' }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </div>

        {/* Subject */}
        <div style={{ color: 'var(--color-text)', fontWeight: 500, paddingLeft: 13 }}>
          {item.subject}
        </div>

        {/* Action label — always visible */}
        <div style={{ color: st.dot, paddingLeft: 13, fontSize: 11, fontWeight: 600 }}>
          {item.action_label}
        </div>
      </div>

      {/* ── Expandable detail ── */}
      {expanded && hasDetail && (
        <div
          style={{
            borderTop:  `1px solid ${st.border}`,
            padding:    '7px 10px 8px 23px',
            display:    'grid',
            gap:         5,
            background: 'rgba(255,255,255,0.55)',
          }}
        >
          {/* Review reasons as pill badges */}
          {item.review_reasons.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 5px' }}>
              {item.review_reasons.map((r, i) => (
                <span
                  key={i}
                  style={{
                    background:   'rgba(0,0,0,0.07)',
                    borderRadius:  4,
                    padding:      '1px 6px',
                    fontSize:      10,
                    color:        'var(--color-text)',
                    fontWeight:   600,
                  }}
                >
                  {formatReason(r)}
                </span>
              ))}
            </div>
          )}

          {/* Conflict summaries */}
          {item.conflicts_summary.map((cs, i) => (
            <div key={i} style={{ color: '#B8742A', fontSize: 11, fontFamily: 'monospace' }}>
              ⚡ {cs}
            </div>
          ))}

          {/* Source anchors */}
          {item.source_anchors.length > 0 && (
            <div style={{ marginTop: 1 }}>
              {item.source_anchors.slice(0, 3).map((a, i) => (
                <div key={i} style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>
                  ↳ {a.split(' | ').slice(0, 4).join(' › ')}
                </div>
              ))}
              {item.source_anchors.length > 3 && (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>
                  +{item.source_anchors.length - 3} więcej źródeł
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Bucket section (header + items) ──────────────────────────────────────────

function BucketSection({ bucket, items }: { bucket: string; items: ReviewQueueItem[] }) {
  if (items.length === 0) return null
  const st = BUCKET[bucket] ?? BUCKET.needs_review

  return (
    <div style={{ display: 'grid', gap: 5 }}>
      {/* Section header */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:           6,
          paddingBottom: 4,
          borderBottom: `2px solid ${st.border}`,
        }}
      >
        <span style={{ fontSize: 11 }}>{st.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 11, color: st.dot, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {st.label}
        </span>
        <span
          style={{
            marginLeft:   'auto',
            background:    st.border,
            color:         st.dot,
            borderRadius:  10,
            padding:       '0 7px',
            fontSize:       10,
            fontWeight:     700,
          }}
        >
          {items.length}
        </span>
      </div>

      {/* Items */}
      <div style={{ display: 'grid', gap: 5 }}>
        {items.map(item => (
          <ReviewItemRow
            key={item.candidate_id}
            item={item}
            defaultExpanded={bucket === 'blocked'}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function FusionReviewQueuePanel({ queue, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
        Ładowanie kolejki review…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--color-error-soft)', border: '1px solid #FECACA', fontSize: 12, color: '#A83228' }}>
        Błąd fusion review: {error.message}
      </div>
    )
  }

  if (!queue) return null

  const { summary, items } = queue

  const grouped: Record<string, ReviewQueueItem[]> = { blocked: [], needs_review: [], ready: [] }
  for (const item of items) {
    ;(grouped[item.review_readiness] ??= []).push(item)
  }

  return (
    <div
      style={{
        display:      'grid',
        gap:           10,
        padding:      '12px 14px',
        borderRadius:  8,
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: 13 }}>
          Fusion Review
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {summary.total} kandydatów
        </span>
        {summary.blocked > 0 && (
          <span style={{ marginLeft: 'auto', background: '#FEE2E2', color: '#A83228', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
            ⛔ {summary.blocked}
          </span>
        )}
        {summary.needs_review > 0 && (
          <span style={{ background: 'var(--color-warning-soft)', color: '#B8742A', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
            ⚠ {summary.needs_review}
          </span>
        )}
        {summary.ready > 0 && (
          <span style={{ background: 'var(--color-success-soft)', color: '#1A5C32', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
            ✓ {summary.ready}
          </span>
        )}
      </div>

      {/* Bucket sections */}
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
          Brak kandydatów w bundlu.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <BucketSection bucket="blocked"      items={grouped.blocked}      />
          <BucketSection bucket="needs_review" items={grouped.needs_review} />
          <BucketSection bucket="ready"        items={grouped.ready}        />
        </div>
      )}
    </div>
  )
}
