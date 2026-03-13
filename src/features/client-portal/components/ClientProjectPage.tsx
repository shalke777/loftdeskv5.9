// =============================================================================
// ClientProjectPage — szczegóły projektu w portalu klienta (v6.0)
// =============================================================================
// Zakładki: Dokumenty | Chat | Akceptacje | Oś czasu
// =============================================================================

import { useState } from 'react'
import {
  useClientProject,
  useClientEstimates,
  useClientInvoices,
  useClientContracts,
  useClientMessages,
  useClientSendMessage,
  useClientApprovals,
  useClientRespondApproval,
} from '@/features/client-portal/hooks/useClientPortal'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { Badge } from '@/shared/ui/Badge/Badge'
import type { ClientEstimate, ClientInvoice, ClientContract, ClientApproval, ClientMessage } from '@/features/client-portal/api/client-portal.api'

// ── Status labels ─────────────────────────────────────────────────────────────

const ESTIMATE_STATUS: Record<string, string> = {
  draft:    'Szkic',
  sent:     'Wysłana',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
}

const INVOICE_STATUS: Record<string, string> = {
  draft:    'Szkic',
  issued:   'Wystawiona',
  sent:     'Wysłana',
  paid:     'Opłacona',
  overdue:  'Przeterminowana',
  cancelled:'Anulowana',
}

const CONTRACT_STATUS: Record<string, string> = {
  draft:     'Szkic',
  sent:      'Wysłana',
  signed:    'Podpisana',
  cancelled: 'Anulowana',
}

const APPROVAL_STATUS_LABEL: Record<string, string> = {
  pending:    'Oczekuje',
  accepted:   'Zaakceptowane',
  rejected:   'Odrzucone',
  questioned: 'Zapytanie',
}

const APPROVAL_STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending:    'warning',
  accepted:   'success',
  rejected:   'danger',
  questioned: 'default',
}

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  offer:     'default',
  active:    'warning',
  done:      'success',
  cancelled: 'danger',
}

const STATUS_LABEL: Record<string, string> = {
  offer:     'Wycena',
  active:    'W realizacji',
  done:      'Zakończony',
  cancelled: 'Anulowany',
}

// ── Typ zakładki ──────────────────────────────────────────────────────────────

type TabKey = 'documents' | 'chat' | 'approvals' | 'timeline'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'documents',  label: 'Dokumenty' },
  { key: 'chat',       label: 'Chat' },
  { key: 'approvals',  label: 'Akceptacje' },
  { key: 'timeline',   label: 'Oś czasu' },
]

// ── Zakładka Dokumenty ────────────────────────────────────────────────────────

