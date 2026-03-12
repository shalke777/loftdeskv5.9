// =============================================================================
// timelineMeta.ts — UI metadata for project_timeline_events
// =============================================================================
// Maps event_type strings to icon / label / color / filter category.
// Also provides human-readable text builders for event title + description.
// Used by both the operator timeline (ProjectTimelineTab) and the portal
// client view (PortalUpdatesTab).
// =============================================================================

import type { ProjectTimelineEvent, TimelineEventType } from '@/features/portal/model/project-portal.types'

// ─── Filter categories ───────────────────────────────────────────────────────

export type TimelineFilterCategory = 'all' | 'communication' | 'costs' | 'approvals' | 'portal'

export const FILTER_LABELS: Record<TimelineFilterCategory, string> = {
  all:           'Wszystkie',
  communication: '💬 Komunikacja',
  costs:         '💰 Koszty',
  approvals:     '✅ Akceptacje',
  portal:        '🔗 Portal',
}

// ─── Per-type metadata ───────────────────────────────────────────────────────

export interface TimelineEventMeta {
  /** Emoji icon (for inline use) */
  icon:     string
  /** Short human label for the event type */
  label:    string
  /** HSL/hex color for the timeline dot */
  dotColor: string
  /** Soft background color for the dot / badge */
  bgColor:  string
  /** Filter category this event belongs to */
  category: TimelineFilterCategory
}

const METADATA: Record<string, TimelineEventMeta> = {
  // ── Koszty ──────────────────────────────────────────────────────────────
  cost_added: {
    icon: '💰', label: 'Dodano koszt',
    dotColor: '#f59e0b', bgColor: '#fef3c7', category: 'costs',
  },
  cost_updated: {
    icon: '✏️', label: 'Zaktualizowano koszt',
    dotColor: '#f59e0b', bgColor: '#fef3c7', category: 'costs',
  },
  cost_deleted: {
    icon: '🗑️', label: 'Usunięto koszt',
    dotColor: '#ef4444', bgColor: '#fef2f2', category: 'costs',
  },

  // ── Akceptacje ───────────────────────────────────────────────────────────
  cost_approval_sent: {
    icon: '📤', label: 'Wysłano do akceptacji klienta',
    dotColor: '#8b5cf6', bgColor: '#ede9fe', category: 'approvals',
  },
  cost_approved: {
    icon: '✅', label: 'Klient zaakceptował koszt',
    dotColor: '#10b981', bgColor: '#d1fae5', category: 'approvals',
  },
  cost_rejected: {
    icon: '❌', label: 'Klient odrzucił koszt',
    dotColor: '#ef4444', bgColor: '#fef2f2', category: 'approvals',
  },
  cost_questioned: {
    icon: '❓', label: 'Klient zadał pytanie do kosztu',
    dotColor: '#3b82f6', bgColor: '#dbeafe', category: 'approvals',
  },
  cost_approval_status_changed: {
    icon: '🔄', label: 'Zmiana statusu akceptacji',
    dotColor: '#6b7280', bgColor: '#f3f4f6', category: 'approvals',
  },

  // ── Komunikacja ──────────────────────────────────────────────────────────
  message_sent: {
    icon: '💬', label: 'Wiadomość wysłana do klienta',
    dotColor: '#4f46e5', bgColor: '#ede9fe', category: 'communication',
  },
  client_replied: {
    icon: '↩️', label: 'Klient odpowiedział',
    dotColor: '#4f46e5', bgColor: '#ede9fe', category: 'communication',
  },

  // ── Portal ───────────────────────────────────────────────────────────────
  portal_activated: {
    icon: '🔗', label: 'Portal klienta aktywowany',
    dotColor: '#10b981', bgColor: '#d1fae5', category: 'portal',
  },
  portal_revoked: {
    icon: '🚫', label: 'Dostęp do portalu cofnięty',
    dotColor: '#ef4444', bgColor: '#fef2f2', category: 'portal',
  },

  // ── Projekt / reszta ─────────────────────────────────────────────────────
  project_created: {
    icon: '🏗️', label: 'Projekt utworzony',
    dotColor: '#94a3b8', bgColor: '#f1f5f9', category: 'all',
  },
  project_status_changed: {
    icon: '📋', label: 'Zmiana statusu projektu',
    dotColor: '#94a3b8', bgColor: '#f1f5f9', category: 'all',
  },
  document_added: {
    icon: '📄', label: 'Dodano dokument',
    dotColor: '#64748b', bgColor: '#f1f5f9', category: 'all',
  },
  document_removed: {
    icon: '🗑️', label: 'Usunięto dokument',
    dotColor: '#ef4444', bgColor: '#fef2f2', category: 'all',
  },
  note_added: {
    icon: '📝', label: 'Dodano notatkę',
    dotColor: '#64748b', bgColor: '#f1f5f9', category: 'all',
  },
}

const FALLBACK: TimelineEventMeta = {
  icon: '📋', label: 'Zdarzenie',
  dotColor: '#94a3b8', bgColor: '#f1f5f9', category: 'all',
}

export function getTimelineEventMeta(eventType: TimelineEventType | string): TimelineEventMeta {
  return METADATA[eventType as string] ?? FALLBACK
}

// ─── Human-readable title ────────────────────────────────────────────────────

/**
 * Returns the best human-readable title for an event.
 * Priority: event.title (set at creation) → meta label → event_type.
 */
export function buildTimelineEventTitle(event: ProjectTimelineEvent): string {
  if (event.title) return event.title
  return getTimelineEventMeta(event.event_type).label
}

// ─── Human-readable description from payload ─────────────────────────────────

/**
 * Builds a supplementary description string from event.description (stored in DB)
 * or by reconstructing from the payload for older events that only have payload.
 * Returns null if nothing meaningful is available.
 */
export function buildTimelineEventDescription(event: ProjectTimelineEvent): string | null {
  if (event.description) return event.description

  const p = event.payload ?? {}
  const parts: string[] = []

  // Cost / approval context
  const vendor = (p.vendor_name ?? p.vendor ?? p.snapshot_vendor) as string | undefined
  const amount = p.gross_amount ?? p.snapshot_amount_gross ?? p.amount_gross
  const currency = (p.currency ?? 'PLN') as string
  const comment  = p.client_comment as string | undefined
  const newStat  = p.new_status as string | undefined
  const docTitle = (p.document_title ?? p.title) as string | undefined
  const bodyPreview = p.body_preview as string | undefined

  if (vendor)  parts.push(vendor)
  if (amount != null && !isNaN(Number(amount))) {
    parts.push(
      `${Number(amount).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} ${currency}`,
    )
  }
  if (comment)    parts.push(`Komentarz: ${comment}`)
  if (newStat)    parts.push(`Status: ${newStat}`)
  if (docTitle)   parts.push(`Dokument: ${docTitle}`)
  if (bodyPreview) parts.push(bodyPreview.slice(0, 80))

  return parts.length > 0 ? parts.join(' · ') : null
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

/** Returns the filter category for a given event_type */
export function getEventCategory(eventType: TimelineEventType | string): TimelineFilterCategory {
  return getTimelineEventMeta(eventType).category
}

/** True when the event matches the active filter */
export function matchesFilter(
  event: ProjectTimelineEvent,
  filter: TimelineFilterCategory,
): boolean {
  if (filter === 'all') return true
  return getEventCategory(event.event_type) === filter
}

// ─── Date formatting ─────────────────────────────────────────────────────────

export function formatTimelineDate(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

export function formatTimelineDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  })
}
