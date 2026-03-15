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

  // ── Swipe-to-delete state ────────────────────────────────────────────────
  const [swipeX,     setSwipeX]     = useState(0)
  const [swipeState, setSwipeState] = useState<'idle' | 'swiping' | 'armedToDelete' | 'deleting'>('idle')
  const startXRef = useRef(0)
  const movedRef  = useRef(false)
  const ARMED_THRESHOLD = 80

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    startXRef.current = e.clientX
    movedRef.current  = false
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    console.info('CHAT_SWIPE_START', { threadId: thread.id })
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const dx = startXRef.current - e.clientX   // positive = swiped left
    if (dx < 3) return
    movedRef.current = true
    const clamped = Math.max(0, Math.min(dx, ARMED_THRESHOLD + 20))
    setSwipeX(clamped)
    setSwipeState(prev => {
      if (clamped >= ARMED_THRESHOLD && prev !== 'armedToDelete') {
        console.info('CHAT_SWIPE_ARMED_DELETE', { threadId: thread.id })
        return 'armedToDelete'
      }
      if (clamped < ARMED_THRESHOLD && prev === 'armedToDelete') return 'swiping'
      if (prev === 'idle') return 'swiping'
      return prev
    })
  }

  function onPointerUp() {
    if (swipeState === 'armedToDelete') {
      triggerDelete()
    } else {
      setSwipeX(0)
      setSwipeState('idle')
    }
  }

  function triggerDelete() {
    setSwipeState('deleting')
    setSwipeX(ARMED_THRESHOLD)
    console.info('CHAT_DELETE_REQUEST', { threadId: thread.id })
    setTimeout(() => {
      try {
        onDelete?.(thread.id)
        console.info('CHAT_DELETE_SUCCESS', { threadId: thread.id })
      } catch (err) {
        console.info('CHAT_DELETE_ERROR', { threadId: thread.id, message: String(err) })
        setSwipeX(0)
        setSwipeState('idle')
      }
    }, 300)
  }

  function handleClick() {
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
