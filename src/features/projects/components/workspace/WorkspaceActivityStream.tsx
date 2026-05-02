// =============================================================================
// WorkspaceActivityStream — right fixed panel in Project Workspace
// Live messages · Pending approvals · Recent timeline events
//
// Data layer: all three sources are merged via useProjectEventStream.
// The hook returns a single sorted array; this component filters by type
// to populate the three dedicated sections. UI is unchanged from before.
// =============================================================================

import { MessageSquare, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { getTimelineEventMeta } from '@/features/projects/lib/timelineMeta'
import {
  useProjectEventStream,
  asThread,
  asApproval,
  asTimelineEvent,
} from '@/features/projects/hooks/useProjectEventStream'
import type { ProjectStreamEvent } from '@/features/projects/hooks/useProjectEventStream'

// ─── Relative time helper (shared across all sections) ───────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Przed chwilą'
  if (m < 60) return `${m} min temu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} godz. temu`
  const d = Math.floor(h / 24)
  return `${d} dni temu`
}

// ─── Latest messages section (ProjectThread events from unified stream) ──────

interface MessagesProps { events: ProjectStreamEvent[]; onOpenThreads: () => void }

function StreamMessages({ events, onOpenThreads }: MessagesProps) {
  const recentMsgs = events
    .filter(ev => ev.type === 'message')
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
      {recentMsgs.map(ev => {
        const thread = asThread(ev)
        return (
          <div key={ev.id} className="ws-stream-msg">
            <div className="ws-avatar-xs">{(thread.title ?? '?').charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.last_message_preview ?? ''}</div>
            </div>
          </div>
        )
      })}
      <button className="ws-stream-link" onClick={onOpenThreads}>
        Otwórz czat <ChevronRight size={11} />
      </button>
    </div>
  )
}

// ─── Pending approvals section ───────────────────────────────────────────────

interface ApprovalsProps { events: ProjectStreamEvent[]; onOpenApprovals: () => void }

function StreamApprovals({ events, onOpenApprovals }: ApprovalsProps) {
  const pending = events
    .filter(ev => ev.type === 'approval' && asApproval(ev).status === 'pending_client')

  if (pending.length === 0) return null

  return (
    <div className="ws-stream-section ws-stream-section--warning">
      <div className="ws-stream-section-hd"><CheckCircle2 size={13} />Oczekuje na akceptację</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {pending.slice(0, 3).map(ev => {
          const a = asApproval(ev)
          return (
            <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{a.snapshot_description ?? a.snapshot_vendor ?? 'Pozycja kosztowa'}</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>
                {a.snapshot_amount_gross != null ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(Number(a.snapshot_amount_gross)) : '—'}
              </span>
            </div>
          )
        })}
        {pending.length > 3 && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{pending.length - 3} więcej</div>}
      </div>
      <button className="ws-stream-link" onClick={onOpenApprovals}>
        Zarządzaj <ChevronRight size={11} />
      </button>
    </div>
  )
}

// ─── Timeline events section ─────────────────────────────────────────────────

interface TimelineProps { events: ProjectStreamEvent[]; totalTimelineCount: number; onOpenTimeline: () => void }

function StreamTimeline({ events, totalTimelineCount, onOpenTimeline }: TimelineProps) {
  const recent = events
    .filter(ev => ev.type === 'timeline')
    .slice(0, 8)

  return (
    <div className="ws-stream-section">
      <div className="ws-stream-section-hd"><Clock size={13} />Aktywność</div>
      {recent.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 0' }}>Brak zdarzeń</p>
      )}
      <div className="ws-timeline-feed">
        {recent.map((ev, i) => {
          const te   = asTimelineEvent(ev)
          const meta = getTimelineEventMeta(te.event_type)
          return (
            <div key={ev.id} className="ws-timeline-item">
              <div className="ws-timeline-dot" style={{ background: meta?.dotColor ?? 'var(--color-brand)' }} />
              {i < recent.length - 1 && <div className="ws-timeline-line" />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{te.title ?? meta?.label ?? te.event_type}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{relTime(ev.createdAt)}</div>
              </div>
            </div>
          )
        })}
      </div>
      {totalTimelineCount > 8 && (
        <button className="ws-stream-link" onClick={onOpenTimeline}>
          Pełna oś czasu <ChevronRight size={11} />
        </button>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface Props {
  projectId:       string
  onOpenThreads:   () => void
  onOpenApprovals: () => void
  onOpenTimeline:  () => void
}

export function WorkspaceActivityStream({ projectId, onOpenThreads, onOpenApprovals, onOpenTimeline }: Props) {
  const { events } = useProjectEventStream(projectId)

  const timelineCount = events.filter(ev => ev.type === 'timeline').length

  return (
    <aside className="ws-right-stream">
      <div className="ws-stream-header">
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Aktywność</span>
      </div>
      <StreamApprovals events={events} onOpenApprovals={onOpenApprovals} />
      <StreamMessages  events={events} onOpenThreads={onOpenThreads}  />
      <StreamTimeline  events={events} totalTimelineCount={timelineCount} onOpenTimeline={onOpenTimeline} />
    </aside>
  )
}
