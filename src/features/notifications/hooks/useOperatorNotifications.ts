// =============================================================================
// useOperatorNotifications — hooki powiadomień operatora
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { operatorNotificationsApi } from '@/features/notifications/api/operator-notifications.api'

export const operatorNotificationKeys = {
  all:         ['operator-notifications']        as const,
  unreadCount: ['operator-notifications-unread'] as const,
}

/** Lista powiadomień operatora (max 50, najnowsze pierwsze) */
export function useOperatorNotifications() {
  return useQuery({
    queryKey: operatorNotificationKeys.all,
    queryFn:  () => operatorNotificationsApi.list(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

/** Licznik nieprzeczytanych — badge w topbarze i sidebarze */
export function useOperatorUnreadCount() {
  return useQuery({
    queryKey: operatorNotificationKeys.unreadCount,
    queryFn:  () => operatorNotificationsApi.unreadCount(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

/** Oznacz wszystkie jako przeczytane */
export function useMarkAllOperatorNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => operatorNotificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: operatorNotificationKeys.all })
      void queryClient.invalidateQueries({ queryKey: operatorNotificationKeys.unreadCount })
    },
  })
}
