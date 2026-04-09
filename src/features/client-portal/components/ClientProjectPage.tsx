// =============================================================================
// ClientProjectPage — szczegóły projektu w portalu klienta (v6.0)
// =============================================================================
// Zakładki: Dokumenty | Chat | Do zatwierdzenia | Oś czasu
// =============================================================================

import { useState, useEffect, useRef, Fragment } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import {
  useClientProject,
  useClientEstimates,
  useClientInvoices,
  useClientContracts,
  useClientMessages,
  useClientSendMessage,
  useClientDeleteMessage,
  useClientPhotoDocs,
  useClientDocuments,
  useClientTimeline,
  useClientDocSignatureRequests,
  useClientRespondDocApproval,
} from '@/features/client-portal/hooks/useClientPortal'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import { Badge } from '@/shared/ui/Badge/Badge'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildEstimatePreview, buildInvoicePreview, buildContractPreview } from '@/services/pdf/documentPreview'
import type { ClientEstimate, ClientInvoice, ClientContract, ClientDocSignatureRequest, ClientMessage, ClientPhotoDoc, ClientProjectDocument } from '@/features/client-portal/api/client-portal.api'

// ── Status labels ─────────────────────────────────────────────────────────────

const ESTIMATE_STATUS: Record<string, string> = {
  draft:    'W przygotowaniu',
  sent:     'Do akceptacji',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
}

const ESTIMATE_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  draft:    'default',
  sent:     'warning',
  accepted: 'success',
  rejected: 'danger',
}

const INVOICE_STATUS: Record<string, string> = {
  draft:    'W przygotowaniu',
  issued:   'Wystawiona',
  sent:     'Do zapłaty',
  paid:     'Opłacona',
  overdue:  'Przeterminowana',
  cancelled:'Anulowana',
}

const CONTRACT_STATUS: Record<string, string> = {
  draft:     'W przygotowaniu',
  sent:      'Do podpisania',
  signed:    'Podpisana',
  cancelled: 'Anulowana',
}

const CONTRACT_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  draft:     'default',
  sent:      'warning',
  signed:    'success',
  cancelled: 'danger',
}

const APPROVAL_STATUS_LABEL: Record<string, string> = {
  pending_client: 'Oczekuje',
  pending:        'Oczekuje',      // fallback dla starszych rekordów
  accepted:       'Zaakceptowane',
  rejected:       'Odrzucone',
  questioned:     'Zapytanie',
  cancelled:      'Anulowane',
  not_sent:       'Nie wysłano',
}

