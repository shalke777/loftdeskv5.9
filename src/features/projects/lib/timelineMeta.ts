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
    dotColor: 'var(--color-accent)', bgColor: 'var(--color-warning-soft)', category: 'costs',
  },
  cost_updated: {
    icon: PenLine, label: 'Zaktualizowano koszt',
    dotColor: 'var(--color-accent)', bgColor: 'var(--color-warning-soft)', category: 'costs',
  },
  cost_deleted: {
    icon: FileX, label: 'Usunięto koszt',
    dotColor: 'var(--color-error)', bgColor: 'var(--color-error-soft)', category: 'costs',
  },

  // ── Akceptacje ───────────────────────────────────────────────────────────
  cost_approval_sent: {
    icon: Send, label: 'Wysłano do akceptacji klienta',
    dotColor: 'var(--color-accent)', bgColor: 'var(--color-accent-soft)', category: 'approvals',
  },
  cost_approved: {
    icon: CheckCircle2, label: 'Klient zaakceptował koszt',
    dotColor: 'var(--color-brand)', bgColor: 'var(--color-success-soft)', category: 'approvals',
  },
  cost_rejected: {
    icon: XCircle, label: 'Klient odrzucił koszt',
    dotColor: 'var(--color-error)', bgColor: 'var(--color-error-soft)', category: 'approvals',
  },
  cost_questioned: {
    icon: CircleHelp, label: 'Klient zadał pytanie do kosztu',
    dotColor: 'var(--color-info)', bgColor: 'var(--color-info-soft)', category: 'approvals',
  },
  cost_approval_status_changed: {
    icon: RefreshCw, label: 'Zmiana statusu akceptacji',
    dotColor: 'var(--color-text-muted)', bgColor: 'var(--color-surface-soft)', category: 'approvals',
  },

  // ── Akceptacje dokumentów ─────────────────────────────────────────────────
  doc_approval_sent: {
    icon: Send, label: 'Wysłano dokument do akceptacji',
    dotColor: 'var(--color-accent)', bgColor: 'var(--color-accent-soft)', category: 'approvals',
  },
  doc_approved: {
    icon: CheckCircle2, label: 'Klient zaakceptował dokument',
    dotColor: 'var(--color-brand)', bgColor: 'var(--color-success-soft)', category: 'approvals',
  },
  doc_rejected: {
    icon: XCircle, label: 'Klient odrzucił dokument',
    dotColor: 'var(--color-error)', bgColor: 'var(--color-error-soft)', category: 'approvals',
  },
  doc_questioned: {
    icon: CircleHelp, label: 'Klient zadał pytanie o dokument',
    dotColor: 'var(--color-info)', bgColor: 'var(--color-info-soft)', category: 'approvals',
  },

  // ── Komunikacja ──────────────────────────────────────────────────────────
  message_sent: {
    icon: MessageSquare, label: 'Wiadomość wysłana do klienta',
    dotColor: 'var(--color-text-muted)', bgColor: 'var(--color-surface-soft)', category: 'communication',
  },
  client_replied: {
    icon: Reply, label: 'Klient odpowiedział',
    dotColor: 'var(--color-text-muted)', bgColor: 'var(--color-surface-soft)', category: 'communication',
  },

  // ── Portal ───────────────────────────────────────────────────────────────
  portal_activated: {
    icon: Globe, label: 'Portal klienta aktywowany',
    dotColor: 'var(--color-brand)', bgColor: 'var(--color-success-soft)', category: 'portal',
  },
  portal_revoked: {
    icon: Link2Off, label: 'Dostęp do portalu cofnięty',
    dotColor: 'var(--color-error)', bgColor: 'var(--color-error-soft)', category: 'portal',
  },

  // ── Projekt / system ─────────────────────────────────────────────────────
  project_created: {
    icon: FolderPlus, label: 'Projekt utworzony',
    dotColor: 'var(--color-text-muted)', bgColor: 'var(--color-surface-soft)', category: 'all',
  },
  project_status_changed: {
    icon: RefreshCw, label: 'Zmiana statusu projektu',
    dotColor: 'var(--color-text-muted)', bgColor: 'var(--color-surface-soft)', category: 'all',
  },
  document_added: {
    icon: FileText, label: 'Dodano dokument',
    dotColor: 'var(--color-text-muted)', bgColor: 'var(--color-surface-soft)', category: 'all',
  },
  document_removed: {
    icon: Trash2, label: 'Usunięto dokument',
    dotColor: 'var(--color-error)', bgColor: 'var(--color-error-soft)', category: 'all',
  },
  note_added: {
    icon: PenLine, label: 'Dodano notatkę',
    dotColor: 'var(--color-text-muted)', bgColor: 'var(--color-surface-soft)', category: 'all',
  },
}

const FALLBACK: TimelineEventMeta = {
  icon: FileText, label: 'Zdarzenie',
  dotColor: 'var(--color-text-muted)', bgColor: 'var(--color-surface-soft)', category: 'all',
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
  const PROJECT_STATUS_PL: Record<string, string> = {
    offer: 'Oferta', active: 'W realizacji', done: 'Zakończony', cancelled: 'Anulowany',
  }

  if (comment)     parts.push(`Komentarz: ${comment}`)
  if (newStat)     parts.push(`Status: ${PROJECT_STATUS_PL[newStat] ?? newStat}`)
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
