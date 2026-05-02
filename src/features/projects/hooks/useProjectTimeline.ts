import { useQuery }            from '@tanstack/react-query'
import { getProjectTimeline }  from '@/features/projects/api/timeline.api'

/**
 * Fetches ALL timeline events for a project (internal + client_shared).
 * For use by authenticated operators only.
 */
export function useProjectTimeline(projectId: string | null) {
  return useQuery({
    queryKey:        ['project-timeline', projectId],
    queryFn:         () => getProjectTimeline(projectId!, { includeInternal: true, limit: 200 }),
    enabled:         Boolean(projectId),
    staleTime:       15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}
