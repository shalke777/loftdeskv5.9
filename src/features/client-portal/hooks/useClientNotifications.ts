// =============================================================================
// useClientNotifications — hooki powiadomień klienta
// =============================================================================

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientNotificationsApi } from '@/features/client-portal/api/client-notifications.api'
import { supabase, isDemoMode } from '@/shared/lib/supabase'

export const notificationKeys = {
  all:         ['client-notifications']         as const,
  unreadCount: ['client-notifications-unread']  as const,
}

/** Lista powiadomień (max 50, najnowsze pierwsze) */
export function useClientNotifications() {
  const queryClient = useQueryClient()

  // Realtime: new notification → refresh list and badge immediately
  useEffect(() => {
    if (!supabase || isDemoMode) return
    const channel = supabase
      .channel('client-notifications-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'client_notifications' },
        () => {
          void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
          void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount })
        },
      )
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [queryClient])

  return useQuery({
    queryKey: notificationKeys.all,
    queryFn:  () => clientNotificationsApi.list(),
    staleTime: 30_000,
    // Slow polling fallback in case Realtime drops
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  })
}

/** Licznik nieprzeczytanych — lekki, osobny query do badge */
export function useClientUnreadCount() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!supabase || isDemoMode) return
    const channel = supabase
      .channel('client-notifications-unread-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'client_notifications' },
        () => { void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount }) },
      )
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [queryClient])

  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn:  () => clientNotificationsApi.unreadCount(),
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  })
}

/** Oznacz jedno powiadomienie jako przeczytane */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => clientNotificationsApi.markRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount })
    },
  })
}

/** Oznacz wszystkie jako przeczytane */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => clientNotificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount })
    },
  })
}
