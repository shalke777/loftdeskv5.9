import { useQuery } from '@tanstack/react-query'
import { Card } from '@/shared/ui/Card/Card'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { portalGetTimeline } from '@/features/portal/api/portal-project.api'
import type { ProjectTimelineEvent } from '@/features/portal/model/project-portal.types'

const EVENT_LABELS: Record<string, string> = {
  project_created:      'Projekt założony',
  project_status_changed: 'Zmiana statusu projektu',
  portal_activated:     'Portal klienta aktywowany',
  portal_revoked:       'Dostęp do portalu cofnięty',
  cost_approval_sent:   'Prośba o akceptację kosztu',
  cost_approved:        'Klient zaakceptował koszt',
  cost_rejected:        'Klient odrzucił koszt',
  cost_questioned:      'Klient ma pytanie do kosztu',
  message_sent:         'Nowa wiadomość od wykonawcy',
  client_replied:       'Klient odpowiedział',
  document_added:       'Dodano dokument',
  document_removed:     'Usunięto dokument',
  note_added:           'Dodano notatkę',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

function EventDot({ eventType }: { eventType: string }) {
  const approvalTypes = ['cost_approved', 'cost_rejected', 'cost_questioned']
  const isApproval    = approvalTypes.includes(eventType)
  const isMessage     = ['message_sent', 'client_replied'].includes(eventType)
  const isSystem      = ['portal_activated', 'project_created', 'project_status_changed'].includes(eventType)

  const color = isApproval ? '#22c55e' : isMessage ? '#4f46e5' : isSystem ? '#94a3b8' : '#f59e0b'

  return (
    <div
      style={{
        width:        10,
        height:       10,
        borderRadius: '50%',
        background:   color,
        flexShrink:   0,
        marginTop:    5,
      }}
    />
  )
}

function TimelineItem({ event }: { event: ProjectTimelineEvent }) {
  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: 20, position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <EventDot eventType={event.event_type} />
        <div style={{ width: 1, flex: 1, background: '#e2e8f0', marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 4 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: '#1a202c' }}>
          {event.title || EVENT_LABELS[event.event_type] || event.event_type}
        </div>
        {event.description && (
          <p style={{ fontSize: 13, color: '#718096', marginTop: 4, lineHeight: 1.5 }}>
            {event.description}
          </p>
        )}
        <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 6 }}>
          {formatDate(event.created_at)}
          {event.actor_name && (
            <span> · {event.actor_name}</span>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props {
  sessionId: string
}

export function PortalUpdatesTab({ sessionId }: Props) {
  const { data: events, isLoading } = useQuery({
    queryKey:      ['portal-timeline', sessionId],
    queryFn:       () => portalGetTimeline(sessionId),
    refetchInterval: 30_000,
    staleTime:     10_000,
  })

  if (isLoading) return <Spinner />

  const list = events ?? []

  if (list.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <p>Brak aktualizacji dla tego projektu.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <h3 style={{ marginBottom: 20 }}>Aktualizacje projektu</h3>
      <div>
        {list.map((event) => (
          <TimelineItem key={event.id} event={event} />
        ))}
      </div>
    </Card>
  )
}