function DocumentsTab({ projectId }: { projectId: string }) {
  const { data: estimates, isLoading: loadingEst } = useClientEstimates(projectId)
  const { data: invoices,  isLoading: loadingInv } = useClientInvoices(projectId)
  const { data: contracts, isLoading: loadingCon } = useClientContracts(projectId)

  const loading = loadingEst || loadingInv || loadingCon

  if (loading) return <div className="client-tab-loading">Ładowanie dokumentów...</div>

  return (
    <div className="client-docs">
      {/* Wyceny */}
      <section className="client-docs__section">
        <h4 className="client-docs__section-title">Wyceny</h4>
        {!estimates?.length ? (
          <p className="client-docs__empty">Brak wycen</p>
        ) : (
          <ul className="client-docs__list">
            {estimates.map((e: ClientEstimate) => (
              <li key={e.id} className="client-docs__row">
                <div>
                  <span className="client-docs__row-number">{e.number}</span>
                  <span className="client-docs__row-name">{e.name}</span>
                </div>
                <div className="client-docs__row-right">
                  <span className="client-docs__row-amount">
                    {e.total_gross?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                  </span>
                  <Badge variant="default">{ESTIMATE_STATUS[e.status] ?? e.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Umowy */}
      <section className="client-docs__section">
        <h4 className="client-docs__section-title">Umowy</h4>
        {!contracts?.length ? (
          <p className="client-docs__empty">Brak umów</p>
        ) : (
          <ul className="client-docs__list">
            {contracts.map((c: ClientContract) => (
              <li key={c.id} className="client-docs__row">
                <div>
                  <span className="client-docs__row-number">{c.number}</span>
                  <span className="client-docs__row-name">{c.name}</span>
                </div>
                <Badge variant="default">{CONTRACT_STATUS[c.status] ?? c.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Faktury */}
      <section className="client-docs__section">
        <h4 className="client-docs__section-title">Faktury</h4>
        {!invoices?.length ? (
          <p className="client-docs__empty">Brak faktur</p>
        ) : (
          <ul className="client-docs__list">
            {invoices.map((inv: ClientInvoice) => (
              <li key={inv.id} className="client-docs__row">
                <div>
                  <span className="client-docs__row-number">{inv.number}</span>
                  <span className="client-docs__row-date">{inv.issue_date}</span>
                </div>
                <div className="client-docs__row-right">
                  <span className="client-docs__row-amount">
                    {inv.total_gross?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                  </span>
                  <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : 'default'}>
                    {INVOICE_STATUS[inv.status] ?? inv.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Zakładka Chat ─────────────────────────────────────────────────────────────

function ChatTab({ projectId }: { projectId: string }) {
  const { user } = useAuth()
  const companyId = useCompanyId()
  const [body, setBody] = useState('')
  const { data: messages, isLoading } = useClientMessages(projectId)
  const senderName = user?.fullName || user?.email || 'Klient'
  const sendMessage = useClientSendMessage(projectId, companyId ?? '', senderName)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || !companyId) return
    await sendMessage.mutateAsync(trimmed)
    setBody('')
  }

  if (isLoading) return <div className="client-tab-loading">Ładowanie wiadomości...</div>

  return (
    <div className="client-chat">
      <div className="client-chat__messages">
        {!messages?.length ? (
          <div className="client-chat__empty">
            <p>Brak wiadomości. Napisz pierwszą!</p>
          </div>
        ) : (
          messages.map((msg: ClientMessage) => (
            <div
              key={msg.id}
              className={`client-chat__msg ${msg.sender_type === 'client' ? 'client-chat__msg--mine' : 'client-chat__msg--theirs'}`}
            >
              {msg.sender_type !== 'client' && (
                <span className="client-chat__msg-sender">{msg.sender_name ?? 'Wykonawca'}</span>
              )}
              <div className="client-chat__msg-bubble">{msg.body}</div>
              <span className="client-chat__msg-time">
                {new Date(msg.created_at).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))
        )}
      </div>
      <form className="client-chat__form" onSubmit={handleSend}>
        <input
          className="client-chat__input"
          placeholder="Napisz wiadomość..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
        />
        <button
          type="submit"
          className="client-chat__send"
          disabled={!body.trim() || sendMessage.isPending}
        >
          {sendMessage.isPending ? '...' : 'Wyślij'}
        </button>
      </form>
    </div>
  )
}

// ── Zakładka Akceptacje ───────────────────────────────────────────────────────

function ApprovalsTab({ projectId }: { projectId: string }) {
  const { data: approvals, isLoading } = useClientApprovals(projectId)
  const respondMutation = useClientRespondApproval(projectId)
  const [comments, setComments] = useState<Record<string, string>>({})

  if (isLoading) return <div className="client-tab-loading">Ładowanie akceptacji...</div>

  if (!approvals?.length) {
    return <div className="client-tab-empty"><p>Brak pozycji do zaakceptowania.</p></div>
  }

  return (
    <div className="client-approvals">
      {approvals.map((approval: ClientApproval) => (
        <div key={approval.id} className="client-approval-card">
          <div className="client-approval-card__header">
            <h4 className="client-approval-card__title">{approval.title}</h4>
            <Badge variant={APPROVAL_STATUS_VARIANT[approval.status] ?? 'default'}>
              {APPROVAL_STATUS_LABEL[approval.status] ?? approval.status}
            </Badge>
          </div>

          {approval.description && (
            <p className="client-approval-card__desc">{approval.description}</p>
          )}

          {approval.amount != null && (
            <p className="client-approval-card__amount">
              Kwota: <strong>{approval.amount.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</strong>
            </p>
          )}

          {approval.status === 'pending' && (
            <div className="client-approval-card__actions">
              <input
                className="client-approval-card__comment"
                placeholder="Komentarz (opcjonalnie)..."
                value={comments[approval.id] ?? ''}
                onChange={(e) => setComments((prev) => ({ ...prev, [approval.id]: e.target.value }))}
              />
              <div className="client-approval-card__btns">
                <button
                  className="client-approval-card__btn client-approval-card__btn--accept"
                  onClick={() => respondMutation.mutate({ id: approval.id, status: 'accepted', comment: comments[approval.id] })}
                  disabled={respondMutation.isPending}
                >
                  Akceptuję
                </button>
                <button
                  className="client-approval-card__btn client-approval-card__btn--question"
                  onClick={() => respondMutation.mutate({ id: approval.id, status: 'questioned', comment: comments[approval.id] })}
                  disabled={respondMutation.isPending}
                >
                  Mam pytanie
                </button>
                <button
                  className="client-approval-card__btn client-approval-card__btn--reject"
                  onClick={() => respondMutation.mutate({ id: approval.id, status: 'rejected', comment: comments[approval.id] })}
                  disabled={respondMutation.isPending}
                >
                  Odrzucam
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Zakładka Oś czasu ─────────────────────────────────────────────────────────

function TimelineTab({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<Array<{ id: string; body: string; created_at: string; event_type: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Import supabase directly — portal timeline uses project_timeline_events with RLS
  // RLS (migr. 042) ensures client can only see visibility='client_shared' events
  useState(() => {
    import('@/shared/lib/supabase').then(({ supabase }) => {
      if (!supabase) { setLoading(false); return }
      supabase
        .from('project_timeline_events')
        .select('id, body, event_type, created_at')
        .eq('project_id', projectId)
        .eq('visibility', 'client_shared')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data, error: err }) => {
          if (err) { setError(true) } else { setEvents(data ?? []) }
          setLoading(false)
        })
    })
  })

  if (loading) return <div className="client-tab-loading">Ładowanie historii...</div>
  if (error)   return <div className="client-tab-empty"><p>Nie udało się załadować osi czasu.</p></div>
  if (!events.length) return <div className="client-tab-empty"><p>Brak wpisów na osi czasu.</p></div>

  return (
    <ul className="client-timeline">
      {events.map((ev) => (
        <li key={ev.id} className="client-timeline__item">
          <span className="client-timeline__dot" />
          <div className="client-timeline__content">
            <p className="client-timeline__body">{ev.body}</p>
            <span className="client-timeline__date">
              {new Date(ev.created_at).toLocaleString('pl-PL', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ── Główny komponent ──────────────────────────────────────────────────────────

interface Props {
  projectId: string
}

export function ClientProjectPage({ projectId }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('documents')
  const { data: project, isLoading } = useClientProject(projectId)

  if (isLoading) {
    return <div className="client-page-loading">Ładowanie projektu...</div>
  }

  if (!project) {
    return (
      <div className="client-page-error">
        <p>Projekt nie istnieje lub nie masz do niego dostępu.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Nagłówek projektu */}
      <div className="client-project-header">
        <div className="client-project-header__meta">
          <span className="client-project-header__number">{project.number}</span>
          <Badge variant={STATUS_BADGE[project.status] ?? 'default'}>
            {STATUS_LABEL[project.status] ?? project.status}
          </Badge>
        </div>
        <h2 className="client-project-header__name">{project.name}</h2>
        {(project.address || project.investment_address) && (
          <p className="client-project-header__address">
            📍 {project.investment_address || project.address}
          </p>
        )}
        {(project.start_date || project.end_date) && (
          <div className="client-project-header__dates">
            {project.start_date && <span>Od: {project.start_date}</span>}
            {project.end_date   && <span>Do: {project.end_date}</span>}
          </div>
        )}
      </div>

      {/* Zakładki */}
      <div className="client-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`client-tab${activeTab === tab.key ? ' client-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Zawartość zakładki */}
      <div className="client-tab-panel">
        {activeTab === 'documents'  && <DocumentsTab  projectId={projectId} />}
        {activeTab === 'chat'       && <ChatTab        projectId={projectId} />}
        {activeTab === 'approvals'  && <ApprovalsTab   projectId={projectId} />}
        {activeTab === 'timeline'   && <TimelineTab    projectId={projectId} />}
      </div>
    </div>
  )
}
