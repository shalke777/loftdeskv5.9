import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isDemoMode, supabase } from '@/shared/lib/supabase'

interface InboxMsg {
  id: string
  token_id: string
  sender: string
  content: string
  read: boolean
  created_at: string
}

async function fetchInboxMessages(): Promise<InboxMsg[]> {
  if (isDemoMode || !supabase) return []
  const { data, error } = await supabase
    .from('portal_messages')
    .select('id, token_id, sender, content, read, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return []
  return (data ?? []) as InboxMsg[]
}

export interface PortalTokenStats {
  unreadByToken: Record<string, number>
  lastByToken: Record<string, { content: string; created_at: string; sender: string }>
}

/**
 * Polls portal_messages every 15 s to compute per-token unread counts
 * and last-message previews for the Portal Inbox page.
 */
export function usePortalInbox(companyId: string): PortalTokenStats {
  const { data: messages = [] } = useQuery({
    queryKey: ['portal-inbox', companyId],
    queryFn: fetchInboxMessages,
    enabled: Boolean(companyId) && !isDemoMode && Boolean(supabase),
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  })

  return useMemo(() => {
    const unreadByToken: Record<string, number> = {}
    const lastByToken: Record<string, { content: string; created_at: string; sender: string }> = {}
    for (const msg of messages) {
      // First message per token (array is sorted newest first) = last message
      if (!lastByToken[msg.token_id]) {
        lastByToken[msg.token_id] = {
          content: msg.content,
          created_at: msg.created_at,
          sender: msg.sender,
        }
      }
      if (!msg.read && msg.sender === 'client') {
        unreadByToken[msg.token_id] = (unreadByToken[msg.token_id] ?? 0) + 1
      }
    }
    return { unreadByToken, lastByToken }
  }, [messages])
}
