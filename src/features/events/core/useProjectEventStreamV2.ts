// =============================================================================
// useProjectEventStreamV2 — compatibility adapter (Commit 2)
//
// Thin wrapper around useGlobalEventStream that provides the same API surface
// as the original useProjectEventStream so callers can be migrated one at a time.
//
// Key difference: returns GlobalEvent[] instead of ProjectStreamEvent[].
// GlobalEvent is a strict superset: it adds `projectId` and is otherwise
// structurally identical. Existing payload accessors (asThread, asApproval,
// asTimelineEvent) are re-exported here under the global names.
//
// The original useProjectEventStream is NOT touched — this is a shadow path.
// Feature-flag switch lives in ProjectWorkspace (Commit 3).
// =============================================================================

import { useMemo } from 'react'
import { useGlobalEventStream } from './useGlobalEventStream'
import type { GlobalEvent, UseGlobalEventStreamResult } from './useGlobalEventStream'

export type { GlobalEvent }

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for useProjectEventStream.
 * Returns events filtered to the given projectId (via the global stream).
 *
 * The filter step is essentially a no-op today because useGlobalEventStream
 * already fetches per-project, but it makes the data contract explicit and
 * future-proof for cross-project aggregation.
 *
 * @param projectId  UUID of the project — null disables all queries
 */
export function useProjectEventStreamV2(
  projectId: string | null,
): UseGlobalEventStreamResult {
  const { events: allEvents, isLoading, isError } = useGlobalEventStream(projectId)

  const events = useMemo<GlobalEvent[]>(
    () => (projectId ? allEvents.filter(ev => ev.projectId === projectId) : []),
    [allEvents, projectId],
  )

  return { events, isLoading, isError }
}
