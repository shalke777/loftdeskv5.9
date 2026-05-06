/**
 * Typed session result — used by API layer methods that require
 * an active session context (get_session_context() / migration 155).
 *
 * Architecture contract:
 *   - API layer: returns SessionResult<T>, NEVER throws for session errors
 *   - Hook layer (queries): { ok: false } → return null (soft failure, no crash)
 *   - Hook layer (mutations): { ok: false } → re-throw for TanStack onError (toast)
 *   - Components: unchanged — receive T | null | undefined as before
 *
 * This isolates session-context failures from DB/network errors:
 *   SESSION_CONTEXT_MISSING  → user has no company context (onboarding edge case)
 *   UNKNOWN_ERROR            → unexpected error during session read
 */

export type SessionError = 'SESSION_CONTEXT_MISSING' | 'UNKNOWN_ERROR'

export type SessionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SessionError }

/** Wrap a successful value. */
export function sessionOk<T>(data: T): SessionResult<T> {
  return { ok: true, data }
}

/** Signal a missing session context (never throws). */
export function sessionMissing<T = never>(): SessionResult<T> {
  return { ok: false, error: 'SESSION_CONTEXT_MISSING' }
}
