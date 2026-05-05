// Invite intent storage — v3.
// Bridges /join/<token> → login/register → acceptance.
// Stores full InviteRecord objects so failed tokens can be retried on next login.

export type InviteStatus = 'pending' | 'failed'

export interface InviteRecord {
  token:       string
  status:      InviteStatus
  addedAt:     number
  failReason?: string
}

const INVITE_RECORDS_KEY = 'loftdesk-pending-invite-records'  // v3
const LEGACY_TOKENS_KEY  = 'loftdesk-pending-invite-tokens'   // v2
const LEGACY_SINGLE_KEY  = 'loftdesk-pending-invite-token'    // v1

// ── Internal ─────────────────────────────────────────────────────────────────

function readRecords(): InviteRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(INVITE_RECORDS_KEY)
    if (raw) return JSON.parse(raw) as InviteRecord[]
    // Migrate v2 token-string array.
    const v2 = localStorage.getItem(LEGACY_TOKENS_KEY)
    if (v2) {
      const tokens: string[] = JSON.parse(v2)
      return tokens.map(t => ({ token: t, status: 'pending' as const, addedAt: Date.now() }))
    }
    // Migrate v1 single token.
    const v1 = localStorage.getItem(LEGACY_SINGLE_KEY)
    if (v1) return [{ token: v1, status: 'pending', addedAt: Date.now() }]
    return []
  } catch { return [] }
}

function writeRecords(records: InviteRecord[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(INVITE_RECORDS_KEY, JSON.stringify(records))
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Add (or reset) a token to the pending invite queue. */
export function addPendingInviteToken(token: string): void {
  const records = readRecords()
  const idx = records.findIndex(r => r.token === token)
  if (idx >= 0) {
    records[idx] = { ...records[idx], status: 'pending', addedAt: Date.now(), failReason: undefined }
  } else {
    records.push({ token, status: 'pending', addedAt: Date.now() })
  }
  writeRecords(records)
}

/** Return all stored invite records. */
export function getInviteRecords(): InviteRecord[] {
  return readRecords()
}

/** Update status (and optional failReason) for one record. */
export function updateInviteRecord(token: string, update: Partial<Omit<InviteRecord, 'token'>>): void {
  const records = readRecords()
  const idx = records.findIndex(r => r.token === token)
  if (idx >= 0) {
    records[idx] = { ...records[idx], ...update }
    writeRecords(records)
  }
}

/** Remove a set of tokens (e.g. after successful acceptance). */
export function removeInviteTokens(tokens: Set<string>): void {
  if (typeof window === 'undefined') return
  const remaining = readRecords().filter(r => !tokens.has(r.token))
  if (remaining.length === 0) clearInviteRecords()
  else writeRecords(remaining)
}

/** Clear all invite records and all legacy keys. */
export function clearInviteRecords(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(INVITE_RECORDS_KEY)
  localStorage.removeItem(LEGACY_TOKENS_KEY)
  localStorage.removeItem(LEGACY_SINGLE_KEY)
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** SHA-256 the token and return first 16 hex chars (safe to log). */
export async function hashToken(token: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  } catch {
    return token.slice(0, 8) + '…'
  }
}

/** Wrap a promise with a 10-second timeout. Rejects with INVITE_ACCEPT_TIMEOUT on expiry. */
export function withInviteTimeout<T>(promise: Promise<T>): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('INVITE_ACCEPT_TIMEOUT')), 10_000)
  )
  return Promise.race([promise, timeout])
}

// ── Backward-compat aliases ────────────────────────────────────────────────────
/** @deprecated Use addPendingInviteToken */
export const setPendingInviteToken = addPendingInviteToken
/** @deprecated Use getInviteRecords */
export function getPendingInviteTokens(): string[] { return getInviteRecords().map(r => r.token) }
/** @deprecated Use getInviteRecords */
export function getPendingInviteToken(): string | null { return getInviteRecords()[0]?.token ?? null }
/** @deprecated Use clearInviteRecords */
export const clearPendingInviteTokens = clearInviteRecords
/** @deprecated Use clearInviteRecords */
export const clearPendingInviteToken = clearInviteRecords
