import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { threadsApi } from '@/features/projects/api/threads.api'
import { threadsKey } from './useThreads'

/**
 * Mutacja usuwania wątku przez operatora.
 *
 * Po sukcesie invaliduje:
 *  - inbox-threads  (globalna lista w ChatPage)
 *  - project-threads (lista w ProjectThreadsTab)
 */
export function useDeleteThread() {
  const companyId   = useCompanyId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (threadId: string) => threadsApi.deleteThread(threadId, companyId),
    onSuccess: (_data, threadId) => {
      void queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      // project-threads klucze zawierają projectId — inwaliduj wszystkie
      void queryClient.invalidateQueries({ queryKey: ['project-threads'] })
      console.info('CHAT_THREAD_DELETED', { threadId })
    },
  })
}
