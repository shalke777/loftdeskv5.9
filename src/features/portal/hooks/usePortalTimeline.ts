import { useQuery }          from '@tanstack/react-query'
import { portalGetTimeline } from '@/features/portal/api/portal-project.api'

/**
 * Fetches timeline events visible to the client (visibility='client_shared').
 * Uses the portal_get_timeline SECURITY DEFINER RPC which validates the session.
 */
export function usePortalTimeline(sessionId: string) {
  return useQuery({
    queryKey:        ['portal-timeline', sessionId],
    queryFn:         () => portalGetTimeline(sessionId),
    enabled:         Boolean(sessionId),
    staleTime:       15_000,
    refetchInterval: 30_000,
  })
}
