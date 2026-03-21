import { PortalInvalid } from '@/features/portal/components/PortalInvalid'

/**
 * Router entry for /portal/:token
 *
 * Legacy estimate portal (PortalPage) removed — active_client_tokens = 0.
 * All tokens (including historically created ones) are expired/inactive.
 * Render the expired-link screen for any remaining legacy URLs.
 */
export function PortalTokenRoutePage() {
  return <PortalInvalid />
}
