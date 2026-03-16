// =============================================================================
// usePortalNotifications — Faza 4: portal tokenowy wycofany
// =============================================================================
// Tabele portal_messages i client_tokens zostały usunięte w migracji 050.
// Hook zwraca pusty stan — nie ma już legacy wiadomości portalowych.
// Interfejs publiczny zachowany, bo jest importowany w _auth.tsx (nie ruszamy).
// =============================================================================

export interface PortalNotification {
  id: string
  type: 'message' | 'accepted' | 'rejected'
  text: string
  tokenId: string
  clientName: string
  created_at: string
  read: boolean
}

/**
 * Stub — legacy portal_messages usunięte w Fazie 4.
 * Zwraca pusty stan. Sygnatura zachowana dla kompatybilności z _auth.tsx.
 */
export function usePortalNotifications(_userId: string | null) {
  return {
    notifications:  [] as PortalNotification[],
    unreadCount:    0,
    markAllRead:    () => {},
    dbUnreadCount:  0,
  }
}
