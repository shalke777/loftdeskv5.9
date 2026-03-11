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
import { Button } from '@/shared/ui/Button/Button'
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
          bg:    '#f0f9ff',
          border: '#bae6fd',
          color:  '#0c4a6e',
          icon:   '🔒',
          text:   'Notatka wewnętrzna — widoczna tylko dla Twojego zespołu',
        }
      case 'client_shared':
        return {
          bg:    '#f0fdf4',
          border: '#86efac',
          color:  '#14532d',
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
    <div
      style={{
        borderTop: '1px solid var(--color-border)',
        padding:   '12px 16px',
        display:   'flex',
        flexDirection: 'column',
        gap:       8,
      }}
    >
      {/* Banner */}
      {banner && (
        <div
          style={{
            background:   banner.bg,
            border:       `1px solid ${banner.border}`,
            borderRadius: 8,
            padding:      '7px 12px',
            fontSize:     12,
            color:        banner.color,
            display:      'flex',
            alignItems:   'center',
            gap:          8,
          }}
        >
          <span>{banner.icon}</span>
          <span>{banner.text}</span>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textRef}
        value={body}
        onChange={e => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          thread.visibility === 'internal'
            ? 'Dodaj notatkę wewnętrzną…'
            : thread.visibility === 'approval'
            ? 'Dodaj wiadomość dotyczącą akceptacji…'
            : 'Napisz wiadomość do klienta…'
        }
        disabled={disabled || send.isPending}
        rows={3}
        style={{
          width:        '100%',
          padding:      '10px 12px',
          border:       '1px solid var(--color-border)',
          borderRadius: 12,
          fontSize:     14,
          lineHeight:   1.5,
          resize:       'none',
          fontFamily:   'inherit',
          background:   'var(--color-surface-soft)',
          color:        'var(--color-text-primary)',
          boxSizing:    'border-box',
        }}
      />

      {/* Akcje */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        {/* Błąd wysyłki */}
        {send.isError && (
          <span style={{ fontSize: 12, color: 'var(--color-error)' }}>
            ⚠️ Błąd wysyłki — sprawdź połączenie i spróbuj ponownie
          </span>
        )}
        {!send.isError && (
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            Ctrl+Enter aby wysłać
          </span>
        )}
        <Button
          onClick={handleSend}
          disabled={!body.trim() || disabled || send.isPending}
          loading={send.isPending}
          variant={thread.visibility === 'client_shared' || thread.visibility === 'approval' ? 'primary' : 'secondary'}
        >
          {thread.visibility === 'internal' ? '📝 Zapisz notatkę' : '📤 Wyślij'}
        </Button>
      </div>
    </div>
  )
}
