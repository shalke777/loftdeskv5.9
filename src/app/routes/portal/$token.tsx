import { PortalPage } from '@/features/portal/components/PortalPage'

/**
 * Router entry for /portal/:token
 *
 * Phase 2 PortalProjectPage (usePortalSession stub) removed — it always
 * rendered <PortalInvalid /> because project_portal_tokens was dropped in
 * migration 051. Legacy estimate portal (PortalPage) is the active handler:
 * it calls portal_get_by_token RPC (migration 026) against client_tokens,
 * which is still live in production.
 */
export function PortalTokenRoutePage() {
  return <PortalPage />
}
