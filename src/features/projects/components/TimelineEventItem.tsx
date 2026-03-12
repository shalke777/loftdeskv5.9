import type { ProjectTimelineEvent } from '@/features/portal/model/project-portal.types'
import {
  getTimelineEventMeta,
  buildTimelineEventTitle,
  buildTimelineEventDescription,
  formatTimelineDate,
} from '@/features/projects/lib/timelineMeta'

interface Props {
  event:     ProjectTimelineEvent
  /** When true, the vertical connector line below the dot is hidden (last item) */
  isLast?:   boolean
  /** Compact view — hides description, actor, time */
  compact?:  boolean
}

export function TimelineEventItem({ event, isLast = false, compact = false }: Props) {
  const meta  = getTimelineEventMeta(event.event_type)
  const title = buildTimelineEventTitle(event)
  const desc  = compact ? null : buildTimelineEventDescription(event)

  return (
    <div
      style={{
        display:  'flex',
        gap:      12,
        position: 'relative',
        paddingBottom: isLast ? 0 : 20,
      }}
    >
      {/* ── Connector column ────────────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          flexShrink:     0,
          width:          24,
        }}
      >
        {/* Icon bubble */}
        <div
          style={{
            width:        28,
            height:       28,
            borderRadius: '50%',
            background:   meta.bgColor,
            border:       `2px solid ${meta.dotColor}`,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            fontSize:     13,
            lineHeight:   1,
            flexShrink:   0,
          }}
          title={meta.label}
        >
          {meta.icon}
        </div>

        {/* Vertical connector line */}
        {!isLast && (
          <div
            style={{
              width:      2,
              flex:       1,
              background: 'var(--color-border, #e5e7eb)',
              marginTop:  4,
            }}
          />
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
        {/* Title */}
        <p
          style={{
            margin:     0,
            fontSize:   14,
            fontWeight: 600,
            color:      'var(--color-text, #111827)',
            lineHeight: 1.4,
            wordBreak:  'break-word',
          }}
        >
          {meta.icon} {title}
        </p>

        {/* Description */}
        {desc && (
          <p
            style={{
              margin:     '4px 0 0',
              fontSize:   13,
              color:      'var(--color-text-muted, #6b7280)',
              lineHeight: 1.5,
            }}
          >
            {desc}
          </p>
        )}

        {/* Meta row: actor + date */}
        {!compact && (
          <div
            style={{
              display:    'flex',
              gap:        10,
              flexWrap:   'wrap',
              marginTop:  6,
              fontSize:   12,
              color:      'var(--color-text-muted, #94a3b8)',
            }}
          >
            {event.actor_name && (
              <span>
                {event.actor_type === 'client' ? '👤' : event.actor_type === 'system' ? '⚙️' : '🧑‍💼'}{' '}
                {event.actor_name}
              </span>
            )}
            <span>{formatTimelineDate(event.created_at)}</span>

            {/* Visibility badge — only shown to operator */}
            {event.visibility === 'client_shared' && (
              <span
                style={{
                  padding:      '1px 6px',
                  borderRadius: 99,
                  fontSize:     10,
                  background:   '#dbeafe',
                  color:        '#1d4ed8',
                  fontWeight:   600,
                }}
              >
                widoczne klientowi
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
