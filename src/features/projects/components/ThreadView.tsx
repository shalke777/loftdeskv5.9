// =============================================================================
// ThreadView — widok wiadomości w wątku
// =============================================================================
// - Scroll: przy zmianie wątku → instant (bez animacji)
//           przy nowej wiadomości → smooth
// - Mark as read: raz przy otwarciu wątku (useMarkThreadRead)
// - Dedup: bez optimistic inserts, realtime channel w useThreadMessages

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useThreadMessages } from '@/features/projects/hooks/useThreadMessages'
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
  msg: ProjectMessage
}

function MessageBubble({ msg }: BubbleProps) {
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
            color:        '#64748b',
            background:   '#f1f5f9',
            border:       '1px solid #e2e8f0',
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
            background:   '#fef9c3',
            border:       '1px solid #fde047',
            color:        '#713f12',
          } : {}),
          // Wiadomości klienta — jasnoszare
          ...(isClient ? {
            background:   '#f1f5f9',
            color:        '#1a202c',
            borderRadius: '16px 16px 16px 4px',
            padding:      '10px 14px',
            fontSize:     14,
          } : {}),
        }}
      >
        {/* Label: notatka wewnętrzna */}
        {isInternal && !isClient && (
          <span className="chat-bubble__note-label" style={{ fontSize: 11, marginBottom: 4, display: 'block', opacity: 0.75 }}>
            🔒 Notatka wewnętrzna
          </span>
        )}

        {/* Nadawca — widoczny dla wiadomości klienta lub systemowych */}
        {isClient && msg.sender_name && (
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>
            {msg.sender_name}
          </div>
        )}

        <p className="chat-bubble__text" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {msg.body}
        </p>

        {/* Załącznik */}
        {msg.has_attachments && msg.attachment_url && (
          <a
            href={msg.attachment_url}
            target="_blank"
            rel="noreferrer"
            className="chat-bubble__attachment"
            style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12 }}
          >
            📎 {msg.attachment_name ?? 'Załącznik'}
          </a>
        )}

        <span className="chat-bubble__time">{formatTime(msg.created_at)}</span>
      </div>
    </div>
  )
}

// ─── ThreadView ───────────────────────────────────────────────────────────────

interface ThreadViewProps {
  threadId:  string | null
  projectId: string | null
}

export function ThreadView({ threadId, projectId }: ThreadViewProps) {
  const { data: messages, isLoading } = useThreadMessages(threadId)
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
      <div
        style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          color:          '#94a3b8',
          gap:            12,
        }}
      >
        <div style={{ fontSize: 40 }}>💬</div>
        <p style={{ margin: 0, fontSize: 14 }}>Wybierz wątek z listy</p>
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
    <div
      ref={listRef}
      style={{
        flex:          1,
        overflowY:     'auto',
        padding:       '12px 16px',
        display:       'flex',
        flexDirection: 'column',
        gap:           2,
      }}
    >
      {list.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
          <p style={{ margin: 0, fontSize: 13 }}>Brak wiadomości w tym wątku</p>
        </div>
      ) : (
        list.map((msg) => {
          const dateLabel = formatDate(msg.created_at)
          const showDate  = dateLabel !== lastDate
          lastDate        = dateLabel
          return (
            <div key={msg.id}>
              {showDate && (
                <div
                  style={{
                    textAlign:  'center',
                    fontSize:   11,
                    color:      '#94a3b8',
                    margin:     '16px 0 8px',
                  }}
                >
                  {dateLabel}
                </div>
              )}
              <MessageBubble msg={msg} />
            </div>
          )
        })
      )}
    </div>
  )
}
