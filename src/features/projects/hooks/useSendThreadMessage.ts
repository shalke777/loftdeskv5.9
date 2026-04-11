import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { threadsApi, type SendThreadMessageInput } from '@/features/projects/api/threads.api'
import { useToast } from '@/shared/hooks/useToast'
import { messagesKey } from './useThreadMessages'
import { threadsKey } from './useThreads'
import type { ProjectMessage } from '@/features/portal/model/project-portal.types'

/**
 * Mutacja wysyłania wiadomości przez operatora.
 *
 * Po sukcesie:
 *  1. setQueryData → natychmiastowe dodanie wiadomości do cache (zero opóźnienia)
 *  2. invalidateQueries thread-messages → sync z serwerem w tle
 *  3. invalidateQueries project-threads → odświeżenie last_message_preview i unread count
 */
export function useSendThreadMessage(projectId: string | null) {
  const companyId   = useCompanyId()
  const { user }    = useAuth()
  const queryClient = useQueryClient()
  const toast       = useToast()

  return useMutation({
    mutationFn: (input: SendThreadMessageInput) =>
      threadsApi.sendMessage(input, companyId, user?.fullName ?? user?.email ?? undefined),
    onMutate: async (input) => {
      // Blokuj realtime update podczas mutacji — patrz useThreadMessages
      queryClient.setMutationDefaults(messagesKey(input.thread_id), {})
    },
    onSuccess: (message: ProjectMessage, input) => {
      // Natychmiastowe dodanie wiadomości do cache — bez czekania na refetch
      queryClient.setQueryData<ProjectMessage[]>(
        messagesKey(input.thread_id),
        (old = []) => old.some(m => m.id === message.id) ? old : [...old, message],
      )
    },
    onSettled: (_, __, input) => {
      void queryClient.invalidateQueries({ queryKey: messagesKey(input.thread_id) })
      void queryClient.invalidateQueries({ queryKey: threadsKey(input.project_id) })
    },
    onError: (error: any) => {
      toast.error('Nie udało się wysłać wiadomości', error?.message ?? 'Sprawdź połączenie i spróbuj ponownie')
      console.error('[chat] sendMessage error:', error)
    },
  })
}
