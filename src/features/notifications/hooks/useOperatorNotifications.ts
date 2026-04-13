// =============================================================================
// useOperatorNotifications — hooki powiadomień operatora
// =============================================================================

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { operatorNotificationsApi } from '@/features/notifications/api/operator-notifications.api'
import { supabase, isDemoMode } from '@/shared/lib/supabase'
import { useCompanyId } from '@/features/auth/hooks/useAuth'

export const operatorNotificationKeys = {
  all:         ['operator-notifications']        as const,
  unreadCount: ['operator-notifications-unread'] as const,
}

/** Lista powiadomień operatora (max 50, najnowsze pierwsze) + realtime */
export function useOperatorNotifications() {
  const companyId   = useCompanyId()
  const queryClient = useQueryClient()

  // Realtime: nowe powiadomienie pojawia się natychmiast (np. akceptacja klienta)
  useEffect(() => {
    if (!companyId || !supabase || isDemoMode) return
    const channel = supabase
      .channel(`operator-notif:${companyId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'operator_notifications',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: operatorNotificationKeys.all })
          void queryClient.invalidateQueries({ queryKey: operatorNotificationKeys.unreadCount })
        },
      )
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [companyId, queryClient])

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

/** Suma nieprzeczytanych wiadomości w wątkach chatu (unread_count_operator) */
export function useUnreadChatCount() {
  return useQuery<number>({
    queryKey: ['chat-unread-count'],
    queryFn: async () => {
      if (!supabase || isDemoMode) return 0
      const { data, error } = await supabase
        .from('project_threads')
        .select('unread_count_operator')
        .gt('unread_count_operator', 0)
      if (error) throw error
      return (data ?? []).reduce((s, t: any) => s + (t.unread_count_operator ?? 0), 0)
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}
