import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { conversationsApi, type ConversationMessage } from '@/features/chat/api/conversations.api'
import { supabase, isDemoMode } from '@/shared/lib/supabase'
import { useToast } from '@/shared/hooks/useToast'

const CONVERSATIONS_KEY = (companyId: string) => ['conversations', companyId] as const
const MESSAGES_KEY = (convId: string) => ['conv-messages', convId] as const

export function useConversations(companyId: string) {
  const queryClient = useQueryClient()

  // Realtime: conversation list updates (new message preview, unread count)
  useEffect(() => {
    if (!companyId || !supabase || isDemoMode) return
    const channel = supabase
      .channel(`conversations:${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `company_id=eq.${companyId}` },
        () => { void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY(companyId) }) },
      )
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [companyId, queryClient])

  return useQuery({
    queryKey: CONVERSATIONS_KEY(companyId),
    queryFn: () => conversationsApi.list(companyId),
    enabled: Boolean(companyId),
    staleTime: 30_000,
    // Polling fallback — only fires if Realtime channel drops
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  })
}

export function useConversationMessages(conversationId: string | null) {
  const queryClient = useQueryClient()

  // Realtime: new messages appear instantly
  useEffect(() => {
    if (!conversationId || !supabase || isDemoMode) return
    const channel = supabase
      .channel(`conv-messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as ConversationMessage
          queryClient.setQueryData<ConversationMessage[]>(
            MESSAGES_KEY(conversationId),
            (old = []) => old.some(m => m.id === newMsg.id) ? old : [...old, newMsg],
          )
        },
      )
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [conversationId, queryClient])

  return useQuery({
    queryKey: MESSAGES_KEY(conversationId ?? ''),
    queryFn: () => conversationsApi.getMessages(conversationId!),
    enabled: Boolean(conversationId),
    staleTime: 10_000,
    // Polling fallback — slower since Realtime is primary
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
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
