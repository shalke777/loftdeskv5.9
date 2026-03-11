// =============================================================================
// ThreadList — lista wątków projektu / global inbox
// =============================================================================
// Przyjmuje tablicę wątków i wyświetla je jako listę.
// Reużywany w ProjectThreadsTab (jeden projekt) i ChatPage (global inbox).

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

const VISIBILITY_DOT: Record<string, { color: string; title: string }> = {
  internal:      { color: '#94a3b8', title: 'Tylko widok firmowy' },
  client_shared: { color: '#22c55e', title: 'Widoczny dla klienta' },
  approval:      { color: '#f59e0b', title: 'Akceptacje / pytania' },
}

interface VisibilityDotProps {
  visibility: string
}

function VisibilityDot({ visibility }: VisibilityDotProps) {
  const cfg = VISIBILITY_DOT[visibility] ?? VISIBILITY_DOT.internal
  return (
    <span
      title={cfg.title}
      style={{
        display:      'inline-block',
        width:        8,
        height:       8,
        borderRadius: '50%',
        background:   cfg.color,
        flexShrink:   0,
      }}
    />
  )
}

// ─── ThreadListItem ───────────────────────────────────────────────────────────

interface ThreadListItemProps {
  thread:        ProjectThread | InboxThread
  active:        boolean
  showProject?:  boolean   // dla global inbox
  onClick:       () => void
}

export function ThreadListItem({ thread, active, showProject, onClick }: ThreadListItemProps) {
  const unread = thread.unread_count_operator
  const inboxThread = thread as InboxThread

  return (
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
          <span className="chat-conv-item__name" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <VisibilityDot visibility={thread.visibility} />
            {thread.title ?? THREAD_TYPE_LABELS[thread.type] ?? thread.type}
          </span>
          <span className="chat-conv-item__time">
            {formatRelative(thread.last_message_at)}
          </span>
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
  )
}

// ─── ThreadList ───────────────────────────────────────────────────────────────

interface ThreadListProps {
  threads:       (ProjectThread | InboxThread)[]
  activeId:      string | null
  showProject?:  boolean
  emptyLabel?:   string
  onSelect:      (thread: ProjectThread | InboxThread) => void
}

export function ThreadList({
  threads,
  activeId,
  showProject,
  emptyLabel = 'Brak wątków',
  onSelect,
}: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 16px' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
        <p style={{ margin: 0, fontSize: 13 }}>{emptyLabel}</p>
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
        />
      ))}
    </div>
  )
}
