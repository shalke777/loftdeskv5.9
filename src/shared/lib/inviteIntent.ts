// Multi-token storage (v2) — handles multiple pending invitations.
// Legacy single-token key kept for backward compatibility with in-flight sessions.
const INVITE_TOKENS_KEY = 'loftdesk-pending-invite-tokens'
const LEGACY_KEY        = 'loftdesk-pending-invite-token'

/** Add a token to the pending invite queue (deduplicates). */
export function addPendingInviteToken(token: string): void {
  if (typeof window === 'undefined') return
  const current = getPendingInviteTokens()
  if (!current.includes(token)) {
    localStorage.setItem(INVITE_TOKENS_KEY, JSON.stringify([...current, token]))
  }
}

/** Backward-compat alias for addPendingInviteToken. */
export const setPendingInviteToken = addPendingInviteToken

/** Return all pending invite tokens. Migrates legacy single-token storage. */
export function getPendingInviteTokens(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(INVITE_TOKENS_KEY)
    if (raw) return JSON.parse(raw) as string[]
    // Migrate legacy single-token entry on first read.
    const legacy = localStorage.getItem(LEGACY_KEY)
    return legacy ? [legacy] : []
  } catch {
    return []
  }
}

/** Backward-compat: return first pending token. */
export function getPendingInviteToken(): string | null {
  return getPendingInviteTokens()[0] ?? null
}

/** Clear all pending invite tokens (both keys). */
export function clearPendingInviteTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(INVITE_TOKENS_KEY)
  localStorage.removeItem(LEGACY_KEY)
}

/** Backward-compat alias for clearPendingInviteTokens. */
export const clearPendingInviteToken = clearPendingInviteTokens
