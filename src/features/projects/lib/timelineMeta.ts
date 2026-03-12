// =============================================================================
// timelineMeta.ts — UI metadata for project_timeline_events
// =============================================================================
// Maps event_type strings to icon / label / color / filter category.
// Also provides human-readable text builders for event title + description.
// Used by both the operator timeline (ProjectTimelineTab) and the portal
// client view (PortalUpdatesTab).
//
// ICON SYSTEM: lucide-react (outline, professional, consistent)
// Single central mapping — no per-component switch statements.
// =============================================================================

import {
  Receipt,
  Send,
  CheckCircle2,
  XCircle,
  CircleHelp,
  MessageSquare,
  Reply,
  Globe,
  Link2Off,
  FolderPlus,
  FileText,
  PenLine,
  Trash2,
  RefreshCw,
  FileX,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ProjectTimelineEvent, TimelineEventType } from '@/features/portal/model/project-portal.types'

// ─── Re-export icon type ──────────────────────────────────────────────────────

export type { LucideIcon }

// ─── Filter categories ───────────────────────────────────────────────────────

export type TimelineFilterCategory = 'all' | 'communication' | 'costs' | 'approvals' | 'portal'

export const FILTER_LABELS: Record<TimelineFilterCategory, string> = {
  all:           'Wszystkie',
  communication: 'Komunikacja',
  costs:         'Koszty',
  approvals:     'Akceptacje',
  portal:        'Portal',
}

// ─── Per-type metadata ───────────────────────────────────────────────────────

export interface TimelineEventMeta {
  /** Lucide icon component */
  icon:     LucideIcon
  /** Short human label for the event type */
  label:    string
  /** Color for the icon and dot border */
  dotColor: string
  /** Soft background for the icon bubble */
  bgColor:  string
  /** Filter category this event belongs to */
  category: TimelineFilterCategory
}

const METADATA: Record<string, TimelineEventMeta> = {
  // ── Koszty ──────────────────────────────────────────────────────────────
  cost_added: {
    icon: Receipt, label: 'Dodano koszt',
    dotColor: '#d97706', bgColor: '#fef3c7', category: 'costs',
  },
  cost_updated: {
    icon: PenLine, label: 'Zaktualizowano koszt',
    dotColor: '#d97706', bgColor: '#fef3c7', category: 'costs',
  },
  cost_deleted: {
    icon: FileX, label: 'Usunięto koszt',
    dotColor: '#e11d48', bgColor: '#ffe4e6', category: 'costs',
  },

  // ── Akceptacje ───────────────────────────────────────────────────────────
  cost_approval_sent: {
    icon: Send, label: 'Wysłano do akceptacji klienta',
    dotColor: '#7c3aed', bgColor: '#ede9fe', category: 'approvals',
  },
  cost_approved: {
    icon: CheckCircle2, label: 'Klient zaakceptował koszt',
    dotColor: '#059669', bgColor: '#d1fae5', category: 'approvals',
  },
  cost_rejected: {
    icon: XCircle, label: 'Klient odrzucił koszt',
    dotColor: '#e11d48', bgColor: '#ffe4e6', category: 'approvals',
  },
  cost_questioned: {
    icon: CircleHelp, label: 'Klient zadał pytanie do kosztu',
    dotColor: '#0284c7', bgColor: '#e0f2fe', category: 'approvals',
  },
  cost_approval_status_changed: {
    icon: RefreshCw, label: 'Zmiana statusu akceptacji',
    dotColor: '#52525b', bgColor: '#f4f4f5', category: 'approvals',
  },

  // ── Komunikacja ──────────────────────────────────────────────────────────
  message_sent: {
    icon: MessageSquare, label: 'Wiadomość wysłana do klienta',
    dotColor: '#475569', bgColor: '#f1f5f9', category: 'communication',
  },
  client_replied: {
    icon: Reply, label: 'Klient odpowiedział',
    dotColor: '#475569', bgColor: '#f1f5f9', category: 'communication',
  },

  // ── Portal ───────────────────────────────────────────────────────────────
  portal_activated: {
    icon: Globe, label: 'Portal klienta aktywowany',
    dotColor: '#059669', bgColor: '#d1fae5', category: 'portal',
  },
  portal_revoked: {
    icon: Link2Off, label: 'Dostęp do portalu cofnięty',
    dotColor: '#e11d48', bgColor: '#ffe4e6', category: 'portal',
  },

  // ── Projekt / system ─────────────────────────────────────────────────────
  project_created: {
    icon: FolderPlus, label: 'Projekt utworzony',
    dotColor: '#52525b', bgColor: '#f4f4f5', category: 'all',
  },
  project_status_changed: {
    icon: RefreshCw, label: 'Zmiana statusu projektu',
    dotColor: '#52525b', bgColor: '#f4f4f5', category: 'all',
  },
  document_added: {
    icon: FileText, label: 'Dodano dokument',
    dotColor: '#52525b', bgColor: '#f4f4f5', category: 'all',
  },
  document_removed: {
    icon: Trash2, label: 'Usunięto dokument',
    dotColor: '#e11d48', bgColor: '#ffe4e6', category: 'all',
  },
  note_added: {
    icon: PenLine, label: 'Dodano notatkę',
    dotColor: '#52525b', bgColor: '#f4f4f5', category: 'all',
  },
}

const FALLBACK: TimelineEventMeta = {
  icon: FileText, label: 'Zdarzenie',
  dotColor: '#a1a1aa', bgColor: '#f4f4f5', category: 'all',
}

export function getTimelineEventMeta(eventType: TimelineEventType | string): TimelineEventMeta {
  return METADATA[eventType as string] ?? FALLBACK
}

// ─── Human-readable title ────────────────────────────────────────────────────

export function buildTimelineEventTitle(event: ProjectTimelineEvent): string {
  if (event.title) return event.title
  return getTimelineEventMeta(event.event_type).label
}

// ─── Human-readable description from payload ─────────────────────────────────

export function buildTimelineEventDescription(event: ProjectTimelineEvent): string | null {
  if (event.description) return event.description

  const p = event.payload ?? {}
  const parts: string[] = []

  const vendor = (p.vendor_name ?? p.vendor ?? p.snapshot_vendor) as string | undefined
  const amount = p.gross_amount ?? p.snapshot_amount_gross ?? p.amount_gross
  const currency  = (p.currency ?? 'PLN') as string
  const comment   = p.client_comment as string | undefined
  const newStat   = p.new_status as string | undefined
  const docTitle  = (p.document_title ?? p.title) as string | undefined
  const bodyPreview = p.body_preview as string | undefined

  if (vendor)    parts.push(vendor)
  if (amount != null && !isNaN(Number(amount))) {
    parts.push(`${Number(amount).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} ${currency}`)
  }
  if (comment)     parts.push(`Komentarz: ${comment}`)
  if (newStat)     parts.push(`Status: ${newStat}`)
  if (docTitle)    parts.push(`Dokument: ${docTitle}`)
  if (bodyPreview) parts.push(bodyPreview.slice(0, 80))

  return parts.length > 0 ? parts.join(' · ') : null
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

export function getEventCategory(eventType: TimelineEventType | string): TimelineFilterCategory {
  return getTimelineEventMeta(eventType).category
}

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
