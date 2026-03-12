import { useState, useMemo }   from 'react'
import { useProjectTimeline }  from '@/features/projects/hooks/useProjectTimeline'
import { TimelineEventItem }   from './TimelineEventItem'
import { TimelineFilterBar }   from './TimelineFilterBar'
import {
  matchesFilter,
  getEventCategory,
  type TimelineFilterCategory,
} from '@/features/projects/lib/timelineMeta'

interface Props { projectId: string }

export function ProjectTimelineTab({ projectId }: Props) {
  const [filter, setFilter] = useState<TimelineFilterCategory>('all')
  const { data: events = [], isLoading, isError, refetch } = useProjectTimeline(projectId)

  // Counts per category for the filter bar
  const counts = useMemo<Partial<Record<TimelineFilterCategory, number>>>(() => {
    const result: Partial<Record<TimelineFilterCategory, number>> = { all: events.length }
    for (const ev of events) {
      const cat = getEventCategory(ev.event_type)
      if (cat !== 'all') result[cat] = (result[cat] ?? 0) + 1
    }
    return result
  }, [events])

  const visible = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => matchesFilter(e, filter))),
    [events, filter],
  )

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '32px 0', color: 'var(--color-text-muted, #6b7280)', fontSize: 14 }}>
        <span className="spinner" style={{ width: 16, height: 16 }} />
        Ładowanie osi czasu…
      </div>
    )
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger, #dc2626)', fontSize: 14 }}>
          Nie udało się pobrać osi czasu.
        </p>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13, marginTop: 8 }} onClick={() => refetch()}>
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  // ─── Empty state — no events at all ──────────────────────────────────────

  if (events.length === 0) {
    return (
      <div
        style={{
          textAlign:    'center',
          padding:      '48px 24px',
          border:       '2px dashed var(--color-border, #e5e7eb)',
          borderRadius: 10,
          color:        'var(--color-text-muted, #6b7280)',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🕒</div>
        <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 15 }}>Brak zdarzeń dla tego projektu</p>
        <p style={{ margin: 0, fontSize: 13 }}>
          Historia pojawi się tutaj gdy projekt będzie aktywny — wiadomości, koszty, akceptacje, portale.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '16px 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          Oś czasu projektu
          {events.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted, #6b7280)' }}>
              ({events.length} zdarzeń)
            </span>
          )}
        </h3>

        {/* Internal / client-shared legend */}
        <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
          <span style={{ padding: '2px 8px', borderRadius: 99, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>
            widoczne klientowi
          </span>
          <span style={{ padding: '2px 8px', borderRadius: 99, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
            wewnętrzne
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <TimelineFilterBar active={filter} counts={counts} onChange={setFilter} />

      {/* Empty filtered state */}
      {visible.length === 0 && (
        <div
          style={{
            textAlign:    'center',
            padding:      '32px 16px',
            color:        'var(--color-text-muted, #6b7280)',
            fontSize:     13,
          }}
        >
          Brak zdarzeń w tej kategorii.
        </div>
      )}

      {/* Events list */}
      {visible.length > 0 && (
        <div>
          {visible.map((event, idx) => (
            <TimelineEventItem
              key={event.id}
              event={event}
              isLast={idx === visible.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
