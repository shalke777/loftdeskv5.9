// =============================================================================
// useClientNotifications — hooki powiadomień klienta
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientNotificationsApi } from '@/features/client-portal/api/client-notifications.api'

export const notificationKeys = {
  all:         ['client-notifications']         as const,
  unreadCount: ['client-notifications-unread']  as const,
}

/** Lista powiadomień (max 50, najnowsze pierwsze) */
export function useClientNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn:  () => clientNotificationsApi.list(),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}

/** Licznik nieprzeczytanych — lekki, osobny query do badge */
export function useClientUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn:  () => clientNotificationsApi.unreadCount(),
    staleTime: 10_000,
    refetchInterval: 30_000,
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
