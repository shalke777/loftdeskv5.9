// =============================================================================
// useProjectEventStream — unified event stream for a single project
//
// Merges three data sources:
//   · useProjectTimeline  → ProjectTimelineEvent
//   · useThreads          → ProjectThread  (each thread as a message entry)
//   · useCostApprovals    → CostApproval
//
// All events are normalized into ProjectStreamEvent and sorted by createdAt desc.
// Consumers filter by `type` to populate dedicated UI sections — the
// WorkspaceActivityStream right panel being the primary consumer.
//
// Phase 3B — causal enrichment:
//   causedBy is populated ONLY from real FK fields already present in the DB:
//     · CostApproval.thread_id          → approval causedBy message
//     · TimelineEvent.reference_type === 'approval' → timeline causedBy approval
//     · TimelineEvent.reference_type === 'message'|'thread' → timeline causedBy message
//   All other events have causedBy === undefined. No fake data ever.
//
// NO backend changes — this is a pure frontend aggregation layer.
// =============================================================================

import { useMemo } from 'react'
import type { ProjectTimelineEvent, ProjectThread, CostApproval, ApprovalStatus } from '@/features/portal/model/project-portal.types'
import { useProjectTimeline } from './useProjectTimeline'
import { useThreads } from './useThreads'
import { useCostApprovals } from '@/features/expenses/hooks/useCostApprovals'

// ─── Public types ─────────────────────────────────────────────────────────────

export type StreamEventType = 'timeline' | 'message' | 'approval'
export type StreamSeverity  = 'info' | 'warning' | 'success'

/**
 * Describes the event that causally triggered this one.
 * Only populated when a real FK exists in the source data — never fabricated.
 *
 * Sources:
 *   · CostApproval.thread_id        → approval.causedBy = { type:'message', id:thread_id }
 *   · TimelineEvent.reference_type === 'approval' → causedBy = { type:'approval', id:reference_id }
 *   · TimelineEvent.reference_type === 'message'|'thread' → causedBy = { type:'message', id:reference_id }
 */
export interface StreamCausedBy {
  type: StreamEventType
  id:   string
}

/** Normalized event for the unified activity stream */
export interface ProjectStreamEvent {
  id:        string
  type:      StreamEventType
  createdAt: string
  payload:   ProjectTimelineEvent | ProjectThread | CostApproval
  severity:  StreamSeverity
  /** Causal parent event — undefined when no real FK relationship exists */
  causedBy?: StreamCausedBy
}

// ─── Helper: narrow the payload by type ──────────────────────────────────────

export function asTimelineEvent(ev: ProjectStreamEvent): ProjectTimelineEvent {
  return ev.payload as ProjectTimelineEvent
}
export function asThread(ev: ProjectStreamEvent): ProjectThread {
  return ev.payload as ProjectThread
}
export function asApproval(ev: ProjectStreamEvent): CostApproval {
  return ev.payload as CostApproval
}

// ─── Severity derivations ─────────────────────────────────────────────────────

const TIMELINE_WARNING_TYPES = new Set([
  'cost_rejected', 'doc_rejected', 'portal_revoked', 'document_removed',
])
const TIMELINE_SUCCESS_TYPES = new Set([
  'cost_approved', 'doc_approved', 'portal_activated',
])

function timelineSeverity(ev: ProjectTimelineEvent): StreamSeverity {
  if (TIMELINE_WARNING_TYPES.has(ev.event_type)) return 'warning'
  if (TIMELINE_SUCCESS_TYPES.has(ev.event_type)) return 'success'
  return 'info'
}

function approvalSeverity(status: ApprovalStatus): StreamSeverity {
  if (status === 'pending_client' || status === 'questioned') return 'warning'
  if (status === 'accepted') return 'success'
  return 'info'
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseProjectEventStreamResult {
  /** All events sorted by createdAt desc */
  events:    ProjectStreamEvent[]
  isLoading: boolean
  isError:   boolean
}

export function useProjectEventStream(
  projectId: string | null,
): UseProjectEventStreamResult {
  const timelineQuery  = useProjectTimeline(projectId)
  const threadsQuery   = useThreads(projectId)
  const approvalsQuery = useCostApprovals(projectId)

  const events = useMemo<ProjectStreamEvent[]>(() => {
    const list: ProjectStreamEvent[] = []

    // ── Timeline events ───────────────────────────────────────────────────────
    // causedBy is derived from reference_type + reference_id (real DB FKs):
    //   reference_type='approval'       → this timeline event was caused by a cost approval
    //   reference_type='message'|'thread' → caused by a portal message/thread
    for (const ev of timelineQuery.data ?? []) {
      let causedBy: StreamCausedBy | undefined
      if (ev.reference_id) {
        if (ev.reference_type === 'approval') {
          causedBy = { type: 'approval', id: ev.reference_id }
        } else if (ev.reference_type === 'message' || ev.reference_type === 'thread') {
          causedBy = { type: 'message', id: ev.reference_id }
        }
      }
      list.push({
        id:        `tl:${ev.id}`,
        type:      'timeline',
        createdAt: ev.created_at,
        payload:   ev,
        severity:  timelineSeverity(ev),
        causedBy,
      })
    }

    // ── Thread entries ────────────────────────────────────────────────────────
    // Threads have no causal parent — they are root-level communication events.
    for (const thread of threadsQuery.data ?? []) {
      if (thread.archived) continue
      list.push({
        id:        `msg:${thread.id}`,
        type:      'message',
        createdAt: thread.last_message_at ?? thread.created_at,
        payload:   thread,
        severity:  'info',
        // causedBy intentionally absent — threads are root events
      })
    }

    // ── Cost approvals ────────────────────────────────────────────────────────
    // thread_id is set when the approval was initiated from a discussion thread.
    for (const ap of approvalsQuery.data ?? []) {
      const causedBy: StreamCausedBy | undefined = ap.thread_id
        ? { type: 'message', id: ap.thread_id }
        : undefined
      list.push({
        id:        `ap:${ap.id}`,
        type:      'approval',
        createdAt: ap.created_at,
        payload:   ap,
        severity:  approvalSeverity(ap.status),
        causedBy,
      })
    }

    // Sort all events newest-first
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return list
  }, [timelineQuery.data, threadsQuery.data, approvalsQuery.data])

  return {
    events,
    isLoading: timelineQuery.isLoading || threadsQuery.isLoading || approvalsQuery.isLoading,
    isError:   !!(timelineQuery.isError || threadsQuery.isError || approvalsQuery.isError),
  }
}
