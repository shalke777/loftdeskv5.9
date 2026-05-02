// =============================================================================
// WorkspaceActivityStream — right fixed panel in Project Workspace
// Live messages · Pending approvals · Recent timeline events
// =============================================================================

import { MessageSquare, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { useThreads } from '@/features/projects/hooks/useThreads'
import { useProjectTimeline } from '@/features/projects/hooks/useProjectTimeline'
import { useCostApprovals } from '@/features/expenses/hooks/useCostApprovals'
import { getTimelineEventMeta } from '@/features/projects/lib/timelineMeta'

type StreamFilter = 'all' | 'messages' | 'approvals'

// ─── Latest messages (from threads) ─────────────────────────────────────────

function StreamMessages({ projectId, onOpenThreads }: { projectId: string; onOpenThreads: () => void }) {
  const { data: threads = [] } = useThreads(projectId)

  // Flatten last message across all threads
  const recentMsgs = threads
    .filter(t => t.last_message_at)
    .sort((a, b) => {
      const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return bt - at
    })
    .slice(0, 4)

  if (recentMsgs.length === 0) {
    return (
      <div className="ws-stream-section">
        <div className="ws-stream-section-hd"><MessageSquare size={13} />Wiadomości</div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 0' }}>Brak wiadomości</p>
      </div>
    )
  }

  return (
    <div className="ws-stream-section">
      <div className="ws-stream-section-hd"><MessageSquare size={13} />Wiadomości</div>
      {recentMsgs.map(thread => (
        <div key={thread.id} className="ws-stream-msg">
          <div className="ws-avatar-xs">{(thread.title ?? '?').charAt(0).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.title}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.last_message_preview ?? ''}</div>
          </div>
        </div>
      ))}
      <button className="ws-stream-link" onClick={onOpenThreads}>
        Otwórz czat <ChevronRight size={11} />
      </button>
    </div>
  )
}

// ─── Pending approvals ───────────────────────────────────────────────────────

function StreamApprovals({ projectId, onOpenApprovals }: { projectId: string; onOpenApprovals: () => void }) {
  const { data: approvals = [] } = useCostApprovals(projectId)
  const pending = approvals.filter(a => a.status === 'pending_client')

  if (pending.length === 0) return null

  return (
    <div className="ws-stream-section ws-stream-section--warning">
      <div className="ws-stream-section-hd"><CheckCircle2 size={13} />Oczekuje na akceptację</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {pending.slice(0, 3).map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{a.snapshot_description ?? a.snapshot_vendor ?? 'Pozycja kosztowa'}</span>
            <span style={{ color: 'var(--color-accent)', fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>
              {a.snapshot_amount_gross != null ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(Number(a.snapshot_amount_gross)) : '—'}
            </span>
          </div>
        ))}
        {pending.length > 3 && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{pending.length - 3} więcej</div>}
      </div>
      <button className="ws-stream-link" onClick={onOpenApprovals}>
        Zarządzaj <ChevronRight size={11} />
      </button>
    </div>
  )
}

// ─── Timeline events ─────────────────────────────────────────────────────────

function StreamTimeline({ projectId, onOpenTimeline }: { projectId: string; onOpenTimeline: () => void }) {
  const { data: events = [] } = useProjectTimeline(projectId)
  const recent = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8)

  function relTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'Przed chwilą'
    if (m < 60) return `${m} min temu`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} godz. temu`
    const d = Math.floor(h / 24)
    return `${d} dni temu`
  }

  return (
    <div className="ws-stream-section">
      <div className="ws-stream-section-hd"><Clock size={13} />Aktywność</div>
      {recent.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 0' }}>Brak zdarzeń</p>
      )}
      <div className="ws-timeline-feed">
        {recent.map((ev, i) => {
          const meta = getTimelineEventMeta(ev.event_type)
          return (
            <div key={ev.id} className="ws-timeline-item">
              <div className="ws-timeline-dot" style={{ background: meta?.dotColor ?? 'var(--color-brand)' }} />
              {i < recent.length - 1 && <div className="ws-timeline-line" />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title ?? meta?.label ?? ev.event_type}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{relTime(ev.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>
      {events.length > 8 && (
        <button className="ws-stream-link" onClick={onOpenTimeline}>
          Pełna oś czasu <ChevronRight size={11} />
        </button>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  onOpenThreads:   () => void
  onOpenApprovals: () => void
  onOpenTimeline:  () => void
}

export function WorkspaceActivityStream({ projectId, onOpenThreads, onOpenApprovals, onOpenTimeline }: Props) {
  return (
    <aside className="ws-right-stream">
      <div className="ws-stream-header">
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Aktywność</span>
      </div>
      <StreamApprovals projectId={projectId} onOpenApprovals={onOpenApprovals} />
      <StreamMessages  projectId={projectId} onOpenThreads={onOpenThreads}  />
      <StreamTimeline  projectId={projectId} onOpenTimeline={onOpenTimeline} />
    </aside>
  )
}
