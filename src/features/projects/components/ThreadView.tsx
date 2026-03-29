// =============================================================================
// ThreadView — widok wiadomości w wątku
// =============================================================================
// - Scroll: przy zmianie wątku → instant (bez animacji)
//           przy nowej wiadomości → smooth
// - Mark as read: raz przy otwarciu wątku (useMarkThreadRead)
// - Dedup: bez optimistic inserts, realtime channel w useThreadMessages

import { useEffect, useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useThreadMessages, useDeleteThreadMessage } from '@/features/projects/hooks/useThreadMessages'
import { useMarkThreadRead } from '@/features/projects/hooks/useMarkThreadRead'
import type { ProjectMessage } from '@/features/portal/model/project-portal.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// ─── Bąbelek wiadomości ───────────────────────────────────────────────────────

interface BubbleProps {
  msg:      ProjectMessage
  onDelete: (id: string) => void
  deleting: boolean
}

function MessageBubble({ msg, onDelete, deleting }: BubbleProps) {
  const isOperator = msg.sender_type === 'operator'
  const isClient   = msg.sender_type === 'client'
  const isSystem   = msg.sender_type === 'system'
  const isInternal = msg.visibility === 'internal'

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', margin: '8px 0' }}>
        <span
          style={{
            display:      'inline-block',
            padding:      '4px 12px',
            borderRadius: 999,
            fontSize:     11,
            color:        '#A7ABB3',
            background:   'rgba(160,170,180,0.08)',
          }}
        >
          {msg.body}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`chat-bubble-wrap${isOperator ? ' chat-bubble-wrap--right' : ''}${isInternal ? ' chat-bubble-wrap--note' : ''}`}
    >
      <div
        className={`chat-bubble${isOperator ? ' chat-bubble--operator' : ''}${isInternal ? ' chat-bubble--note' : ''}`}
        style={{
          // Wiadomości wewnętrzne — żółtawy odcień
          ...(isInternal && !isClient ? {
            background:   'rgba(212,150,10,0.12)',
            border:       '1px solid rgba(212,150,10,0.30)',
            color:        '#D4960A',
          } : {}),
          // Wiadomości klienta — jasnoszare
          ...(isClient ? {
            background:   'rgba(160,170,180,0.10)',
            color:        '#F0F2F3',
            borderRadius: '20px 20px 20px 5px',
            padding:      '10px 15px',
            fontSize:     14,
          } : {}),
        }}
      >
        {/* Label: notatka wewnętrzna */}
        {isInternal && !isClient && (
          <span className="chat-bubble__note-label" style={{ fontSize: 11, marginBottom: 4, display: 'block', opacity: 0.75 }}>
            � Notatka wewnętrzna
          </span>
        )}

        {/* Nadawca — widoczny dla wiadomości klienta lub systemowych */}
        {isClient && msg.sender_name && (
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>
            {msg.sender_name}
          </div>
        )}

        <p className="chat-bubble__text" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {msg.deleted_at
            ? <span style={{ fontStyle: 'italic', opacity: 0.55 }}>Wiadomość usunięta</span>
            : msg.body
          }
        </p>

        {/* Załącznik */}
        {msg.has_attachments && msg.attachment_url && (
          msg.attachment_mime?.startsWith('image/') ? (
            <a
              href={msg.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="chat-bubble__attachment-img-link"
              title={msg.attachment_name ?? 'Otwórz zdjęcie'}
            >
              <img
                src={msg.attachment_url}
                alt={msg.attachment_name ?? 'Załącznik'}
                className="chat-bubble__attachment-img"
                loading="lazy"
              />
            </a>
          ) : (
            <a
              href={msg.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="chat-bubble__attachment"
              style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12 }}
            >
              📎 {msg.attachment_name ?? 'Załącznik'}
            </a>
          )
        )}

        <span className="chat-bubble__time">{formatTime(msg.created_at)}</span>
        {isOperator && !msg.deleted_at && (
          <button
            type="button"
            title="Usuń wiadomość"
            disabled={deleting}
            onClick={() => {
              if (window.confirm('Usunąć tę wiadomość?')) onDelete(msg.id)
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: '#8A8F98', marginLeft: 6, padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// ─── ThreadView ───────────────────────────────────────────────────────────────

interface ThreadViewProps {
  threadId:   string | null
  projectId:  string | null
  /** Visibility of the current thread — drives context messages */
  visibility?: 'internal' | 'client_shared' | 'approval'
  /** Called when user clicks “Nowa rozmowa” in the empty state */
  onNewThread?: () => void
}

export function ThreadView({ threadId, projectId, visibility, onNewThread }: ThreadViewProps) {
  const { data: messages, isLoading } = useThreadMessages(threadId)
  const deleteMsg  = useDeleteThreadMessage(threadId)
  const listRef    = useRef<HTMLDivElement>(null)
  const prevThread = useRef<string | null>(null)
  const [prevCount, setPrevCount] = useState(0)

  // Mark as read — raz per zmiana threadId
  useMarkThreadRead(threadId, projectId)

  // Scroll logic:
  //   - zmiana wątku → instant (scrollTop bez behavior)
  //   - nowa wiadomość → smooth
  useEffect(() => {
    const el = listRef.current
    if (!el || !messages) return

    if (prevThread.current !== threadId) {
      // Nowy wątek — skok bez animacji
      el.scrollTop = el.scrollHeight
      prevThread.current = threadId
      setPrevCount(messages.length)
    } else if (messages.length > prevCount) {
      // Nowa wiadomość — smooth
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      setPrevCount(messages.length)
    }
  }, [threadId, messages, prevCount])

  if (!threadId) {
    return (
      <div className="chat-thread__empty">
        <div className="chat-empty-state">
          <div className="chat-empty-state__icon-wrap">
            <MessageSquare size={32} />
          </div>
          <h3 className="chat-empty-state__title">Centrum rozmów</h3>
          <p className="chat-empty-state__desc">
            Wybierz wątek z listy po lewej lub utwórz nową rozmowę z klientem albo notatkę dla swojego zespołu.
          </p>
          {onNewThread && (
            <button className="chat-empty-state__cta" onClick={onNewThread}>
              Nowa rozmowa
            </button>
          )}
          <div className="chat-empty-state__hints">
            <span>💬 Z klientem</span>
            <span className="chat-empty-state__hints-dot">·</span>
            <span>🔒 Wewnętrznie</span>
            <span className="chat-empty-state__hints-dot">·</span>
            <span>📬 Z portalu</span>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  const list = messages ?? []

  // Grupuj po dacie
  let lastDate = ''

  return (
    <div ref={listRef} className="chat-thread__messages">
      {list.length === 0 ? (
        <div className="chat-thread__no-messages">
          <div style={{ fontSize: 36 }}>📭</div>
          <p style={{ margin: 0 }}>
            {visibility === 'client_shared'
              ? 'Napisz pierwszą wiadomość — klient zobaczy ją w portalu'
              : visibility === 'internal'
                ? 'Dodaj notatkę — klient tego nie zobaczy'
                : 'Brak wiadomości — napisz pierwszą'}
          </p>
        </div>
      ) : (
        <>
          {list.map((msg) => {
          const dateLabel = formatDate(msg.created_at)
          const showDate  = dateLabel !== lastDate
          lastDate        = dateLabel
          return (
            <div key={msg.id}>
              {showDate && <div className="chat-date-sep">{dateLabel}</div>}
              <MessageBubble msg={msg} onDelete={(id) => deleteMsg.mutate(id)} deleting={deleteMsg.isPending} />
            </div>
          )
          })}
          {/* Awaiting-client hint: thread has messages but none from client yet */}
          {visibility === 'client_shared' && list.every(m => m.sender_type !== 'client') && (
            <div style={{
              textAlign: 'center', margin: '16px 8px 4px',
              fontSize: 12, color: '#8A8F98',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span>⏳</span> Oczekiwanie na odpowiedź klienta z portalu projektu
            </div>
          )}
        </>
      )}
    </div>
  )
}
