// =============================================================================
// ClientProjectPage — szczegóły projektu w portalu klienta (v6.0)
// =============================================================================
// Zakładki: Dokumenty | Chat | Akceptacje | Oś czasu
// =============================================================================

import { useState, useEffect, useRef, Fragment } from 'react'
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
  pending_client: 'Oczekuje',
  pending:        'Oczekuje',      // fallback dla starszych rekordów
  accepted:       'Zaakceptowane',
  rejected:       'Odrzucone',
  questioned:     'Zapytanie',
  not_sent:       'Nie wysłano',
}

const APPROVAL_STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending_client: 'warning',
  pending:        'warning',
  accepted:       'success',
  rejected:       'danger',
  questioned:     'default',
  not_sent:       'default',
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

// ── Stage progress rail (shared for operator + client) ───────────────────────

const STAGE_STEPS = [
  { key: 'offer',  label: 'Oferta',      order: 0 },
  { key: 'active', label: 'W realizacji', order: 1 },
  { key: 'done',   label: 'Zakończony',  order: 2 },
]
const STAGE_ORDER: Record<string, number> = { offer: 0, active: 1, done: 2, cancelled: -1 }

const STAGE_HINT: Record<string, string> = {
  offer:  'Wykonawca przygotowuje lub wysłał Ci wycenę projektu.',
  active: 'Trwają prace. Możesz śledzić postęp i akceptować zmiany poniżej.',
  done:   'Projekt jest zakończony. Dziękujemy za zaufanie.',
}

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null
  return new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ProjectStageRail({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <div className="client-stage-rail" style={{ padding: '10px 0' }}>
        <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>⛔ Projekt anulowany</span>
      </div>
    )
  }
  const current = STAGE_ORDER[status] ?? 0
  return (
    <div className="client-stage-rail">
      {STAGE_STEPS.map((step, i) => {
        const isPast    = current > step.order
        const isCurrent = current === step.order
        return (
          <Fragment key={step.key}>
            <div className="client-stage-rail__step">
              <div
                className={`client-stage-rail__dot${isPast ? ' client-stage-rail__dot--past' : isCurrent ? ' client-stage-rail__dot--current' : ' client-stage-rail__dot--future'}`}
              >
                {isPast ? '✓' : ''}
              </div>
              <span className={`client-stage-rail__label${isCurrent ? ' client-stage-rail__label--current' : ''}`}>
                {step.label}
              </span>
            </div>
            {i < STAGE_STEPS.length - 1 && (
              <div
                className={`client-stage-rail__line${current > step.order ? ' client-stage-rail__line--done' : ''}`}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
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
  const { data: estimates, isLoading: loadingEst, isError: errorEst } = useClientEstimates(projectId)
  const { data: invoices,  isLoading: loadingInv, isError: errorInv } = useClientInvoices(projectId)
  const { data: contracts, isLoading: loadingCon, isError: errorCon } = useClientContracts(projectId)

  const loading = loadingEst || loadingInv || loadingCon

  if (loading) return <div className="client-tab-loading">Ładowanie dokumentów...</div>

  return (
    <div className="client-docs">
      {/* Wyceny */}
      <section className="client-docs__section">
        <h4 className="client-docs__section-title">Wyceny</h4>
        {errorEst ? (
          <p className="client-docs__error">Nie udało się załadować wycen.</p>
        ) : !estimates?.length ? (
          <p className="client-docs__empty">Wycena zostanie tu dodana przez wykonawcę.</p>
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
        {errorCon ? (
          <p className="client-docs__error">Nie udało się załadować umów.</p>
        ) : !contracts?.length ? (
          <p className="client-docs__empty">Umowa pojawi się tu po zatwierdzeniu wyceny.</p>
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
        {errorInv ? (
          <p className="client-docs__error">Nie udało się załadować faktur.</p>
        ) : !invoices?.length ? (
          <p className="client-docs__empty">Faktury pojawią się w trakcie realizacji projektu.</p>
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || !companyId) return
    try {
      await sendMessage.mutateAsync(trimmed)
      setBody('')
    } catch {
      // sendMessage.isError surfaced below
    }
  }

  if (isLoading) return <div className="client-tab-loading">Ładowanie wiadomości...</div>

  return (
    <div className="client-chat">
      <div className="client-chat__messages">
        {!messages?.length ? (
          <div className="client-chat__empty">
            <p>Brak wiadomości — napisz do wykonawcy, odpowiemy jak najszybciej.</p>
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
        <div ref={messagesEndRef} />
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
      {sendMessage.isError && (
        <p className="client-chat__send-error">Nie udało się wysłać wiadomości. Spróbuj ponownie.</p>
      )}
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
    return (
      <div className="client-tab-empty">
        <p>Nic nie czeka teraz na zatwierdzenie.</p>
        <p className="client-tab-empty__hint">Gdy wykonawca wyśle prośbę o akceptację, pojawi się tutaj.</p>
      </div>
    )
  }

  const hasPending = approvals.some(
    (a: ClientApproval) => a.status === 'pending_client' || a.status === 'pending'
  )

  return (
    <div className="client-approvals">
      {hasPending && (
        <p className="client-approvals__intro">
          Wykonawca prosi o akceptację poniższych pozycji. Zapoznaj się z każdą i odpowiedz — Twoja decyzja zostanie od razu przekazana.
        </p>
      )}
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

              {(approval.status === 'pending_client' || approval.status === 'pending') && (
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
              {respondMutation.isError && (
                <p className="client-approval-card__error">Nie udało się zapisać odpowiedzi. Spróbuj ponownie.</p>
              )}
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

  // RLS (migr. 042) ensures client can only see visibility='client_shared' events
  useEffect(() => {
    setLoading(true)
    setError(false)
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
  }, [projectId])

  if (loading) return <div className="client-tab-loading">Ładowanie historii projektu...</div>
  if (error)   return <div className="client-tab-empty"><p>Nie udało się załadować historii.</p><p className="client-tab-empty__hint">Odśwież stronę lub skontaktuj się z wykonawcą.</p></div>
  if (!events.length) return <div className="client-tab-empty"><p>Historia projektu jest pusta.</p><p className="client-tab-empty__hint">Pierwsze wpisy pojawią się, gdy zaczną się prace.</p></div>

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
  const { data: approvalsData } = useClientApprovals(projectId)
  const pendingCount = approvalsData
    ?.filter((a: ClientApproval) => a.status === 'pending_client' || a.status === 'pending')
    .length ?? 0

  if (isLoading) {
    return <div className="client-page-loading">Ładowanie projektu...</div>
  }

  if (!project) {
    return (
      <div className="client-page-error">
        <p>Nie możemy załadować tego projektu.</p>
        <p>Sprawdź link lub skontaktuj się z wykonawcą.</p>
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
            {project.start_date && <span>Planowany start: {fmtDate(project.start_date)}</span>}
            {project.end_date   && <span>Planowane zakończenie: {fmtDate(project.end_date)}</span>}
          </div>
        )}
      </div>

      {/* Stage progress rail — always visible */}
      <ProjectStageRail status={project.status} />
      {STAGE_HINT[project.status] && (
        <p className="client-stage-hint">{STAGE_HINT[project.status]}</p>
      )}

      {/* Zakładki */}
      <div className="client-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`client-tab${activeTab === tab.key ? ' client-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.key === 'approvals' && pendingCount > 0 && (
              <span className="client-tab__badge">{pendingCount}</span>
            )}
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
