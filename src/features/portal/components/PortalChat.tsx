import { useState } from 'react'
import { usePortalChat } from '@/features/portal/hooks/usePortalData'

interface Props {
  token: string
}

export function PortalChat({ token }: Props) {
  const [text, setText] = useState('')
  const chat = usePortalChat(token)

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    chat.mutate(text.trim(), {
      onSuccess: () => setText(''),
    })
  }

  return (
    <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <input
        className="input"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Napisz wiadomość…"
        disabled={chat.isPending}
        style={{ flex: 1 }}
      />
      <button
        type="submit"
        className="btn"
        disabled={chat.isPending || !text.trim()}
        style={{ whiteSpace: 'nowrap' }}
      >
        {chat.isPending ? '…' : 'Wyślij'}
      </button>
    </form>
  )
}
