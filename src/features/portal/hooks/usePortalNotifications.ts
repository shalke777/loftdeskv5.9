import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { useToast } from '@/shared/hooks/useToast'

export interface PortalNotification {
  id: string
  type: 'message' | 'accepted' | 'rejected'
  text: string
  tokenId: string
  clientName: string
  created_at: string
  read: boolean
}

interface RawMsg {
  id: string
  token_id: string
  sender: string
  content: string
  read: boolean
  created_at: string
  client_tokens: { client_name: string } | null
}

async function fetchUnread(): Promise<RawMsg[]> {
  if (isDemoMode || !supabase) return []
  const { data, error } = await supabase
    .from('portal_messages')
    .select('id, token_id, sender, content, read, created_at, client_tokens(client_name)')
    .eq('sender', 'client')
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return []
  return (data ?? []) as unknown as RawMsg[]
}

function classifyMsg(content: string): 'accepted' | 'rejected' | 'message' {
  if (content.startsWith('✅')) return 'accepted'
  if (content.startsWith('❌')) return 'rejected'
  return 'message'
}

/**
 * Polls portal_messages every 10 s for unread client messages.
 * Shows toast for each new message detected since last poll.
 */
export function usePortalNotifications(userId: string | null) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const seenIdsRef = useRef<Set<string>>(new Set())

  const { data: rawMessages } = useQuery({
    queryKey: ['portal-notifications', userId],
    queryFn: fetchUnread,
    enabled: Boolean(userId) && !isDemoMode && Boolean(supabase),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    if (!rawMessages?.length) return

    const newItems: PortalNotification[] = []
    for (const msg of rawMessages) {
      if (seenIdsRef.current.has(msg.id)) continue
      seenIdsRef.current.add(msg.id)

      const type = classifyMsg(msg.content)
      const clientName = (msg.client_tokens as any)?.client_name ?? 'Klient'

      const notification: PortalNotification = {
        id: msg.id,
        type,
        text: msg.content.slice(0, 200),
        tokenId: msg.token_id,
        clientName,
        created_at: msg.created_at,
        read: false,
      }
      newItems.push(notification)

      // Show toast for each new notification
      if (type === 'accepted') {
        toast.success('Klient zaakceptował kosztorys', `${clientName}: ${msg.content.slice(0, 80)}`)
      } else if (type === 'rejected') {
        toast.error('Klient odrzucił kosztorys', `${clientName}: ${msg.content.slice(0, 80)}`)
      } else {
        toast.info('Nowa wiadomość od klienta', `${clientName}: ${msg.content.slice(0, 80)}`)
      }
    }

    if (newItems.length) {
      setNotifications((prev) => [...newItems, ...prev].slice(0, 100))
      setUnreadCount((prev) => prev + newItems.length)
      queryClient.invalidateQueries({ queryKey: ['portal'] })
      queryClient.invalidateQueries({ queryKey: ['estimates'] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMessages])

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    // Mark as read in DB
    if (supabase && !isDemoMode) {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
      if (unreadIds.length) {
        supabase.from('portal_messages').update({ read: true }).in('id', unreadIds).then()
      }
    }
  }

  return { notifications, unreadCount, markAllRead }
}
