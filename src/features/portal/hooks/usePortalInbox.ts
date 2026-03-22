// =============================================================================
// usePortalInbox ÔÇö stub
// =============================================================================
// project_portal_tokens table was dropped in migration 051.
// This hook always returns empty data so PortalInboxPage renders with no tokens.
// =============================================================================

export interface PortalLastMessage {
  created_at: string
  sender: 'operator' | 'client'
  content: string
}

export function usePortalInbox(_companyId: string): {
  unreadByToken: Record<string, number>
  lastByToken:   Record<string, PortalLastMessage | null>
} {
  return { unreadByToken: {}, lastByToken: {} }
}
