// =============================================================================
// useGlobalEventStream — shadow global event layer (Commit 1)
//
// Aggregates all project events into the GlobalEvent type.
// Currently scoped to a single project (same hooks as useProjectEventStream),
// but the type contract is global-ready: every event carries a projectId so
// future cross-project aggregation requires zero type changes.
//
// NO UI impact — this hook is not yet wired into any component.
// Rollback: simply stop importing this hook.
// =============================================================================

import { useMemo } from 'react'
import { useProjectTimeline } from '@/features/projects/hooks/useProjectTimeline'
import { useThreads }         from '@/features/projects/hooks/useThreads'
import { useCostApprovals }   from '@/features/expenses/hooks/useCostApprovals'
import { mapTimeline, mapThreads, mapApprovals } from './mappers'
import type { GlobalEvent } from './types'

export type { GlobalEvent } from './types'
export type { GlobalEventType, GlobalEventSeverity, GlobalEventCausedBy } from './types'

// ─── Result type ──────────────────────────────────────────────────────────────

export interface UseGlobalEventStreamResult {
  /** All project events, sorted by createdAt DESC */
  events:    GlobalEvent[]
  isLoading: boolean
  isError:   boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns all events for a project as GlobalEvent[].
 *
 * Phase 1 scope: delegates to the three existing per-project hooks.
 * Future scope: can be extended to fetch cross-project feeds without
 * changing the type contract or consumer components.
 *
 * @param projectId  UUID of the project — null disables all queries
 */
export function useGlobalEventStream(
  projectId: string | null,
): UseGlobalEventStreamResult {
  const timelineQuery  = useProjectTimeline(projectId)
  const threadsQuery   = useThreads(projectId)
  const approvalsQuery = useCostApprovals(projectId)

  const events = useMemo<GlobalEvent[]>(() => {
    const timeline  = mapTimeline(timelineQuery.data ?? [])
    const threads   = mapThreads(threadsQuery.data ?? [])
    const approvals = mapApprovals(approvalsQuery.data ?? [])

    const merged = [...timeline, ...threads, ...approvals]
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return merged
  }, [timelineQuery.data, threadsQuery.data, approvalsQuery.data])

  return {
    events,
    isLoading: timelineQuery.isLoading || threadsQuery.isLoading || approvalsQuery.isLoading,
    isError:   !!(timelineQuery.isError || threadsQuery.isError || approvalsQuery.isError),
  }
}
