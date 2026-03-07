const INVITE_INTENT_KEY = "loftdesk-pending-invite-token"

export function setPendingInviteToken(token: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(INVITE_INTENT_KEY, token)
}

export function getPendingInviteToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(INVITE_INTENT_KEY)
}

export function clearPendingInviteToken() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(INVITE_INTENT_KEY)
}
