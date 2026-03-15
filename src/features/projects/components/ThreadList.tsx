// =============================================================================
// ThreadList — lista wątków projektu / global inbox
// =============================================================================
// Przyjmuje tablicę wątków i wyświetla je jako listę.
// Reużywany w ProjectThreadsTab (jeden projekt) i ChatPage (global inbox).

import { useState } from 'react'
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
  const unread = thread.unread_count_operator
  const inboxThread = thread as InboxThread
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDelete(true)
  }

  function handleConfirmYes(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDelete(false)
    onDelete?.(thread.id)
  }

  function handleConfirmNo(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDelete(false)
  }

  return (
    <div style={{ position: 'relative' }} className="chat-conv-item-wrap">
      <button
        onClick={onClick}
        className={[
          'chat-conv-item',
          active   ? 'chat-conv-item--active'  : '',
          unread > 0 ? 'chat-conv-item--unread' : '',
        ].filter(Boolean).join(' ')}
        style={{ width: '100%', textAlign: 'left' }}
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

      {/* Delete button — visible on hover */}
      {onDelete && !confirmDelete && (
        <button
          className="chat-conv-item__delete-btn"
          onClick={handleDeleteClick}
          aria-label="Usuń wątek"
          title="Usuń wątek"
        >
          <Trash2 size={13} />
        </button>
      )}

      {/* Inline confirm overlay */}
      {confirmDelete && (
        <div className="chat-conv-item__confirm" onClick={e => e.stopPropagation()}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Usuń wątek?</span>
          <button className="chat-conv-item__confirm-yes" onClick={handleConfirmYes}>Tak</button>
          <button className="chat-conv-item__confirm-no"  onClick={handleConfirmNo}>Nie</button>
        </div>
      )}
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
