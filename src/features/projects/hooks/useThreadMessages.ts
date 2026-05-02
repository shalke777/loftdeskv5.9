// Wiadomości wątku — Realtime first, polling fallback.
//
// Deduplikacja optimistic vs realtime:
//   Nie używamy optimistic inserts. useSendThreadMessage po sukcesie
//   unieważnia zapytanie (invalidateQueries), a realtime channel
//   tylko aktualizuje cache gdy nie ma pending mutacji.
//   Efekt: zero podwójnych wiadomości po stronie operatora.

import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { threadsApi } from '@/features/projects/api/threads.api'
import type { ProjectMessage } from '@/features/portal/model/project-portal.types'

export const messagesKey = (threadId: string) =>
  ['thread-messages', threadId] as const

export function useThreadMessages(threadId: string | null) {
  const companyId   = useCompanyId()
  const queryClient = useQueryClient()
  // Śledzi czy jest aktywna mutacja — wtedy realtime nie nadpisuje cache
  const mutatingRef = useRef(false)

  const query = useQuery({
    queryKey: messagesKey(threadId ?? ''),
    queryFn:  () => threadsApi.listMessages(threadId!, companyId),
    enabled:  Boolean(threadId),
    staleTime: 10_000,
    // Polling fallback — rzadszy, bo realtime jest main channel
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  // Supabase Realtime — nowe wiadomości w wątku
  useEffect(() => {
    if (!threadId || !supabase) return

    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          if (mutatingRef.current) return // mutacja w toku — invalidation jej obowiązkiem

          const newMsg = payload.new as ProjectMessage
          queryClient.setQueryData<ProjectMessage[]>(
            messagesKey(threadId),
            (old = []) => {
              // Dedup: nie dodawaj jeśli już jest (np. po invalidateQueries)
              if (old.some(m => m.id === newMsg.id)) return old
              return [...old, newMsg]
            },
          )
        },
      )
      .subscribe()

    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [threadId, queryClient])

  return { ...query, mutatingRef }
}

export function useDeleteThreadMessage(threadId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) => threadsApi.deleteMessage(messageId),
    onSuccess: () => {
      if (threadId) queryClient.invalidateQueries({ queryKey: messagesKey(threadId) })
    },
  })
}
