import { usePortalTimeline }         from '@/features/portal/hooks/usePortalTimeline'
import { Card }                      from '@/shared/ui/Card/Card'
import { Spinner }                   from '@/shared/ui/Spinner/Spinner'
import {
  getTimelineEventMeta,
  buildTimelineEventTitle,
  formatTimelineDate,
} from '@/features/projects/lib/timelineMeta'
import type { ProjectTimelineEvent } from '@/features/portal/model/project-portal.types'

function PortalTimelineItem({ event, isLast }: { event: ProjectTimelineEvent; isLast: boolean }) {
  const meta  = getTimelineEventMeta(event.event_type)
  const title = buildTimelineEventTitle(event)

  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 24, position: 'relative' }}>
      {/* Icon + line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: meta.bgColor, border: `2px solid ${meta.dotColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, lineHeight: 1, flexShrink: 0,
          }}
        >
          {meta.icon}
        </div>
        {!isLast && (
          <div style={{ width: 2, flex: 1, background: '#e2e8f0', marginTop: 4 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingTop: 4, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: '#1a202c', lineHeight: 1.4 }}>
          {title}
        </p>
        {event.description && (
          <p style={{ fontSize: 13, color: '#718096', marginTop: 4, lineHeight: 1.5 }}>
            {event.description}
          </p>
        )}
        <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 6 }}>
          {formatTimelineDate(event.created_at)}
          {event.actor_name && <span> · {event.actor_name}</span>}
        </p>
      </div>
    </div>
  )
}

interface Props {
  sessionId: string
}

export function PortalUpdatesTab({ sessionId }: Props) {
  const { data: events, isLoading } = usePortalTimeline(sessionId)

  if (isLoading) return <Spinner />

  const list = events ?? []

  if (list.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 600 }}>Brak aktualizacji dla tego projektu.</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Aktualizacje pojawią się tutaj gdy pojawią się wiadomości, akceptacje lub dokumenty.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>Aktualizacje projektu</h3>
      <div>
        {list.map((event, idx) => (
          <PortalTimelineItem key={event.id} event={event} isLast={idx === list.length - 1} />
        ))}
      </div>
    </Card>
  )
}