const APPROVAL_STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending_client: 'warning',
  pending:        'warning',
  accepted:       'success',
  rejected:       'danger',
  questioned:     'default',
  cancelled:      'danger',
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
  { key: 'offer',  label: 'Wycena',       order: 0 },
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
  // Date-only strings (YYYY-MM-DD) need T12:00:00 to avoid UTC midnight shift.
  // Full ISO timestamps already contain 'T' — appending again creates Invalid Date.
  const iso = d.includes('T') ? d : d + 'T12:00:00'
  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return 'Brak daty'
  return dt.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ProjectStageRail({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <div className="client-stage-rail" style={{ padding: '10px 0' }}>
        <span style={{ fontSize: 13, color: 'var(--color-error)', fontWeight: 600 }}>⛔ Projekt anulowany</span>
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
  { key: 'chat',       label: 'Wiadomości' },
  { key: 'approvals',  label: 'Do zatwierdzenia' },
  { key: 'timeline',   label: 'Oś czasu' },
]

// ── Zakładka Dokumenty ────────────────────────────────────────────────────────

const PHOTO_CATEGORY_LABEL: Record<string, string> = {
  progress: 'Postęp prac',
  before:   'Stan przed',
  after:    'Stan po',
  issue:    'Problem',
  handover: 'Odbiór',
  delivery: 'Dostawa',
  other:    'Inne',
}

const DOC_TYPE_LABEL: Record<string, string> = {
  attachment: 'Załącznik',
  note:       'Notatka',
  protocol:   'Protokół',
  photo:      'Zdjęcie',
  other:      'Dokument',
}

function DocumentsTab({ projectId }: { projectId: string }) {
  const { data: estimates, isLoading: loadingEst, isError: errorEst } = useClientEstimates(projectId)
  const { data: invoices,  isLoading: loadingInv, isError: errorInv } = useClientInvoices(projectId)
  const { data: contracts, isLoading: loadingCon, isError: errorCon } = useClientContracts(projectId)
  const { data: photoDocs, isLoading: loadingPh,  isError: errorPh  } = useClientPhotoDocs(projectId)
  const { data: projDocs,  isLoading: loadingPD,  isError: errorPD  } = useClientDocuments(projectId)

  const loading = loadingEst || loadingInv || loadingCon || loadingPh || loadingPD

  const [preview, setPreview] = useState<{ html: string; title: string } | null>(null)

  function openEstimatePreview(est: ClientEstimate) {
    const items = ((est as any).items ?? []).map((it: any) => ({
      id: it.id ?? '',
      cost_estimate_id: est.id,
      name: it.name ?? '',
      description: it.description ?? '',
      unit: it.unit ?? 'szt',
      quantity: Number(it.quantity ?? 1),
      unit_price: Number(it.unit_price ?? 0),
      vat_rate: Number(it.vat_rate ?? 23),
      sort_order: it.sort_order ?? 0,
      group: undefined,
    }))
    const html = buildEstimatePreview(
      { ...est, company_id: '', client_id: '', project_id: projectId, items } as any,
    )
    setPreview({ html, title: `${est.number} · Wycena` })
  }

  function openInvoicePreview(inv: ClientInvoice) {
    const items = ((inv as any).items ?? []).map((it: any) => ({
      id: it.id ?? '',
      invoice_id: inv.id,
      description: it.description ?? '',
      unit: it.unit ?? 'usł',
      quantity: Number(it.quantity ?? 1),
      unit_price: Number(it.unit_price ?? 0),
      vat_rate: Number(it.vat_rate ?? 23),
      sort_order: it.sort_order ?? 0,
      tranche_label: it.tranche_label ?? '',
    }))
    const totalNet = Math.round(items.reduce((s: number, it: any) => s + it.quantity * it.unit_price, 0) * 100) / 100
    const totalGross = Math.round(items.reduce((s: number, it: any) => s + it.quantity * it.unit_price * (1 + it.vat_rate / 100), 0) * 100) / 100
    const html = buildInvoicePreview({
      ...inv,
      company_id: '',
      client_id: '',
      project_id: projectId,
      invoice_type: (inv as any).invoice_type ?? 'standard',
      sale_date: (inv as any).sale_date ?? null,
      issue_place: (inv as any).issue_place ?? null,
      payment_method: (inv as any).payment_method ?? 'transfer',
      bank_account: (inv as any).bank_account ?? null,
      advance_total: (inv as any).advance_total ?? null,
      ksef_status: (inv as any).ksef_status ?? 'ksef_pending',
      ksef_ref: (inv as any).ksef_ref ?? null,
      total_net: totalNet,
      total_gross: totalGross,
      items,
    } as any)
    setPreview({ html, title: `${inv.number} · Faktura` })
  }

  function openContractPreview(c: ClientContract) {
    const html = buildContractPreview(c as any)
    setPreview({ html, title: `${c.number} · Umowa` })
  }

  if (loading) return <div className="client-tab-loading">Ładowanie dokumentów...</div>

  return (
    <>
    <div className="client-docs">
      {/* Wyceny */}
      <section className="client-docs__section client-docs__section--estimate">
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
                  <Badge variant={ESTIMATE_BADGE[e.status] ?? 'default'}>{ESTIMATE_STATUS[e.status] ?? e.status}</Badge>
                  <button type="button" className="client-docs__preview-btn" onClick={() => openEstimatePreview(e)}>Otwórz</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Umowy */}
      <section className="client-docs__section client-docs__section--contract">
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
                <div className="client-docs__row-right">
                  <Badge variant={CONTRACT_BADGE[c.status] ?? 'default'}>{CONTRACT_STATUS[c.status] ?? c.status}</Badge>
                  <button type="button" className="client-docs__preview-btn" onClick={() => openContractPreview(c)}>Otwórz</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Faktury */}
      <section className="client-docs__section client-docs__section--invoice">
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
                  <span className="client-docs__row-date">{fmtDate(inv.issue_date) ?? inv.issue_date}</span>
                </div>
                <div className="client-docs__row-right">
                  <span className="client-docs__row-amount">
                    {inv.total_gross?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                  </span>
                  <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : inv.status === 'sent' ? 'warning' : 'default'}>
                    {INVOICE_STATUS[inv.status] ?? inv.status}
                  </Badge>
                  <button type="button" className="client-docs__preview-btn" onClick={() => openInvoicePreview(inv)}>Otwórz</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Dodatkowe materiały / pliki projektu — sekcja ukryta gdy brak danych */}
      {(errorPD || (projDocs && projDocs.length > 0)) && (
        <section className="client-docs__section">
          <h4 className="client-docs__section-title">Dodatkowe materiały</h4>
          {errorPD ? (
            <p className="client-docs__error">Nie udało się załadować dokumentów projektu.</p>
          ) : (
            <ul className="client-docs__list">
              {projDocs!.map((d: ClientProjectDocument) => (
                <li key={d.id} className="client-docs__row">
                  <div>
                    <Badge variant="default">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</Badge>
                  </div>
                  <span className="client-docs__row-date">
                    {fmtDate(d.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Zdjęcia / dokumentacja fotograficzna */}
      <section className="client-docs__section">
        <h4 className="client-docs__section-title">Zdjęcia z realizacji</h4>
        {errorPh ? (
          <p className="client-docs__error">Nie udało się załadować zdjęć.</p>
        ) : !photoDocs?.length ? (
          <p className="client-docs__empty">Zdjęcia pojawią się w trakcie realizacji projektu.</p>
        ) : (
          <div className="client-photos">
            {photoDocs.map((ph: ClientPhotoDoc) => (
              <div key={ph.id} className="client-photos__card">
                {ph.image_url ? (
                  <a
                    href={ph.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="client-photos__img-link"
                    title="Otwórz zdjęcie w pełnym rozmiarze"
                  >
                    <img
                      src={ph.image_url}
                      alt={ph.title}
                      className="client-photos__img"
                      loading="lazy"
                    />
                    <span className="client-photos__img-overlay">🔍</span>
                  </a>
                ) : (
                  <div className="client-photos__placeholder">Brak podglądu</div>
                )}
                <div className="client-photos__info">
                  <span className="client-photos__title">{ph.title}</span>
                  <span className="client-photos__category">
                    {PHOTO_CATEGORY_LABEL[ph.category] ?? ph.category}
                  </span>
                  {ph.note && <p className="client-photos__note">{ph.note}</p>}
                  {ph.taken_at && (
                    <span className="client-photos__date">
                      {new Date(ph.taken_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>

      {preview && (
        <DocumentPreviewModal
          open
          onClose={() => setPreview(null)}
          title={preview.title}
          tabs={[{ key: 'pdf', label: 'Podgląd', type: 'html', content: preview.html }]}
        />
      )}
    </>
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
  const deleteMessage = useClientDeleteMessage(projectId)
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
              <div className="client-chat__msg-bubble">
                {msg.deleted_at
                  ? <span className="client-chat__msg-deleted">Wiadomość usunięta</span>
                  : msg.body
                }
              </div>              {!msg.deleted_at && msg.has_attachments && msg.attachment_url && (
                msg.attachment_mime?.startsWith('image/') ? (
                  <a
                    href={msg.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="client-chat__attachment-img-link"
                    title={msg.attachment_name ?? 'Otwórz zdjęcie'}
                  >
                    <img
                      src={msg.attachment_url}
                      alt={msg.attachment_name ?? 'Załącznik'}
                      className="client-chat__attachment-img"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <a
                    href={msg.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="client-chat__attachment"
                  >
                    \ud83d\udcce {msg.attachment_name ?? 'Za\u0142\u0105cznik'}
                  </a>
                )
              )}              <div className="client-chat__msg-meta">
                <span className="client-chat__msg-time">
                  {new Date(msg.created_at).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                </span>
                {msg.sender_type === 'client' && !msg.deleted_at && (
                  <button
                    type="button"
                    className="client-chat__msg-delete"
                    title="Usuń wiadomość"
                    disabled={deleteMessage.isPending}
                    onClick={() => {
                      if (window.confirm('Usunąć tę wiadomość?')) deleteMessage.mutate(msg.id)
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
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

// ── Zakładka Do zatwierdzenia ────────────────────────────────────────────────

const DOC_TYPE_LABEL_APPROVAL: Record<string, string> = {
  estimate: 'Wycena',
  contract: 'Umowa',
  annex:    'Aneks',
  invoice:  'Faktura',
  other:    'Dokument',
}

function ApprovalsTab({ projectId, projectName, companyId, onSwitchToChat }: { projectId: string; projectName?: string; companyId?: string; onSwitchToChat?: () => void }) {
  const { user } = useAuth()
  const { data: docRequests, isLoading } = useClientDocSignatureRequests(projectId)
  const respondDocMutation = useClientRespondDocApproval(projectId)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmDecision, setConfirmDecision] = useState<'approved' | 'rejected' | 'questioned' | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)

  const pendingDocs = (docRequests ?? []).filter(
    (r: ClientDocSignatureRequest) => r.status === 'pending' || r.status === 'in_progress',
  )

  function openConfirm(id: string, decision: 'approved' | 'rejected' | 'questioned') {
    setConfirmingId(id)
    setConfirmDecision(decision)
    setConsentChecked(false)
  }

  async function handleDocDecision(req: ClientDocSignatureRequest) {
    if (!confirmDecision || !user) return
    const decision = confirmDecision // capture before state updates
    // RLS returns only the current client's participant rows (matched by email).
    // client_account_id may be null at creation time, so use email as fallback.
    const myParticipant =
      req.participants.find(p => p.client_account_id !== null) ??
      req.participants.find(p => p.email.toLowerCase() === (user.email ?? '').toLowerCase()) ??
      req.participants[0]
    if (!myParticipant) return
    const consentText = `Klient potwierdzil zapoznanie sie z dokumentem "${req.document_label ?? req.document_type}" (SHA-256: ${req.document_hash.slice(0, 16)}) i podjal decyzje: ${decision}.`
    await respondDocMutation.mutateAsync({
      signatureRequestId: req.id,
      participantId:      myParticipant.id,
      decision,
      documentHash:       req.document_hash,
      documentType:       req.document_type,
      documentId:         req.document_id,
      documentLabel:      req.document_label ?? null,
      companyId:          req.company_id,
      projectId:          req.project_id,
      actorId:            user.id,
      actorName:          user.fullName ?? null,
      actorEmail:         user.email ?? null,
      consentText,
      comment:            comments[req.id] ?? undefined,
    })
    // Fire-and-forget: notify operator via email (non-blocking)
    if (companyId || req.company_id) {
      fetch('/.netlify/functions/notify-approval-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id:     companyId ?? req.company_id,
          project_id:     req.project_id,
          project_name:   projectName ?? req.project_id,
          document_label: req.document_label ?? req.document_type,
          decision,
          client_name:    user.fullName ?? undefined,
          client_email:   user.email ?? undefined,
          comment:        comments[req.id] ?? undefined,
        }),
      }).catch(() => { /* ignore — notification is best-effort */ })
    }
    setConfirmingId(null)
    setConfirmDecision(null)
    if (decision === 'questioned') {
      onSwitchToChat?.()
    }
  }

  if (isLoading) return <div className="client-tab-loading">Ładowanie akceptacji...</div>

  const hasAnything = pendingDocs.length > 0

  if (!hasAnything) {
    return (
      <div className="client-tab-empty">
        <p>Nic nie czeka teraz na zatwierdzenie.</p>
        <p className="client-tab-empty__hint">Gdy wykonawca wyśle prośbę o akceptację, pojawi się tutaj.</p>
      </div>
    )
  }

  return (
    <div className="client-approvals">
      {/* ── Akceptacje dokumentów (nowy system) ── */}
      {pendingDocs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p className="client-approvals__intro">
            Wykonawca prosi o akceptację poniższych dokumentów. Zapoznaj się z każdym i potwierdź swoją decyzję.
          </p>
          {pendingDocs.map((req: ClientDocSignatureRequest) => (
            <div key={req.id} className="client-approval-card">
              <div className="client-approval-card__header">
                <h4 className="client-approval-card__title">
                  {DOC_TYPE_LABEL_APPROVAL[req.document_type] ?? req.document_type}
                  {req.document_label ? ` \u2014 ${req.document_label}` : ''}
                </h4>
                <Badge variant="warning">Oczekuje na Twoją akceptację</Badge>
              </div>

              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                Skrót dokumentu (SHA-256):&nbsp;
                <span style={{ fontFamily: 'monospace' }}>{req.document_hash.slice(0, 16)}…</span>
              </p>

              {confirmingId === req.id ? (
                <div className="client-approval-card__actions" style={{ marginTop: 12 }}>
                  <label style={{ display: 'flex', gap: 10, fontSize: 13, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={e => setConsentChecked(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      Potwierdzam, że zapoznałem/am się z dokumentem
                      {req.document_label ? ` „${req.document_label}"` : ''} i wyrażam zgodę
                      na jego treść. Moja decyzja zostanie zapisana z datą i skrótem dokumentu.
                    </span>
                  </label>

                  <textarea
                    className="client-approval-card__comment"
                    placeholder="Komentarz (opcjonalnie)..."
                    value={comments[req.id] ?? ''}
                    onChange={e => setComments(prev => ({ ...prev, [req.id]: e.target.value }))}
                    rows={2}
                    style={{ marginTop: 10, width: '100%', resize: 'vertical' }}
                  />

                  {respondDocMutation.isError && (
                    <p className="client-approval-card__error">Nie udało się zapisać. Spróbuj ponownie.</p>
                  )}

                  <div className="client-approval-card__btns" style={{ marginTop: 10 }}>
                    {confirmDecision === 'approved' && (
                      <button
                        type="button"
                        className="client-approval-card__btn client-approval-card__btn--accept"
                        disabled={!consentChecked || respondDocMutation.isPending}
                        onClick={() => handleDocDecision(req)}
                      >
                        {respondDocMutation.isPending ? '…' : 'Zatwierdź akceptację'}
                      </button>
                    )}
                    {confirmDecision === 'rejected' && (
                      <button
                        type="button"
                        className="client-approval-card__btn client-approval-card__btn--reject"
                        disabled={!consentChecked || respondDocMutation.isPending}
                        onClick={() => handleDocDecision(req)}
                      >
                        {respondDocMutation.isPending ? '…' : 'Zatwierdź odrzucenie'}
                      </button>
                    )}
                    {confirmDecision === 'questioned' && (
                      <button
                        type="button"
                        className="client-approval-card__btn client-approval-card__btn--question"
                        disabled={!consentChecked || respondDocMutation.isPending}
                        onClick={() => handleDocDecision(req)}
                      >
                        {respondDocMutation.isPending ? '…' : 'Wyślij pytanie'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="client-approval-card__btn client-approval-card__btn--question"
                      onClick={() => { setConfirmingId(null); setConfirmDecision(null) }}
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              ) : (
                <div className="client-approval-card__btns" style={{ marginTop: 10 }}>
                  <button type="button" className="client-approval-card__btn client-approval-card__btn--accept" onClick={() => openConfirm(req.id, 'approved')}>
                    Akceptuję
                  </button>
                  <button type="button" className="client-approval-card__btn client-approval-card__btn--question" onClick={() => openConfirm(req.id, 'questioned')}>
                    Mam pytanie
                  </button>
                  <button type="button" className="client-approval-card__btn client-approval-card__btn--reject" onClick={() => openConfirm(req.id, 'rejected')}>
                    Odrzucam
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

// ── Zakładka Oś czasu ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  before:   'Przed',
  progress: 'W trakcie',
  after:    'Po',
  issue:    'Problem',
  handover: 'Odbiór',
}

function PhotoCarousel({ projectId }: { projectId: string }) {
  const { data: photos } = useClientPhotoDocs(projectId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  if (!photos?.length) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary, #aaa)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Dokumentacja zdjęciowa
      </div>
      <div
        ref={scrollRef}
        style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          paddingBottom: 4, scrollbarWidth: 'none',
        }}
      >
        {photos.map(photo => (
          <div
            key={photo.id}
            onClick={() => photo.image_url && setLightbox(photo.image_url)}
            style={{
              flexShrink: 0, width: 100, cursor: photo.image_url ? 'pointer' : 'default',
              borderRadius: 8, overflow: 'hidden', position: 'relative',
              background: 'var(--color-surface-soft, #1a1a2e)',
              border: '1px solid var(--color-border, #333)',
            }}
          >
            {photo.image_url ? (
              <img
                src={photo.image_url}
                alt={photo.title || 'Zdjęcie'}
                loading="lazy"
                style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted, #666)', fontSize: 11 }}>
                Brak zdjęcia
              </div>
            )}
            <div style={{ padding: '4px 6px' }}>
              <div style={{ fontSize: 9, color: 'var(--color-text-muted, #888)', fontWeight: 600, textTransform: 'uppercase' }}>
                {CATEGORY_LABELS[photo.category] ?? photo.category}
              </div>
              {photo.title && (
                <div style={{ fontSize: 10, color: 'var(--color-text-secondary, #ccc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {photo.title}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <img
            src={lightbox}
            alt="Podgląd"
            style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  )
}

function TimelineTab({ projectId }: { projectId: string }) {
  const { data: events, isLoading, isError } = useClientTimeline(projectId)

  if (isLoading) return <div className="client-tab-loading">Ładowanie historii projektu...</div>
  if (isError)   return <div className="client-tab-empty"><p>Nie udało się załadować historii.</p><p className="client-tab-empty__hint">Odśwież stronę lub skontaktuj się z wykonawcą.</p></div>

  return (
    <div>
      <PhotoCarousel projectId={projectId} />

      {!events?.length ? (
        <div className="client-tab-empty"><p>Historia projektu jest pusta.</p><p className="client-tab-empty__hint">Pierwsze wpisy pojawią się, gdy zaczną się prace.</p></div>
      ) : (
        <ul className="client-timeline">
          {events.map((ev) => (
            <li key={ev.id} className="client-timeline__item">
              <span className="client-timeline__dot" />
              <div className="client-timeline__content">
                <p className="client-timeline__body">{ev.title}</p>
                {ev.description && (
                  <p className="client-timeline__desc">{ev.description}</p>
                )}
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
      )}
    </div>
  )
}

// ── Główny komponent ──────────────────────────────────────────────────────────

interface Props {
  projectId: string
}

export function ClientProjectPage({ projectId }: Props) {
  const search = useSearch({ strict: false }) as { tab?: string }
  const initialTab = (['documents', 'chat', 'approvals', 'timeline'] as TabKey[]).includes(search.tab as TabKey)
    ? (search.tab as TabKey)
    : 'documents'
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const { data: project, isLoading, isError } = useClientProject(projectId)
  // Count pending doc-approvals for the tab badge (same query as ApprovalsTab — React Query deduplicates)
  const { data: docSignatureData } = useClientDocSignatureRequests(project?.id ?? '')
  const pendingCount = (docSignatureData ?? []).filter(
    (r: ClientDocSignatureRequest) => r.status === 'pending' || r.status === 'in_progress'
  ).length

  if (isLoading) {
    return <div className="client-page-loading">Ładowanie projektu...</div>
  }

  if (isError || !project) {
    return (
      <div className="client-page-error">
        <p>Ten projekt nie jest już dostępny.</p>
        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>Projekt mógł zostać usunięty lub Twój dostęp wygasł.</p>
        <Link
          to="/client/dashboard"
          style={{
            display: 'inline-block', marginTop: 16,
            padding: '10px 20px', borderRadius: 8,
            background: 'var(--color-primary)', color: '#fff',
            fontWeight: 600, fontSize: 14, textDecoration: 'none',
          }}
        >
          ← Powrót do listy projektów
        </Link>
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
        {activeTab === 'approvals'  && <ApprovalsTab   projectId={projectId} projectName={project?.name} companyId={project?.company_id} onSwitchToChat={() => setActiveTab('chat')} />}
        {activeTab === 'timeline'   && <TimelineTab    projectId={projectId} />}
      </div>
    </div>
  )
}
