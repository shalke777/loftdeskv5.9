// =============================================================================
// mappers.ts — pure transformation functions for Event Intelligence Layer
//
// Each mapper converts raw API data into the canonical GlobalEvent type.
// These are intentionally pure: no React, no hooks, no DOM.
//
// Severity derivations match the existing useProjectEventStream logic exactly,
// ensuring zero behavioral difference when GlobalEvent replaces ProjectStreamEvent.
// =============================================================================

import type {
  ProjectTimelineEvent,
  ProjectThread,
  CostApproval,
  ApprovalStatus,
} from '@/features/portal/model/project-portal.types'
import type { GlobalEvent, GlobalEventCausedBy, GlobalEventType } from './types'

// ─── Severity helpers ─────────────────────────────────────────────────────────

const TIMELINE_WARNING = new Set([
  'cost_rejected', 'doc_rejected', 'portal_revoked', 'document_removed',
])
const TIMELINE_SUCCESS = new Set([
  'cost_approved', 'doc_approved', 'portal_activated',
])

function timelineSeverity(ev: ProjectTimelineEvent): GlobalEvent['severity'] {
  if (TIMELINE_WARNING.has(ev.event_type)) return 'warning'
  if (TIMELINE_SUCCESS.has(ev.event_type)) return 'success'
  return 'info'
}

function approvalSeverity(status: ApprovalStatus): GlobalEvent['severity'] {
  if (status === 'pending_client' || status === 'questioned') return 'warning'
  if (status === 'accepted') return 'success'
  return 'info'
}

// ─── Public mappers ───────────────────────────────────────────────────────────

/**
 * Maps raw ProjectTimelineEvent[] → GlobalEvent[].
 *
 * causedBy is derived only from real DB FK fields:
 *   reference_type='approval'        → causedBy approval
 *   reference_type='message'|'thread' → causedBy message
 */
export function mapTimeline(events: ProjectTimelineEvent[]): GlobalEvent[] {
  const out: GlobalEvent[] = []
  for (const ev of events) {
    let causedBy: GlobalEventCausedBy | undefined
    if (ev.reference_id) {
      if (ev.reference_type === 'approval') {
        causedBy = { type: 'approval', id: ev.reference_id }
      } else if (ev.reference_type === 'message' || ev.reference_type === 'thread') {
        causedBy = { type: 'message', id: ev.reference_id }
      }
    }
    out.push({
      id:        `tl:${ev.id}`,
      projectId: ev.project_id,
      type:      'timeline' as GlobalEventType,
      createdAt: ev.created_at,
      payload:   ev,
      severity:  timelineSeverity(ev),
      causedBy,
    })
  }
  return out
}

/**
 * Maps raw ProjectThread[] → GlobalEvent[].
 * Archived threads are excluded — they represent closed communication.
 * Threads are root events and have no causal parent.
 */
export function mapThreads(threads: ProjectThread[]): GlobalEvent[] {
  const out: GlobalEvent[] = []
  for (const thread of threads) {
    if (thread.archived) continue
    out.push({
      id:        `msg:${thread.id}`,
      projectId: thread.project_id,
      type:      'message' as GlobalEventType,
      createdAt: thread.last_message_at ?? thread.created_at,
      payload:   thread,
      severity:  'info',
      // causedBy intentionally absent — threads are root events
    })
  }
  return out
}

/**
 * Maps raw CostApproval[] → GlobalEvent[].
 * thread_id is a real FK: approval causedBy the discussion thread that triggered it.
 */
export function mapApprovals(approvals: CostApproval[]): GlobalEvent[] {
  const out: GlobalEvent[] = []
  for (const ap of approvals) {
    const causedBy: GlobalEventCausedBy | undefined = ap.thread_id
      ? { type: 'message', id: ap.thread_id }
      : undefined
    out.push({
      id:        `ap:${ap.id}`,
      projectId: ap.project_id,
      type:      'approval' as GlobalEventType,
      createdAt: ap.created_at,
      payload:   ap,
      severity:  approvalSeverity(ap.status),
      causedBy,
    })
  }
  return out
}
