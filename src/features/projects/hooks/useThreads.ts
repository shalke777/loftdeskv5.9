// Listuje wątki projektu z React Query + Supabase Realtime.
// Uprawnienia: operator, czyli strona aplikacji (nie portal).

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { threadsApi } from '@/features/projects/api/threads.api'

export const threadsKey = (projectId: string) =>
  ['project-threads', projectId] as const

export function useThreads(projectId: string | null) {
  const companyId   = useCompanyId()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: threadsKey(projectId ?? ''),
    queryFn:  () => threadsApi.listThreads(projectId!, companyId),
    enabled:  Boolean(projectId),
    staleTime: 30_000,
    // Polling fallback na wypadek gdy realtime jest niedostępny
    refetchInterval: 60_000,
  })

  // Supabase Realtime — nasłuchuje INSERT/UPDATE na project_threads dla projektu
  useEffect(() => {
    if (!projectId || !supabase) return

    const channel = supabase
      .channel(`threads:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_threads',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // Proste revalidation — nie próbujemy patchować cache bo thread ma wiele pól
          void queryClient.invalidateQueries({ queryKey: threadsKey(projectId) })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [projectId, queryClient])

  return query
}
