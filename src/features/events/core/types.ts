// =============================================================================
// types.ts — canonical GlobalEvent type for Event Intelligence Layer
//
// GlobalEvent is the global contract for all events in LoftDesk.
// It is structurally equivalent to ProjectStreamEvent but adds:
//   · projectId — enables cross-project aggregation in future phases
//   · causedBy  — added in Commit 4 / eventGraph phase (type already defined)
//
// Consumers:
//   · useGlobalEventStream (current scope: single project via existing hooks)
//   · ActivityFlowDashboard (future: multi-project)
//   · AI summarization layer (future)
// =============================================================================

import type {
  ProjectTimelineEvent,
  ProjectThread,
  CostApproval,
} from '@/features/portal/model/project-portal.types'

export type GlobalEventType     = 'timeline' | 'message' | 'approval'
export type GlobalEventSeverity = 'info' | 'warning' | 'success'

/**
 * Describes the event that causally triggered this one.
 * Populated only when a real FK exists in the source data — never fabricated.
 *
 * Sources:
 *   · CostApproval.thread_id                         → approval.causedBy = { type:'message', id }
 *   · TimelineEvent.reference_type === 'approval'     → causedBy = { type:'approval', id }
 *   · TimelineEvent.reference_type === 'message'|'thread' → causedBy = { type:'message', id }
 */
export interface GlobalEventCausedBy {
  type: GlobalEventType
  id:   string
}

/**
 * Canonical normalized event — the single type for the Event Intelligence Layer.
 *
 * id format: "{prefix}:{entityId}"
 *   · "tl:{uuid}"  for timeline events
 *   · "msg:{uuid}" for threads / messages
 *   · "ap:{uuid}"  for cost approvals
 */
export interface GlobalEvent {
  id:        string
  projectId: string
  type:      GlobalEventType
  createdAt: string
  payload:   ProjectTimelineEvent | ProjectThread | CostApproval
  severity:  GlobalEventSeverity
  /** Causal parent event — undefined when no real FK relationship exists */
  causedBy?: GlobalEventCausedBy
}

// ─── Payload narrowers ────────────────────────────────────────────────────────

export function asGlobalTimeline(ev: GlobalEvent): ProjectTimelineEvent {
  return ev.payload as ProjectTimelineEvent
}

export function asGlobalThread(ev: GlobalEvent): ProjectThread {
  return ev.payload as ProjectThread
}

export function asGlobalApproval(ev: GlobalEvent): CostApproval {
  return ev.payload as CostApproval
}
