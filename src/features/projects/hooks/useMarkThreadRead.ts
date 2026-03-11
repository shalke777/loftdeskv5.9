import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { threadsApi } from '@/features/projects/api/threads.api'
import { messagesKey } from './useThreadMessages'
import { threadsKey } from './useThreads'

/**
 * Oznaczy wiadomości jako przeczytane po stronie operatora.
 *
 * Zabezpieczenie przed pętlą:
 *   markedRef przechowuje ostatni oznaczony threadId.
 *   Wywołanie następuje dokładnie raz przy zmianie threadId.
 *   Nie wywoła się ponownie przy re-renderze z tym samym threadId.
 */
export function useMarkThreadRead(
  threadId: string | null,
  projectId: string | null,
) {
  const companyId   = useCompanyId()
  const queryClient = useQueryClient()
  const markedRef   = useRef<string | null>(null)

  const mutation = useMutation({
    mutationFn: (tId: string) =>
      threadsApi.markThreadRead(tId, 'operator', companyId),
    onSuccess: (_, tId) => {
      // Patchuj cache lokalnie — uniknij dodatkowego fetch
      queryClient.setQueryData<import('@/features/portal/model/project-portal.types').ProjectMessage[]>(
        messagesKey(tId),
        (old = []) =>
          old.map(m =>
            m.sender_type !== 'operator' ? { ...m, read_by_operator: true } : m,
          ),
      )
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: threadsKey(projectId) })
      }
    },
  })

  useEffect(() => {
    if (!threadId || markedRef.current === threadId) return
    markedRef.current = threadId
    mutation.mutate(threadId)
    // mutation is stable — intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])
}
