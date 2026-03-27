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

const VISIBILITY_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  internal:      { label: 'Wewn.',  color: '#A7ABB3', bg: 'rgba(160,170,180,0.10)' },
  client_shared: { label: 'Klient', color: '#77BA8A', bg: 'rgba(119,186,138,0.15)' },
  approval:      { label: 'Akcept.',color: '#D4960A', bg: 'rgba(212,150,10,0.15)' },
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
}

export function ThreadListItem({ thread, active, showProject, onClick }: ThreadListItemProps) {
  const unread = thread.unread_count_operator
  const inboxThread = thread as InboxThread

  // Avatar: pierwsza litera nazwy projektu (inbox) lub tytułu wątku
  const avatarLetter = showProject && inboxThread.project_name
    ? inboxThread.project_name[0].toUpperCase()
    : (thread.title ?? THREAD_TYPE_LABELS[thread.type] ?? thread.type)[0].toUpperCase()

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
      {/* Avatar */}
      <div className="chat-conv-item__avatar">
        {avatarLetter}
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
            {inboxThread.project_number ? `${inboxThread.project_number} · ` : ''}{inboxThread.project_name}
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
  onNewThread?:  () => void
}

export function ThreadList({
  threads,
  activeId,
  showProject,
  emptyLabel = 'Brak wątków',
  onSelect,
  onNewThread,
}: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="chat-sidebar__empty">
        <div className="chat-sidebar__empty-icon">💬</div>
        <p className="chat-sidebar__empty-title">{emptyLabel}</p>
        {onNewThread ? (
          <>
            <p className="chat-sidebar__empty-hint">Rozpocznij rozmowę z klientem lub stwórz notatkę dla zespołu</p>
            <button className="chat-sidebar__empty-cta" onClick={onNewThread}>
              Nowa rozmowa
            </button>
          </>
        ) : (
          <p className="chat-sidebar__empty-hint">Wątki pojawią się tu automatycznie</p>
        )}
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
