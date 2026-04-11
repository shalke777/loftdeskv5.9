import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { conversationsApi, type ConversationMessage } from '@/features/chat/api/conversations.api'
import { useToast } from '@/shared/hooks/useToast'

const CONVERSATIONS_KEY = (companyId: string) => ['conversations', companyId] as const
const MESSAGES_KEY = (convId: string) => ['conv-messages', convId] as const

export function useConversations(companyId: string) {
  return useQuery({
    queryKey: CONVERSATIONS_KEY(companyId),
    queryFn: () => conversationsApi.list(companyId),
    enabled: Boolean(companyId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  })
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: MESSAGES_KEY(conversationId ?? ''),
    queryFn: () => conversationsApi.getMessages(conversationId!),
    enabled: Boolean(conversationId),
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
  })
}

export function useSendMessage(companyId: string, conversationId: string | null) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { content: string; sender: 'operator' | 'note'; attachmentUrl?: string; attachmentName?: string }) =>
      conversationsApi.sendMessage({
        conversationId: conversationId!,
        companyId,
        ...input,
      }),
    onSuccess: (message: ConversationMessage) => {
      // Natychmiastowe dodanie wiadomości do cache
      qc.setQueryData<ConversationMessage[]>(
        MESSAGES_KEY(conversationId ?? ''),
        (old = []) => old.some(m => m.id === message.id) ? old : [...old, message],
      )
      void qc.invalidateQueries({ queryKey: MESSAGES_KEY(conversationId ?? '') })
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY(companyId) })
    },
    onError: (err: Error) => {
      toast.error('Błąd wysyłania', err.message)
    },
  })
}

export function useMarkRead(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) =>
      conversationsApi.markRead(conversationId, companyId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY(companyId) })
    },
  })
}

export function useCreateConversation(companyId: string) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: { clientId?: string | null; projectId?: string | null; subject?: string }) =>
      conversationsApi.create({ companyId, ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY(companyId) })
    },
    onError: (err: Error) => {
      toast.error('Błąd tworzenia rozmowy', err.message)
    },
  })
}
