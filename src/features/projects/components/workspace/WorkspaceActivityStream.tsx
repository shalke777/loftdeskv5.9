// =============================================================================
// WorkspaceActivityStream — right fixed panel in Project Workspace
// Live messages · Pending approvals · Recent timeline events
//
// Phase 3C — causal hover: ↳ badge + highlighted causedBy target
// Phase 3D — cluster click: chain + related CSS highlighting
// Phase 3E — Figma Dev Mode overlay:
//   · SVG line overlay connecting chain / related events
//   · Hover dims non-cluster events + shows relational tooltip
//   · All interaction via DOM refs — zero React state / re-renders
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

// ─── CSS class constants ──────────────────────────────────────────────────────

const CHAIN_CLASS   = 'ws-chain-highlight'
const RELATED_CLASS = 'ws-related-highlight'
const HOVERED_CLASS = 'ws-stream-item--hovered'
const DIMMED_CLASS  = 'ws-stream-item--dimmed'

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

function getItemEl(container: HTMLElement, streamId: string): Element | null {
  return container.querySelector(`[data-stream-id="${CSS.escape(streamId)}"]`)
}

function getAllItemEls(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll('[data-stream-id]')
}

function clearClusterHighlights(container: HTMLElement) {
  container.querySelectorAll(`.${CHAIN_CLASS},.${RELATED_CLASS}`)
    .forEach(el => el.classList.remove(CHAIN_CLASS, RELATED_CLASS))
}

// ─── SVG overlay engine ───────────────────────────────────────────────────────

/**
 * Returns the center of a stream-item node in ws-graph-root coordinate space.
 * getBoundingClientRect subtraction is scroll-independent: both rects share
 * the same scroll offset, so the difference is always relative to the container.
 */
function getNodeCenter(
  container: HTMLElement,
  streamId: string,
): { x: number; y: number } | null {
  const el = getItemEl(container, streamId)
  if (!el) return null
  const er = el.getBoundingClientRect()
  const cr = container.getBoundingClientRect()
  return { x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 }
}

function renderSvgLines(
  svg:        SVGSVGElement,
  container:  HTMLElement,
  selectedId: string,
  chain:      ProjectStreamEvent[],
  related:    ProjectStreamEvent[],
  chainIds:   Set<string>,
) {
  // Size SVG to cover the full content height (not just viewport)
  svg.setAttribute('width',  String(container.offsetWidth))
  svg.setAttribute('height', String(container.scrollHeight))

  const from = getNodeCenter(container, selectedId)
  if (!from) { svg.innerHTML = ''; return }

  const parts: string[] = []

  for (const ev of chain) {
    if (ev.id === selectedId) continue
    const to = getNodeCenter(container, ev.id)
    if (!to) continue
    parts.push(
      `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" ` +
      `x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}" ` +
      `stroke="#1a5c32" stroke-width="2" stroke-opacity="0.75" stroke-linecap="round"/>`,
    )
  }

  for (const ev of related) {
    if (chainIds.has(ev.id)) continue
    const to = getNodeCenter(container, ev.id)
    if (!to) continue
    parts.push(
      `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" ` +
      `x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}" ` +
      `stroke="rgba(26,92,50,0.25)" stroke-width="1" stroke-dasharray="3 3" stroke-linecap="round"/>`,
    )
  }

  svg.innerHTML = parts.join('')
}

function clearSvg(svg: SVGSVGElement) {
  svg.innerHTML = ''
}

// ─── Tooltip engine ───────────────────────────────────────────────────────────

const TYPE_LABEL: Record<StreamEventType, string> = {
  timeline: 'Zdarzenie',
  message:  'Wiadomość',
  approval: 'Akceptacja',
}

function showTooltip(
  tooltip:      HTMLDivElement,
  container:    HTMLElement,
  ev:           ProjectStreamEvent,
  chainDepth:   number,
  relatedCount: number,
) {
  const el = getItemEl(container, ev.id)
  if (!el) return

  const er      = el.getBoundingClientRect()
  const cr      = container.getBoundingClientRect()
  const relTop  = Math.max(4, er.top - cr.top)

  const causeRow = ev.causedBy
    ? `<div class="ws-gtt-cause">↳&nbsp;${TYPE_LABEL[ev.causedBy.type]}</div>`
    : ''

  tooltip.innerHTML =
    `<div class="ws-gtt-type">${TYPE_LABEL[ev.type]}</div>` +
    causeRow +
    `<div class="ws-gtt-row"><span>Łańcuch</span><b>${chainDepth}</b></div>` +
    `<div class="ws-gtt-row"><span>Powiązane</span><b>${relatedCount}</b></div>`

  // Pin to left edge of container at element's vertical midpoint
  tooltip.style.top     = `${relTop}px`
  tooltip.style.left    = '4px'
  tooltip.style.display = 'block'
}

