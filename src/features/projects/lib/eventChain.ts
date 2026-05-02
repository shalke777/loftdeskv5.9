// =============================================================================
// eventChain.ts — causal chain resolver for ProjectStreamEvent
//
// Pure utility — no DOM, no React, no side effects.
// Intended consumers:
//   · ActivityFlowDashboard (cross-project chain summaries)
//   · AI summarization layer (future)
//   · Debug / diagnostics tooling
// =============================================================================

import type { ProjectStreamEvent } from '@/features/projects/hooks/useProjectEventStream'

const MAX_DEPTH = 5

/**
 * Build an index from the raw `causedBy.id` value (which is the bare entity id,
 * e.g. a thread uuid or approval uuid) to the full stream event.
 *
 * The stream event ids have a prefix (`tl:`, `msg:`, `ap:`) while causedBy.id
 * stores the bare entity id. We build a secondary lookup keyed by bare id so
 * that cross-section resolution works without string manipulation at call time.
 */
function buildBareIdIndex(events: ProjectStreamEvent[]): Map<string, ProjectStreamEvent> {
  const map = new Map<string, ProjectStreamEvent>()
  for (const ev of events) {
    // The bare entity id is the part after the first ':'
    const colon = ev.id.indexOf(':')
    if (colon !== -1) {
      map.set(ev.id.slice(colon + 1), ev)
    }
  }
  return map
}

/**
 * Returns the causal chain starting from `eventId`, including the event itself.
 *
 * Order: [root event, causedBy, causedBy.causedBy, ...] — oldest cause last.
 *
 * Rules:
 *   · Follows causedBy links recursively up to MAX_DEPTH (5) steps
 *   · Deduplicates by stream event id — cycles are safe
 *   · Returns [] if eventId is not found in events
 *   · Pure — reads only from the provided array, no external state
 *
 * @param eventId  Stream event id (e.g. "tl:abc", "ap:def") or bare entity id
 * @param events   Full event array from useProjectEventStream
 */
export function getEventChain(
  eventId: string,
  events: ProjectStreamEvent[],
): ProjectStreamEvent[] {
  if (events.length === 0) return []

  // Build lookup structures once per call
  const byStreamId  = new Map(events.map(ev => [ev.id, ev]))
  const byBareId    = buildBareIdIndex(events)

  function resolve(id: string): ProjectStreamEvent | undefined {
    return byStreamId.get(id) ?? byBareId.get(id)
  }

  const root = resolve(eventId)
  if (!root) return []

  const chain: ProjectStreamEvent[] = []
  const seen  = new Set<string>()

  let current: ProjectStreamEvent | undefined = root
  let depth = 0

  while (current && depth < MAX_DEPTH) {
    if (seen.has(current.id)) break   // cycle guard
    seen.add(current.id)
    chain.push(current)
    depth++

    const cause: ProjectStreamEvent | undefined = current.causedBy ? resolve(current.causedBy.id) : undefined
    current = cause
  }

  return chain
}

/**
 * Convenience: returns all events that are part of any chain containing
 * the given event (both ancestors and descendants).
 *
 * Useful for highlighting a full related cluster rather than just the
 * upward causal path.
 */
export function getRelatedEvents(
  eventId: string,
  events: ProjectStreamEvent[],
): ProjectStreamEvent[] {
  if (events.length === 0) return []

  const byStreamId = new Map(events.map(ev => [ev.id, ev]))
  const byBareId   = buildBareIdIndex(events)

  function resolve(id: string): ProjectStreamEvent | undefined {
    return byStreamId.get(id) ?? byBareId.get(id)
  }

  const root = resolve(eventId)
  if (!root) return []

  // Collect all stream ids that appear in any chain involving root.
  // We walk upward (ancestors via causedBy) and downward (descendants
  // that list root's bare id in their own causedBy).
  const related = new Set<string>()

  // ── Ancestors (upward causal chain) ──────────────────────────────────────
  let current: ProjectStreamEvent | undefined = root
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
    if (ev.causedBy.id === rootBareId || related.has(`${ev.causedBy.type === 'timeline' ? 'tl' : ev.causedBy.type === 'approval' ? 'ap' : 'msg'}:${ev.causedBy.id}`)) {
      related.add(ev.id)
    }
  }

  return events.filter(ev => related.has(ev.id))
}
