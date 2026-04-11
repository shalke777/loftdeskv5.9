import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { threadsApi, type SendThreadMessageInput } from '@/features/projects/api/threads.api'
import { useToast } from '@/shared/hooks/useToast'
import { messagesKey } from './useThreadMessages'
import { threadsKey } from './useThreads'

/**
 * Mutacja wysyłania wiadomości przez operatora.
 *
 * Po sukcesie:
 *  1. invalidateQueries thread-messages → refetch z serwera (poprawny stan bez optimistic duplikacji)
 *  2. invalidateQueries project-threads → odświeżenie last_message_preview i unread count na liście
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
