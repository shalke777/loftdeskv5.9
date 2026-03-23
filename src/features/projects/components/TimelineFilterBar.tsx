import type { TimelineFilterCategory } from '@/features/projects/lib/timelineMeta'
import { FILTER_LABELS }               from '@/features/projects/lib/timelineMeta'

interface Props {
  active:   TimelineFilterCategory
  counts:   Partial<Record<TimelineFilterCategory, number>>
  onChange: (f: TimelineFilterCategory) => void
}

const FILTER_ORDER: TimelineFilterCategory[] = [
  'all',
  'communication',
  'costs',
  'approvals',
  'portal',
]

export function TimelineFilterBar({ active, counts, onChange }: Props) {
  return (
    <div
      role="tablist"
      style={{
        display:    'flex',
        gap:        2,
        flexWrap:   'wrap',
        borderBottom: '1px solid var(--color-border, #3A3D42)',
        paddingBottom: 0,
        marginBottom: 16,
      }}
    >
      {FILTER_ORDER.map((key) => {
        const count   = counts[key] ?? 0
        const isActive = key === active
        // Hide category tabs that have 0 items (except 'all' which always shows)
        if (key !== 'all' && count === 0) return null

        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(key)}
            style={{
              padding:      '8px 14px',
              border:       'none',
              background:   'transparent',
              fontWeight:   isActive ? 700 : 400,
              fontSize:     13,
              color:        isActive
                ? 'var(--color-brand, #4f46e5)'
                : 'var(--color-text-secondary, #A7ABB3)',
              borderBottom: isActive
                ? '2px solid var(--color-brand, #4f46e5)'
                : '2px solid transparent',
              cursor:       'pointer',
              marginBottom: -1,
              whiteSpace:   'nowrap',
            }}
          >
            {FILTER_LABELS[key]}
            {count > 0 && key !== 'all' && (
              <span
                style={{
                  marginLeft:   5,
                  fontSize:     11,
                  opacity:      0.7,
                  fontWeight:   400,
                }}
              >
                ({count})
              </span>
            )}
            {key === 'all' && counts.all != null && (
              <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.7 }}>
                ({counts.all})
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
