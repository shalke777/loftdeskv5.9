import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import {
  portalGetMessages,
  portalMarkMessagesRead,
  portalSendMessage,
} from '@/features/portal/api/portal-project.api'
import type { PortalScope } from '@/features/portal/model/project-portal.types'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props {
  sessionId:  string
  clientName: string | null
  scope:      PortalScope[]
}

export function PortalMessagesTab({ sessionId, clientName, scope }: Props) {
  const [body, setBody]       = useState('')
  const listRef               = useRef<HTMLDivElement>(null)
  const queryClient           = useQueryClient()
  const canSend               = scope.includes('send_messages')

  const { data: messages, isLoading } = useQuery({
    queryKey:      ['portal-messages', sessionId],
    queryFn:       async () => {
      await portalMarkMessagesRead(sessionId)
      return portalGetMessages(sessionId)
    },
    refetchInterval: 15_000,
    staleTime:     5_000,
  })

  const send = useMutation({
    mutationFn: () => portalSendMessage(sessionId, body.trim(), clientName ?? undefined),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: ['portal-messages', sessionId] })
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
      }, 200)
    },
  })

  if (isLoading) return <Spinner />

  const list = messages ?? []

  // Grupuj wiadomości po dacie
  let lastDate = ''

  return (
    <Card>
      <h3 style={{ marginBottom: 16 }}>Wiadomości</h3>

      <div
        ref={listRef}
        style={{
          display:      'flex',
          flexDirection: 'column',
          gap:          8,
          maxHeight:    480,
          overflowY:    'auto',
          paddingRight: 4,
          marginBottom: 16,
        }}
      >
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <p>Brak wiadomości. Jeśli masz pytanie, wpisz je poniżej.</p>
          </div>
        ) : (
          list.map((msg) => {
            const dateLabel = formatDate(msg.created_at)
            const showDate  = dateLabel !== lastDate
            lastDate        = dateLabel
            const isClient  = msg.sender_type === 'client'

            return (
              <div key={msg.id}>
                {showDate && (
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', margin: '12px 0 8px' }}>
                    {dateLabel}
                  </div>
                )}
                <div
                  style={{
                    display:       'flex',
                    justifyContent: isClient ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth:     '80%',
                      background:   isClient ? '#4f46e5' : '#f1f5f9',
                      color:        isClient ? '#fff' : '#1a202c',
                      borderRadius: isClient ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding:      '10px 14px',
                      fontSize:     14,
                      lineHeight:   1.5,
                    }}
                  >
                    {msg.sender_name && !isClient && (
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>
                        {msg.sender_name}
                      </div>
                    )}
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.body}</div>
                    {msg.has_attachments && msg.attachment_url && (
                      <div style={{ marginTop: 8 }}>
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: isClient ? '#c7d2fe' : '#4f46e5', fontSize: 12 }}
                        >
                          📎 {msg.attachment_name ?? 'Załącznik'}
                        </a>
                      </div>
                    )}
                    <div
                      style={{
                        fontSize:  11,
                        marginTop: 4,
                        opacity:   0.6,
                        textAlign: 'right',
                      }}
                    >
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {canSend ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && body.trim()) {
                e.preventDefault()
                send.mutate()
              }
            }}
            placeholder="Napisz wiadomość… (Enter — wyślij, Shift+Enter — nowa linia)"
            rows={2}
            disabled={send.isPending}
            style={{
              flex:       1,
              resize:     'none',
              padding:    '10px 12px',
              border:     '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize:   14,
              fontFamily: 'inherit',
              outline:    'none',
            }}
          />
          <Button
            onClick={() => send.mutate()}
            disabled={!body.trim() || send.isPending}
          >
            Wyślij
          </Button>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
          Ten link dostępu nie pozwala na wysyłanie wiadomości.
        </p>
      )}
    </Card>
  )
}
