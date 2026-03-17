import { useParams } from '@tanstack/react-router'
import { PortalProjectPage } from '@/features/portal/components/PortalProjectPage'
import { PortalPage } from '@/features/portal/components/PortalPage'

/**
 * Router entry for /portal/:token
 *
 * Strategy:
 *   Portal Projektu (Etap 2) uses PortalProjectPage — new project-centric portal.
 *   Legacy estimate portal (PortalPage) is kept as a fallback during transition.
 *
 *   Detection: PortalProjectPage/usePortalSession calls portal-validate.ts which
 *   returns status='not_found' for old estimate tokens → falls back to legacy PortalPage.
 */
export function PortalTokenRoutePage() {
  return <PortalProjectPageWrapper />
}

function PortalProjectPageWrapper() {
  // TanStack Router injects :token from path
  const params = useParams({ strict: false }) as { token?: string }

  if (!params.token) {
    // Fallback — odczyt tokenu z path (legacy behaviour)
    const last = typeof window !== 'undefined'
      ? window.location.pathname.split('/').filter(Boolean).pop()
      : undefined
    if (!last) return <PortalPage />
    return <PortalProjectPage token={last} />
  }

  return <PortalProjectPage token={params.token} />
}