function hideTooltip(tooltip: HTMLDivElement) {
  tooltip.style.display = 'none'
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

// ─── Section interaction interface ───────────────────────────────────────────

interface SectionInteraction {
  onEventHover:    (id: string) => void
  onEventHoverEnd: (id: string) => void
  onEventClick:    (id: string) => void
}

// ─── Section: messages ────────────────────────────────────────────────────────

interface MessagesProps extends SectionInteraction {
  events:        ProjectStreamEvent[]
  onOpenThreads: () => void
}

function StreamMessages({ events, onEventHover, onEventHoverEnd, onEventClick, onOpenThreads }: MessagesProps) {
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
            onMouseEnter={() => onEventHover(ev.id)}
            onMouseLeave={() => onEventHoverEnd(ev.id)}
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

interface ApprovalsProps extends SectionInteraction {
  events:          ProjectStreamEvent[]
  onOpenApprovals: () => void
}

function StreamApprovals({ events, onEventHover, onEventHoverEnd, onEventClick, onOpenApprovals }: ApprovalsProps) {
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
              onMouseEnter={() => onEventHover(ev.id)}
              onMouseLeave={() => onEventHoverEnd(ev.id)}
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

interface TimelineProps extends SectionInteraction {
  events:             ProjectStreamEvent[]
  totalTimelineCount: number
  onOpenTimeline:     () => void
}

function StreamTimeline({ events, onEventHover, onEventHoverEnd, onEventClick, totalTimelineCount, onOpenTimeline }: TimelineProps) {
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
              onMouseEnter={() => onEventHover(ev.id)}
              onMouseLeave={() => onEventHoverEnd(ev.id)}
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

  // DOM refs — zero React state for all interaction
  const graphRootRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const tooltipRef   = useRef<HTMLDivElement>(null)
  const selectedRef  = useRef<string | null>(null)
  // Always-fresh events snapshot — avoids stale closures without re-creating callbacks
  const eventsRef    = useRef<ProjectStreamEvent[]>(events)
  eventsRef.current  = events

  // ─ Hover: dim non-cluster + SVG lines + tooltip ───────────────────────────

  const handleEventHover = useCallback((id: string) => {
    const container = graphRootRef.current
    const svg       = svgRef.current
    const tooltip   = tooltipRef.current
    if (!container) return

    const evs     = eventsRef.current
    const ev      = evs.find(e => e.id === id)
    if (!ev) return

    const chain    = getEventChain(id, evs)
    const related  = getRelatedEvents(id, evs)
    const chainIds = new Set(chain.map(e => e.id))

    // Ids that should NOT be dimmed (hovered + full cluster)
    const visibleIds = new Set([id, ...chain.map(e => e.id), ...related.map(e => e.id)])

    getAllItemEls(container).forEach(el => {
      const sid = el.getAttribute('data-stream-id') ?? ''
      if (sid === id) {
        el.classList.add(HOVERED_CLASS)
        el.classList.remove(DIMMED_CLASS)
      } else if (visibleIds.has(sid)) {
        el.classList.remove(HOVERED_CLASS, DIMMED_CLASS)
      } else {
        el.classList.add(DIMMED_CLASS)
        el.classList.remove(HOVERED_CLASS)
      }
    })

    if (svg) renderSvgLines(svg, container, id, chain, related, chainIds)

    if (tooltip) {
      const relatedOnlyCount = related.filter(e => !chainIds.has(e.id)).length
      showTooltip(tooltip, container, ev, chain.length, relatedOnlyCount)
    }
  }, [])

  const handleEventHoverEnd = useCallback((_id: string) => {
    const container = graphRootRef.current
    if (!container) return

    getAllItemEls(container).forEach(el => el.classList.remove(HOVERED_CLASS, DIMMED_CLASS))

    if (svgRef.current)    clearSvg(svgRef.current)
    if (tooltipRef.current) hideTooltip(tooltipRef.current)
  }, [])

  // ─ Click: persistent cluster selection ───────────────────────────────────

  const handleEventClick = useCallback((clickedId: string) => {
    const container = graphRootRef.current
    if (!container) return

    clearClusterHighlights(container)

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
      getItemEl(container, ev.id)?.classList.add(CHAIN_CLASS)
    }
    for (const ev of related) {
      if (!chainIds.has(ev.id)) {
        getItemEl(container, ev.id)?.classList.add(RELATED_CLASS)
      }
    }
  }, [])

  const timelineCount = events.filter(ev => ev.type === 'timeline').length

  return (
    <aside className="ws-right-stream">
      {/* ws-graph-root: position:relative context for SVG overlay + tooltip */}
      <div className="ws-graph-root" ref={graphRootRef}>
        {/* SVG line overlay — pointer-events:none, scrolls with content */}
        <svg className="ws-graph-svg" ref={svgRef} aria-hidden="true" />
        {/* Figma-style inspect tooltip — positioned by JS, hidden by default */}
        <div className="ws-graph-tooltip" ref={tooltipRef} style={{ display: 'none' }} aria-hidden="true" />

        <div className="ws-stream-header">
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Aktywność</span>
        </div>
        <StreamApprovals events={events} onEventHover={handleEventHover} onEventHoverEnd={handleEventHoverEnd} onEventClick={handleEventClick} onOpenApprovals={onOpenApprovals} />
        <StreamMessages  events={events} onEventHover={handleEventHover} onEventHoverEnd={handleEventHoverEnd} onEventClick={handleEventClick} onOpenThreads={onOpenThreads}  />
        <StreamTimeline  events={events} onEventHover={handleEventHover} onEventHoverEnd={handleEventHoverEnd} onEventClick={handleEventClick} totalTimelineCount={timelineCount} onOpenTimeline={onOpenTimeline} />
      </div>
    </aside>
  )
}
