// =============================================================================
// MessageComposer — formularz wysyłki wiadomości przez operatora
// =============================================================================
//
// Zasady UX:
//   - NIE ma małego toggle visibility
//   - Aktywny wątek OKREŚLA tryb:
//       visibility = 'internal'      → tylko notatki wewnętrzne
//       visibility = 'client_shared' → wiadomości do klienta
//       visibility = 'approval'      → pytania / odpowiedzi akceptacyjne
//   - Baner informuje operatora gdzie trafi wiadomość
//   - Ctrl+Enter (lub osobny przycisk) wysyła
//   - Obsługa braku internetu: mutation.error → komunikat

import { useRef, useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { useSendThreadMessage } from '@/features/projects/hooks/useSendThreadMessage'
import type { ProjectThread } from '@/features/portal/model/project-portal.types'

interface Props {
  thread:    ProjectThread
  projectId: string
  disabled?: boolean
}

export function MessageComposer({ thread, projectId, disabled }: Props) {
  const [body, setBody] = useState('')
  const textRef         = useRef<HTMLTextAreaElement>(null)
  const send            = useSendThreadMessage(projectId)

  const handleSend = () => {
    const trimmed = body.trim()
    if (!trimmed || send.isPending) return

    send.mutate(
      {
        thread_id:  thread.id,
        project_id: projectId,
        body:       trimmed,
        visibility: thread.visibility === 'approval' ? 'client_shared' : thread.visibility,
      },
      {
        onSuccess: () => {
          setBody('')
          textRef.current?.focus()
        },
      },
    )
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Banner informacyjny zależny od visibility ────────────────────────────
  const banner = (() => {
    switch (thread.visibility) {
      case 'internal':
        return {
          bg:    '#fefce8',
          border: '#f0d070',
          color:  '#7a5010',
          icon:   '🔒',
          text:   'Notatka wewnętrzna — widoczna tylko dla Twojego zespołu',
        }
      case 'client_shared':
        return {
          bg:    '#eff8ff',
          border: '#bee3f8',
          color:  '#1e4f78',
          icon:   '💬',
          text:   'Wiadomość do klienta — klient zobaczy ją w portalu',
        }
      case 'approval':
        return {
          bg:    '#fffbeb',
          border: '#fde68a',
          color:  '#78350f',
          icon:   '✅',
          text:   'Wiadomość w kontekście akceptacji — widoczna dla klienta',
        }
      default:
        return null
    }
  })()

  return (
    <div className="chat-thread__composer">
      {banner && (
        <div
          className="chat-thread__composer-banner"
          style={{ background: banner.bg, border: `1px solid ${banner.border}`, color: banner.color }}
        >
          <span>{banner.icon}</span>
          <span>{banner.text}</span>
        </div>
      )}

      <div className="chat-thread__composer-row">
        <textarea
          ref={textRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            thread.visibility === 'internal'
              ? 'Dodaj notatkę wewnętrzną…'
              : thread.visibility === 'approval'
              ? 'Dodaj wiadomość w kontekście akceptacji…'
              : 'Napisz wiadomość do klienta…'
          }
          disabled={disabled || send.isPending}
          rows={2}
          className={`chat-textarea${thread.visibility === 'internal' ? ' chat-textarea--note' : ''}`}
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || disabled || send.isPending}
          className={`chat-send-btn${thread.visibility === 'internal' ? ' chat-send-btn--note' : ''}`}
          title="Wyślij (Ctrl+Enter)"
          type="button"
        >
          <Send size={16} strokeWidth={2.5} />
        </button>
      </div>

      {send.isError ? (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-error)' }}>
          ⚠️ Błąd wysyłki — sprawdź połączenie
        </div>
      ) : (
        <div className="chat-hint">Ctrl+Enter aby wysłać</div>
      )}
    </div>
  )
}
