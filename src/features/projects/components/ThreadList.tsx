// =============================================================================
// ThreadList — lista wątków projektu / global inbox
// =============================================================================
// Przyjmuje tablicę wątków i wyświetla je jako listę.
// Reużywany w ProjectThreadsTab (jeden projekt) i ChatPage (global inbox).

import { useEffect, useRef, useState } from 'react'
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
  type SwipeState = 'idle' | 'swiping' | 'armedToDelete' | 'deleting'

  const [swipeX,     setSwipeX]     = useState(0)
  const [swipeState, setSwipeState] = useState<SwipeState>('idle')

  // Refs to read current values inside event handlers without stale closures
  const swipeStateRef = useRef<SwipeState>('idle')
  const startXRef     = useRef(0)
  const startYRef     = useRef(0)
  const isHorizRef    = useRef(false)  // confirmed horizontal gesture
  const movedRef      = useRef(false)
  const ARMED_THRESHOLD = 80

  // Mount diagnostic — confirms this component instance is active
  useEffect(() => {
    console.info('CHAT_SWIPE_COMPONENT_ACTIVE', { threadId: thread.id })
  }, [thread.id])

  function syncState(s: SwipeState) {
    swipeStateRef.current = s
    setSwipeState(s)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (swipeStateRef.current === 'deleting') return
    startXRef.current  = e.clientX
    startYRef.current  = e.clientY
    isHorizRef.current = false
    movedRef.current   = false
    // DON'T capture yet — wait until we confirm the gesture is horizontal
    // so that vertical scroll in the list still works normally
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (swipeStateRef.current === 'deleting') return

    const dx = startXRef.current - e.clientX         // positive = swipe left
    const dy = Math.abs(e.clientY - startYRef.current)

    if (!isHorizRef.current) {
      // Not yet determined — wait for enough movement to classify
      if (Math.abs(dx) < 5 && dy < 5) return
      // If vertical movement dominates → not our gesture, let parent scroll
      if (dy > Math.abs(dx) * 1.1) return
      // Horizontal gesture confirmed — take pointer capture now
      isHorizRef.current = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      console.info('CHAT_SWIPE_START', { threadId: thread.id })
    }

    if (dx < 0) {
      // Swiped back to the right — cancel
      setSwipeX(0)
      syncState('idle')
      return
    }

    movedRef.current = true
    const clamped    = Math.min(dx, ARMED_THRESHOLD + 24)
    setSwipeX(clamped)
    console.info('CHAT_SWIPE_MOVE', { threadId: thread.id, deltaX: Math.round(clamped) })

    const cur = swipeStateRef.current
    if (clamped >= ARMED_THRESHOLD && cur !== 'armedToDelete') {
      syncState('armedToDelete')
      console.info('CHAT_SWIPE_ARMED_DELETE', { threadId: thread.id })
    } else if (clamped < ARMED_THRESHOLD && cur === 'armedToDelete') {
      syncState('swiping')
    } else if (cur === 'idle') {
      syncState('swiping')
    }
  }

  function onPointerUp() {
    if (!isHorizRef.current) return   // was not a horizontal gesture — ignore
    if (swipeStateRef.current === 'armedToDelete') {
      triggerDelete()
    } else {
      setSwipeX(0)
      syncState('idle')
    }
  }

  function triggerDelete() {
    syncState('deleting')
    setSwipeX(ARMED_THRESHOLD)
    console.info('CHAT_DELETE_REQUEST', { threadId: thread.id })
    setTimeout(() => {
      try {
        onDelete?.(thread.id)
        console.info('CHAT_DELETE_SUCCESS', { threadId: thread.id })
      } catch (err) {
        console.info('CHAT_DELETE_ERROR', {
          threadId: thread.id,
          message: err instanceof Error ? err.message : String(err),
        })
        setSwipeX(0)
        syncState('idle')
      }
    }, 300)
  }

  function handleClick() {
    // Only open if the user didn't swipe (movedRef stays false for a plain tap)
    if (!movedRef.current) onClick()
  }

  const isArmed = swipeState === 'armedToDelete' || swipeState === 'deleting'

  return (
    <div className={['chat-swipe-row', isArmed ? 'chat-swipe-row--armed' : ''].filter(Boolean).join(' ')}>
      {/* Red delete panel revealed behind */}
      <div className="chat-swipe-delete-bg" aria-hidden>
        <Trash2 size={16} />
        <span>{swipeState === 'deleting' ? 'Usuwanie…' : 'Usuń'}</span>
      </div>

      {/* Sliding item content */}
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
