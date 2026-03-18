// =============================================================================
// usePortalSession ÔÇö stub
// =============================================================================
// project_portal_tokens table was dropped in migration 051 (CASCADE).
// The portal-validate Netlify function was never deployed to production.
//
// This hook permanently returns status='invalid' so PortalProjectPage
// renders <PortalInvalid /> for all /portal/:token requests, which is
// the correct behaviour: old token-based portal URLs no longer work.
//
// Clients now access their portal via the new magic-link flow:
//   send-document.ts Ôćĺ /auth/callback?mode=client&project_id=ÔÇŽ Ôćĺ /client/*
// =============================================================================

export interface PortalSession {
  session_id:  string
  client_name: string | null
  scope:       string[]
  project: {
    number:     string
    name:       string
    address?:   string | null
    status:     string
    start_date?: string | null
    end_date?:   string | null
  } | null
}

export type PortalStatus = 'loading' | 'valid' | 'expired' | 'revoked' | 'error' | 'invalid'

export function usePortalSession(_token: string): {
  status:     PortalStatus
  session:    PortalSession | null
  revalidate: () => void
} {
  // project_portal_tokens dropped ÔÇö all token URLs are permanently invalid.
  return { status: 'invalid', session: null, revalidate: () => {} }
}
