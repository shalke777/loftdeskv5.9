// =============================================================================
// eventGraph.ts — causal chain resolver for GlobalEvent (Commit 4)
//
// Pure utility — no DOM, no React, no side effects.
//
// Migrates getEventChain / getRelatedEvents from:
//   src/features/projects/lib/eventChain.ts   (ProjectStreamEvent)
// to:
//   src/features/events/core/eventGraph.ts    (GlobalEvent)
//
// The original eventChain.ts is preserved for backward compatibility —
// existing imports in WorkspaceActivityStream still work until Commit 5.
//
// Consumers:
//   · useProjectEventStreamV2 / WorkspaceActivityStream (Commit 5)
//   · ActivityFlowDashboard (future)
//   · AI summarization layer (future)
// =============================================================================

import type { GlobalEvent, GlobalEventType } from './types'

const MAX_DEPTH = 5

// ─── Internal helpers ─────────────────────────────────────────────────────────

const TYPE_TO_PREFIX: Record<GlobalEventType, string> = {
  timeline: 'tl',
  message:  'msg',
  approval: 'ap',
}

/**
 * Build an index from the bare entity UUID (causedBy.id, which has no prefix)
 * to the full GlobalEvent.
 *
 * Stream ids are prefixed ("tl:abc") while causedBy.id stores the bare UUID.
 * This secondary index enables cross-section resolution without string
 * manipulation at every call site.
 */
function buildBareIdIndex(events: GlobalEvent[]): Map<string, GlobalEvent> {
  const map = new Map<string, GlobalEvent>()
  for (const ev of events) {
    const colon = ev.id.indexOf(':')
    if (colon !== -1) map.set(ev.id.slice(colon + 1), ev)
  }
  return map
}

function makeResolver(events: GlobalEvent[]) {
  const byStreamId = new Map(events.map(ev => [ev.id, ev]))
  const byBareId   = buildBareIdIndex(events)
  return (id: string): GlobalEvent | undefined =>
    byStreamId.get(id) ?? byBareId.get(id)
}

// ─── Public: event graph ──────────────────────────────────────────────────────

/**
 * Lightweight graph structure for quick lookup and traversal.
 * Created once per stream snapshot via buildEventGraph.
 */
export interface EventGraph {
  byStreamId: Map<string, GlobalEvent>
  byBareId:   Map<string, GlobalEvent>
  /** Map from bare entity id → set of stream ids that causally depend on it */
  dependents: Map<string, Set<string>>
}

/**
 * Pre-computes lookup structures for the event array.
 * Cheap (O(n)) and intended to be called inside useMemo.
 */
export function buildEventGraph(events: GlobalEvent[]): EventGraph {
  const byStreamId = new Map(events.map(ev => [ev.id, ev]))
  const byBareId   = buildBareIdIndex(events)
  const dependents = new Map<string, Set<string>>()

  for (const ev of events) {
    if (!ev.causedBy) continue
    const parentBareId = ev.causedBy.id
    if (!dependents.has(parentBareId)) dependents.set(parentBareId, new Set())
    dependents.get(parentBareId)!.add(ev.id)
  }

  return { byStreamId, byBareId, dependents }
}

// ─── Public: chain resolver ───────────────────────────────────────────────────

/**
 * Returns the causal chain starting from `eventId`, including the event itself.
 *
 * Order: [root event, causedBy, causedBy.causedBy, ...] — oldest cause last.
 *
 * Rules:
 *   · Follows causedBy links recursively up to MAX_DEPTH (5) steps
 *   · Deduplicates by stream event id — cycles are safe
 *   · Returns [] if eventId is not found in events
 *   · Pure — reads only from the provided array / graph
 *
 * @param eventId  Stream event id (e.g. "tl:abc", "ap:def") or bare entity id
 * @param events   Full event array from useGlobalEventStream / useProjectEventStreamV2
 */
export function getEventChain(
  eventId: string,
  events:  GlobalEvent[],
): GlobalEvent[] {
  if (events.length === 0) return []

  const resolve = makeResolver(events)
  const root    = resolve(eventId)
  if (!root) return []

  const chain: GlobalEvent[] = []
  const seen  = new Set<string>()
  let current: GlobalEvent | undefined = root
  let depth = 0

  while (current && depth < MAX_DEPTH) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    chain.push(current)
    depth++
    current = current.causedBy ? resolve(current.causedBy.id) : undefined
  }

  return chain
}

/**
 * Returns all events that are part of any chain containing the given event
 * (both ancestors via causedBy and descendants that point to this event).
 *
 * Useful for highlighting a full related cluster rather than just the
 * upward causal path.
 *
 * @param eventId  Stream event id (e.g. "tl:abc") or bare entity id
 * @param events   Full event array from useGlobalEventStream / useProjectEventStreamV2
 */
export function getRelatedEvents(
  eventId: string,
  events:  GlobalEvent[],
): GlobalEvent[] {
  if (events.length === 0) return []

  const resolve = makeResolver(events)
  const root    = resolve(eventId)
  if (!root) return []

  const related = new Set<string>()

  // ── Ancestors (upward causal chain) ──────────────────────────────────────
  let current: GlobalEvent | undefined = root
  let depth = 0
  while (current && depth < MAX_DEPTH) {
    if (related.has(current.id)) break
    related.add(current.id)
    depth++
    current = current.causedBy ? resolve(current.causedBy.id) : undefined
  }

  // ── Descendants (events that point to anything in `related` as their cause) ─
  const rootBareId = root.id.slice(root.id.indexOf(':') + 1)
  for (const ev of events) {
    if (!ev.causedBy) continue
    const causedBareId = ev.causedBy.id
    const causedStreamId = `${TYPE_TO_PREFIX[ev.causedBy.type]}:${causedBareId}`
    if (causedBareId === rootBareId || related.has(causedStreamId)) {
      related.add(ev.id)
    }
  }

  return events.filter(ev => related.has(ev.id))
}
