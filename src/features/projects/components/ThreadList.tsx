// =============================================================================
// ThreadList — lista wątków projektu / global inbox
// =============================================================================
// Przyjmuje tablicę wątków i wyświetla je jako listę.
// Reużywany w ProjectThreadsTab (jeden projekt) i ChatPage (global inbox).

import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { ProjectThread } from '@/features/portal/model/project-portal.types'
import type { InboxThread } from '@/features/projects/api/threads.api'

// ─── Pomocnicze ───────────────────────────────────────────────────────────────

function formatRelative(iso: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'przed chwilą'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} godz.`
  const d = Math.floor(h / 24)
  return `${d} dni`
}

const THREAD_TYPE_LABELS: Record<string, string> = {
  general:   'Ogólny',
  approvals: 'Akceptacje',
  documents: 'Dokumenty',
  payments:  'Płatności',
  technical: 'Techniczny',
  internal:  'Wewnętrzny',
}

const VISIBILITY_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  internal:      { label: 'Wewn.',  color: '#6b6456', bg: '#ede8df' },
  client_shared: { label: 'Klient', color: '#15803d', bg: '#dcfce7' },
  approval:      { label: 'Akcept.',color: '#b45309', bg: '#fef3c7' },
}

interface VisibilityChipProps {
  visibility: string
}

function VisibilityChip({ visibility }: VisibilityChipProps) {
  const cfg = VISIBILITY_CHIP[visibility] ?? VISIBILITY_CHIP.internal
  return (
    <span
      style={{
        fontSize:      10,
        padding:       '2px 7px',
        borderRadius:  20,
        background:    cfg.bg,
        color:         cfg.color,
        fontWeight:    600,
        letterSpacing: '0.02em',
        flexShrink:    0,
        whiteSpace:    'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}

// ─── ThreadListItem ───────────────────────────────────────────────────────────

interface ThreadListItemProps {
  thread:        ProjectThread | InboxThread
  active:        boolean
  showProject?:  boolean   // dla global inbox
  onClick:       () => void
  onDelete?:     (threadId: string) => void
}

export function ThreadListItem({ thread, active, showProject, onClick, onDelete }: ThreadListItemProps) {
  const unread      = thread.unread_count_operator
  const inboxThread = thread as InboxThread

  // ── Swipe-to-delete ──────────────────────────────────────────────────────
  // States: closed → swiping → (release) → openedDelete | closed
  //         openedDelete → (right swipe) → closed
  //         openedDelete → (click delete) → deleting → onDelete()
  type SwipeState = 'closed' | 'swiping' | 'openedDelete' | 'deleting'

  const [swipeX,     setSwipeX]     = useState(0)
  const [swipeState, setSwipeState] = useState<SwipeState>('closed')

  const swipeStateRef  = useRef<SwipeState>('closed')
  const swipeXRef      = useRef(0)
  const startXRef      = useRef(0)
  const startYRef      = useRef(0)
  const baseSwipeXRef  = useRef(0)   // swipeX at pointer-down (supports drag-from-open)
  const isHorizRef     = useRef(false)
  const movedRef       = useRef(false)

  const THRESHOLD = 60   // px — snap-open / snap-close threshold
  const OPEN_X    = 80   // px — snapped-open position (delete panel width)

  function syncState(s: SwipeState) {
    swipeStateRef.current = s
    setSwipeState(s)
  }

  function syncX(x: number) {
    swipeXRef.current = x
    setSwipeX(x)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (swipeStateRef.current === 'deleting') return
    startXRef.current     = e.clientX
    startYRef.current     = e.clientY
    baseSwipeXRef.current = swipeStateRef.current === 'openedDelete' ? OPEN_X : 0
    isHorizRef.current    = false
    movedRef.current      = false
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (swipeStateRef.current === 'deleting') return

    const rawDx = startXRef.current - e.clientX   // positive = swiped left
    const dy    = Math.abs(e.clientY - startYRef.current)

    if (!isHorizRef.current) {
      if (Math.abs(rawDx) < 5 && dy < 5) return
      if (dy > Math.abs(rawDx) * 1.1) return
      isHorizRef.current = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }

    // Current position = base (0 or OPEN_X) offset by drag delta, clamped [0, OPEN_X+overdrag]
    const effective = Math.max(0, Math.min(baseSwipeXRef.current + rawDx, OPEN_X + 20))
    movedRef.current = true
    syncX(effective)
    syncState(effective > 0 ? 'swiping' : 'closed')
  }

  function onPointerUp() {
    if (!isHorizRef.current) return
    if (swipeStateRef.current === 'deleting') return

    const x = swipeXRef.current
    if (x >= THRESHOLD) {
      // Snap open — stay in openedDelete, wait for explicit tap to delete
      syncX(OPEN_X)
      syncState('openedDelete')
    } else {
      // Snap closed
      syncX(0)
      syncState('closed')
    }
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (swipeStateRef.current !== 'openedDelete') return
    syncState('deleting')
    setTimeout(() => {
      onDelete?.(thread.id)
    }, 250)
  }

  function handleClick() {
    if (swipeStateRef.current === 'openedDelete') {
      // Tap on foreground while open → close without deleting
      syncX(0)
      syncState('closed')
      return
    }
    if (!movedRef.current) onClick()
  }

  const rowClass = [
    'chat-swipe-row',
    swipeState === 'swiping'      ? 'chat-swipe-row--swiping'  : '',
    swipeState === 'openedDelete' ? 'chat-swipe-row--opened'   : '',
    swipeState === 'deleting'     ? 'chat-swipe-row--deleting' : '',
  ].filter(Boolean).join(' ')

  const tintOpacity = swipeX > 0 ? Math.min(swipeX / OPEN_X, 1) * 0.14 : 0

  return (
    <div className={rowClass}>
      {/* Red delete panel revealed behind — clickable only when open */}
      <div
        className="chat-swipe-delete-bg"
        style={{ pointerEvents: swipeState === 'openedDelete' ? 'auto' : 'none', cursor: 'pointer' }}
        onClick={handleDeleteClick}
      >
        <Trash2 size={16} />
        <span>{swipeState === 'deleting' ? 'Usuwanie…' : 'Usuń'}</span>
      </div>

      {/* Sliding foreground item */}
      <div
        className={[
          'chat-conv-item-wrap',
          'chat-swipe-item',
          swipeState === 'swiping' ? 'chat-swipe-item--dragging' : '',
        ].filter(Boolean).join(' ')}
        style={{ transform: `translateX(-${swipeX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleClick}
      >
        {/* Proportional red tint — opacity grows as swipe progresses */}
        <div
          className="chat-swipe-item__tint"
          style={{ opacity: tintOpacity }}
          aria-hidden
        />

        <button
          className={[
            'chat-conv-item',
            active     ? 'chat-conv-item--active' : '',
            unread > 0 ? 'chat-conv-item--unread' : '',
          ].filter(Boolean).join(' ')}
          style={{ width: '100%', textAlign: 'left', pointerEvents: 'none' }}
          tabIndex={-1}
        >
          {/* Avatar / ikona wątku */}
          <div className="chat-conv-item__avatar">
            {THREAD_TYPE_LABELS[thread.type]?.[0] ?? '?'}
          </div>

          <div className="chat-conv-item__body">
            <div className="chat-conv-item__header">
              <span className="chat-conv-item__name">
                {thread.title ?? THREAD_TYPE_LABELS[thread.type] ?? thread.type}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <VisibilityChip visibility={thread.visibility} />
                <span className="chat-conv-item__time">
                  {formatRelative(thread.last_message_at)}
                </span>
              </div>
            </div>

            {/* Projekt — tylko w global inbox */}
            {showProject && inboxThread.project_name && (
              <div className="chat-conv-item__project" style={{ marginBottom: 2 }}>
                📁 {inboxThread.project_number ? `${inboxThread.project_number} · ` : ''}{inboxThread.project_name}
              </div>
            )}

            {/* Typ wątku + preview */}
            <div className="chat-conv-item__preview">
              {thread.last_message_sender === 'client' && (
                <span className="chat-conv-item__from-client">Klient: </span>
              )}
              {thread.last_message_preview ?? (
                <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Brak wiadomości</span>
              )}
            </div>
          </div>

          {/* Unread badge */}
          {unread > 0 && (
            <span className="chat-conv-item__badge">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── ThreadList ───────────────────────────────────────────────────────────────

interface ThreadListProps {
  threads:       (ProjectThread | InboxThread)[]
  activeId:      string | null
  showProject?:  boolean
  emptyLabel?:   string
  onSelect:      (thread: ProjectThread | InboxThread) => void
  onDelete?:     (threadId: string) => void
}

export function ThreadList({
  threads,
  activeId,
  showProject,
  emptyLabel = 'Brak wątków',
  onSelect,
  onDelete,
}: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="chat-sidebar__empty">
        <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
        <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{emptyLabel}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12 }}>Wątki tworzone są w widoku projektu</p>
      </div>
    )
  }

  return (
    <div className="chat-sidebar__list">
      {threads.map(thread => (
        <ThreadListItem
          key={thread.id}
          thread={thread}
          active={thread.id === activeId}
          showProject={showProject}
          onClick={() => onSelect(thread)}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
