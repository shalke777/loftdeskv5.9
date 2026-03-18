// =============================================================================
// usePortalInbox — stub
// =============================================================================
// project_portal_tokens table was dropped in migration 051.
// This hook always returns empty data so PortalInboxPage renders with no tokens.
// =============================================================================

export function usePortalInbox(_companyId: string): {
  unreadByToken: Record<string, number>
  lastByToken:   Record<string, string | null>
} {
  return { unreadByToken: {}, lastByToken: {} }
}
