// =============================================================================
// WorkspaceActivityStream — right fixed panel in Project Workspace
// Live messages · Pending approvals · Recent timeline events
//
// Data layer: all three sources are merged via useProjectEventStream.
// The hook returns a single sorted array; this component filters by type
// to populate the three dedicated sections.
//
// Phase 3C — causal hover visualization:
//   · Each event row carries data-stream-id for DOM targeting
//   · ↳ indicator rendered inline when event.causedBy is set
//   · Hover highlights the cause event via direct classList toggle (no re-render)
//   · All logic scoped to the <aside> containerRef
//
// Phase 3D — cluster-aware click highlighting:
//   · Click computes getEventChain + getRelatedEvents (pure util, no fetch)
//   · Chain events → .ws-chain-highlight (primary)
//   · Related events → .ws-related-highlight (secondary)
//   · Selection stored in ref only — zero React state changes on click
//   · Click same event again → clears selection
// =============================================================================

import { useRef, useCallback } from 'react'
import { MessageSquare, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { getTimelineEventMeta } from '@/features/projects/lib/timelineMeta'
import { getEventChain, getRelatedEvents } from '@/features/projects/lib/eventChain'
import {
  useProjectEventStream,
  asThread,
  asApproval,
  asTimelineEvent,
} from '@/features/projects/hooks/useProjectEventStream'
import type { ProjectStreamEvent, StreamEventType } from '@/features/projects/hooks/useProjectEventStream'

// ─── DOM helpers ──────────────────────────────────────────────────────────────

const TYPE_PREFIX: Record<StreamEventType, string> = {
  timeline: 'tl',
  message:  'msg',
  approval: 'ap',
}

function causedByDomId(ev: ProjectStreamEvent): string | undefined {
  if (!ev.causedBy) return undefined
  return `${TYPE_PREFIX[ev.causedBy.type]}:${ev.causedBy.id}`
}

// Hover highlight (Phase 3C)
const HOVER_CLASS   = 'ws-stream-item--highlighted'
// Cluster click highlights (Phase 3D)
const CHAIN_CLASS   = 'ws-chain-highlight'
const RELATED_CLASS = 'ws-related-highlight'

function applyHighlight(container: HTMLElement | null, domId: string | undefined, add: boolean) {
  if (!container || !domId) return
  container.querySelector(`[data-stream-id="${CSS.escape(domId)}"]`)?.classList.toggle(HOVER_CLASS, add)
}

function clearClusterHighlights(container: HTMLElement) {
  container.querySelectorAll(`.${CHAIN_CLASS}, .${RELATED_CLASS}`).forEach(el => {
    el.classList.remove(CHAIN_CLASS, RELATED_CLASS)
  })
}

// ─── Causal badge ─────────────────────────────────────────────────────────────

function CausalBadge() {
  return (
    <span className="ws-causal-badge" aria-label="powiązane zdarzenie" title="To zdarzenie jest powiązane z innym">
      ↳
    </span>
  )
}

// ─── Relative time helper ─────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Przed chwilą'
  if (m < 60) return `${m} min temu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} godz. temu`
  return `${Math.floor(h / 24)} dni temu`
}

// ─── Section: messages ────────────────────────────────────────────────────────

interface MessagesProps {
  events:        ProjectStreamEvent[]
  containerRef:  React.RefObject<HTMLElement | null>
  onEventClick:  (id: string) => void
  onOpenThreads: () => void
}

