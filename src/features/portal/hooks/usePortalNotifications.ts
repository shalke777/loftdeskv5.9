import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { useToast } from '@/shared/hooks/useToast'

export interface PortalNotification {
  id: string
  type: 'message' | 'accepted' | 'rejected'
  text: string
  created_at: string
  read: boolean
}

/**
 * Subscribes to Supabase Realtime changes on portal_messages.
 * Shows toast notifications for new client messages and decisions.
 * Returns unread count and notification list.
 */
export function usePortalNotifications(userId: string | null) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)

  useEffect(() => {
    if (isDemoMode || !supabase || !userId) return

    const channel = supabase
      .channel('portal-live-' + userId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'portal_messages' },
        (payload) => {
          const msg = payload.new as {
            id: string
            token_id: string
            sender: string
            content: string
            read: boolean
            created_at: string
          }
          // Only notify about client messages (not company's own)
          if (msg.sender !== 'client') return

          const isDecision = msg.content.startsWith('✅') || msg.content.startsWith('❌')
          const type = msg.content.startsWith('✅')
            ? 'accepted' as const
            : msg.content.startsWith('❌')
              ? 'rejected' as const
              : 'message' as const

          const notification: PortalNotification = {
            id: msg.id,
            type,
            text: msg.content.slice(0, 200),
            created_at: msg.created_at,
            read: false,
          }

          setNotifications((prev) => [notification, ...prev])
          setUnreadCount((prev) => prev + 1)

          // Show toast
          if (type === 'accepted') {
            toast.success('Klient zaakceptował kosztorys', msg.content)
          } else if (type === 'rejected') {
            toast.error('Klient odrzucił kosztorys', msg.content)
          } else {
            toast.info('Nowa wiadomość od klienta', msg.content.slice(0, 100))
          }

          // Invalidate portal queries so data refreshes
          queryClient.invalidateQueries({ queryKey: ['portal'] })
          queryClient.invalidateQueries({ queryKey: ['estimates'] })
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase!.removeChannel(channel)
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return { notifications, unreadCount, markAllRead }
}