function StreamMessages({ events, containerRef, onEventClick, onOpenThreads }: MessagesProps) {
  const recentMsgs = events.filter(ev => ev.type === 'message').slice(0, 4)

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
        const thread  = asThread(ev)
        const causeId = causedByDomId(ev)
        return (
          <div
            key={ev.id}
            className="ws-stream-msg ws-stream-clickable"
            data-stream-id={ev.id}
            onClick={() => onEventClick(ev.id)}
            onMouseEnter={causeId ? () => applyHighlight(containerRef.current, causeId, true)  : undefined}
            onMouseLeave={causeId ? () => applyHighlight(containerRef.current, causeId, false) : undefined}
          >
            <div className="ws-avatar-xs">{(thread.title ?? '?').charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {causeId && <CausalBadge />}
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.title}</span>
              </div>
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

// ─── Section: approvals ───────────────────────────────────────────────────────

interface ApprovalsProps {
  events:          ProjectStreamEvent[]
  containerRef:    React.RefObject<HTMLElement | null>
  onEventClick:    (id: string) => void
  onOpenApprovals: () => void
}

function StreamApprovals({ events, containerRef, onEventClick, onOpenApprovals }: ApprovalsProps) {
  const pending = events.filter(ev => ev.type === 'approval' && asApproval(ev).status === 'pending_client')

  if (pending.length === 0) return null

  return (
    <div className="ws-stream-section ws-stream-section--warning">
      <div className="ws-stream-section-hd"><CheckCircle2 size={13} />Oczekuje na akceptację</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {pending.slice(0, 3).map(ev => {
          const a       = asApproval(ev)
          const causeId = causedByDomId(ev)
          return (
            <div
              key={ev.id}
              className="ws-stream-clickable"
              data-stream-id={ev.id}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}
              onClick={() => onEventClick(ev.id)}
              onMouseEnter={causeId ? () => applyHighlight(containerRef.current, causeId, true)  : undefined}
              onMouseLeave={causeId ? () => applyHighlight(containerRef.current, causeId, false) : undefined}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {causeId && <CausalBadge />}
                {a.snapshot_description ?? a.snapshot_vendor ?? 'Pozycja kosztowa'}
              </span>
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

// ─── Section: timeline ────────────────────────────────────────────────────────

interface TimelineProps {
  events:             ProjectStreamEvent[]
  containerRef:       React.RefObject<HTMLElement | null>
  onEventClick:       (id: string) => void
  totalTimelineCount: number
  onOpenTimeline:     () => void
}

function StreamTimeline({ events, containerRef, onEventClick, totalTimelineCount, onOpenTimeline }: TimelineProps) {
  const recent = events.filter(ev => ev.type === 'timeline').slice(0, 8)

  return (
    <div className="ws-stream-section">
      <div className="ws-stream-section-hd"><Clock size={13} />Aktywność</div>
      {recent.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 0' }}>Brak zdarzeń</p>
      )}
      <div className="ws-timeline-feed">
        {recent.map((ev, i) => {
          const te      = asTimelineEvent(ev)
          const meta    = getTimelineEventMeta(te.event_type)
          const causeId = causedByDomId(ev)
          return (
            <div
              key={ev.id}
              className="ws-timeline-item ws-stream-clickable"
              data-stream-id={ev.id}
              onClick={() => onEventClick(ev.id)}
              onMouseEnter={causeId ? () => applyHighlight(containerRef.current, causeId, true)  : undefined}
              onMouseLeave={causeId ? () => applyHighlight(containerRef.current, causeId, false) : undefined}
            >
              <div className="ws-timeline-dot" style={{ background: meta?.dotColor ?? 'var(--color-brand)' }} />
              {i < recent.length - 1 && <div className="ws-timeline-line" />}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {causeId && <CausalBadge />}
                  <span style={{ fontSize: 12, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{te.title ?? meta?.label ?? te.event_type}</span>
                </div>
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
  const containerRef  = useRef<HTMLElement>(null)
  const selectedRef   = useRef<string | null>(null)
  // Always-fresh events ref — avoids stale closure without useCallback deps
  const eventsRef     = useRef(events)
  eventsRef.current   = events

  // Stable click handler — reads eventsRef.current so never stale
  const handleEventClick = useCallback((clickedId: string) => {
    const container = containerRef.current
    if (!container) return

    // Clear any existing cluster highlights
    clearClusterHighlights(container)

    // Toggle: clicking the same event again deselects
    if (selectedRef.current === clickedId) {
      selectedRef.current = null
      return
    }
    selectedRef.current = clickedId

    const evs      = eventsRef.current
    const chain    = getEventChain(clickedId, evs)
    const related  = getRelatedEvents(clickedId, evs)
    const chainIds = new Set(chain.map(e => e.id))

    for (const ev of chain) {
      container.querySelector(`[data-stream-id="${CSS.escape(ev.id)}"]`)?.classList.add(CHAIN_CLASS)
    }
    for (const ev of related) {
      // Related-only (not already in chain) get the secondary class
      if (!chainIds.has(ev.id)) {
        container.querySelector(`[data-stream-id="${CSS.escape(ev.id)}"]`)?.classList.add(RELATED_CLASS)
      }
    }
  }, []) // empty deps — intentional, reads via refs

  const timelineCount = events.filter(ev => ev.type === 'timeline').length

  return (
    <aside className="ws-right-stream" ref={containerRef}>
      <div className="ws-stream-header">
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Aktywność</span>
      </div>
      <StreamApprovals events={events} containerRef={containerRef} onEventClick={handleEventClick} onOpenApprovals={onOpenApprovals} />
      <StreamMessages  events={events} containerRef={containerRef} onEventClick={handleEventClick} onOpenThreads={onOpenThreads}  />
      <StreamTimeline  events={events} containerRef={containerRef} onEventClick={handleEventClick} totalTimelineCount={timelineCount} onOpenTimeline={onOpenTimeline} />
    </aside>
  )
}
