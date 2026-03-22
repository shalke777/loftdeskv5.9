import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, Edit2, FileText, Mail, Trash2 } from 'lucide-react'
import type { Invoice } from '@/entities/invoice/model'
import { Button } from '@/shared/ui/Button/Button'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildInvoicePreview, buildInvoiceXml } from '@/services/pdf/documentPreview'
import { formatCurrency } from '@/shared/lib/formatters'
import { useClients } from '@/features/clients/hooks/useClients'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'
import { SendToClientModal } from '@/shared/ui/SendToClientModal/SendToClientModal'
import { getAppOrigin } from '@/shared/lib/native'

const STATUS_LABEL: Record<Invoice['status'], string> = {
  unpaid: 'Nieopłacona', paid: 'Opłacona', overdue: 'Przeterminowana',
}
const STATUS_CLASS: Record<Invoice['status'], string> = {
  unpaid:  'proj-status proj-status--unpaid',
  paid:    'proj-status proj-status--paid',
  overdue: 'proj-status proj-status--overdue',
}

const KSEF_LABEL: Record<NonNullable<Invoice['ksef_status']>, string> = {
  ksef_sent: 'KSeF', ksef_pending: 'KSeF oczekuje', ksef_error: 'KSeF błąd',
}
const KSEF_CLASS: Record<NonNullable<Invoice['ksef_status']>, string> = {
  ksef_sent:    'proj-status proj-status--ksef-sent',
  ksef_pending: 'proj-status proj-status--ksef-pending',
  ksef_error:   'proj-status proj-status--ksef-error',
}

const PAYMENT_LABEL: Record<string, string> = {
  transfer: 'Przelew', cash: 'Gotówka', card: 'Karta',
}

interface Props {
  invoice: Invoice
  clientName: string | null
  onEdit: (inv: Invoice) => void
  onDelete: (id: string) => void
  onMarkPaid: (id: string) => void
  onSendToKsef: (id: string) => void
  canDelete?: boolean
  canMarkPaid?: boolean
  canSendToKsef?: boolean
}

export function InvoiceRow({
  invoice, clientName,
  onEdit, onDelete, onMarkPaid, onSendToKsef,
  canDelete = true, canMarkPaid = true, canSendToKsef = true,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)

  const { data: clients = [] } = useClients()
  const { user } = useAuth()
  const companyMeta = useCompanyMeta()

  const client = clients.find(c => c.id === invoice.client_id)
  const clientMeta = client ? {
    name: client.name, address: client.address,
    postalCity: `${client.postal_code || ''} ${client.city || ''}`.trim(),
    nip: client.nip, email: client.email, phone: client.phone,
  } : undefined
  const companyMetaFull = {
    name: companyMeta.name || user?.companyName, nip: companyMeta.nip,
    address: companyMeta.address, postalCity: companyMeta.postalCity,
    email: companyMeta.email || user?.email, phone: companyMeta.phone,
    bankAccount: companyMeta.bankAccount, logoUrl: companyMeta.logoUrl,
  }

  const tabs = useMemo(() => ([
    {
      key: 'pdf', label: 'Podgląd PDF', type: 'html' as const,
      content: buildInvoicePreview(invoice, clientMeta, undefined, companyMetaFull),
    },
    { key: 'xml', label: 'Podgląd XML', type: 'xml' as const, content: buildInvoiceXml(invoice) },
  ]), [clientMeta, companyMetaFull, invoice])

  const canEdit = invoice.ksef_status !== 'ksef_sent'

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDelete) { onDelete(invoice.id); setConfirmDelete(false) }
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000) }
  }

  return (
    <div className={`proj-row${expanded ? ' proj-row--open' : ''}`}>
      <div
        className="proj-row__header"
        role="button"
        tabIndex={0}
        onClick={() => { setExpanded(v => !v); setConfirmDelete(false) }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v) }}
      >
        <span className="proj-row__chevron">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        <div className="proj-row__info">
          <span className="proj-row__name">{invoice.number}</span>
          <span className="proj-row__meta">
            {clientName && <span className="proj-row__client">{clientName}</span>}
            {invoice.due_date && (
              <span className="proj-row__number">termin: {invoice.due_date}</span>
            )}
          </span>
        </div>

        <div className="proj-row__right" onClick={e => e.stopPropagation()}>
          <span className="proj-row__number" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(invoice.total_gross)}
          </span>
          {invoice.ksef_status && (
            <span className={KSEF_CLASS[invoice.ksef_status]} style={{ fontSize: 11 }}>
              {KSEF_LABEL[invoice.ksef_status]}
            </span>
          )}
          <span className={STATUS_CLASS[invoice.status]}>{STATUS_LABEL[invoice.status]}</span>
          <div className="proj-row__actions">
            <button
              className="proj-action-btn"
              title="Wyślij do klienta"
              onClick={e => { e.stopPropagation(); setSendOpen(true) }}
            >
              <Mail size={14} />
            </button>
            <button
              className="proj-action-btn"
              title="PDF / XML"
              onClick={e => { e.stopPropagation(); setPreviewOpen(true) }}
            >
              <FileText size={14} />
            </button>
            {canEdit && (
              <button
                className="proj-action-btn"
                title="Edytuj"
                onClick={e => { e.stopPropagation(); onEdit(invoice) }}
              >
                <Edit2 size={14} />
              </button>
            )}
            {invoice.status !== 'paid' && canMarkPaid && (
              <button
                className="proj-action-btn"
                title="Oznacz jako opłaconą"
                onClick={e => { e.stopPropagation(); onMarkPaid(invoice.id) }}
              >
                <CheckCircle size={14} />
              </button>
            )}
            {canDelete && (
              <button
                className={`proj-action-btn proj-action-btn--danger${confirmDelete ? ' proj-action-btn--confirm' : ''}`}
                title="Usuń"
                onClick={handleDelete}
              >
                <Trash2 size={14} />
                {confirmDelete && <span className="proj-action-btn__label">Potwierdź</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="proj-row__detail">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '8px 16px', marginBottom: 16, fontSize: 13,
          }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Data wystawienia</span>
              <br />{invoice.issue_date}
            </div>
            {invoice.sale_date && (
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Data sprzedaży</span>
                <br />{invoice.sale_date}
              </div>
            )}
            {invoice.due_date && (
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Termin płatności</span>
                <br />{invoice.due_date}
              </div>
            )}
            {invoice.payment_method && (
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Forma płatności</span>
                <br />{PAYMENT_LABEL[invoice.payment_method] ?? invoice.payment_method}
              </div>
            )}
            {invoice.ksef_status && (
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Status KSeF</span>
                <br />
                {invoice.ksef_status}
                {invoice.ksef_ref && <span style={{ color: 'var(--color-text-muted)' }}> · {invoice.ksef_ref}</span>}
              </div>
            )}
          </div>

          {invoice.items.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Pozycje ({invoice.items.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {invoice.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 16 }}>
                    <span>{item.description}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invoice.notes && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              {invoice.notes}
            </p>
          )}

          <div className="actions-row">
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>PDF / XML</Button>
            <Button variant="secondary" onClick={() => setSendOpen(true)}>Wyślij do klienta</Button>
            {invoice.status !== 'paid' && canMarkPaid && (
              <Button variant="secondary" onClick={() => onMarkPaid(invoice.id)}>
                Oznacz jako opłaconą
              </Button>
            )}
            {invoice.ksef_status !== 'ksef_sent' && canSendToKsef && (
              <Button variant="secondary" onClick={() => onSendToKsef(invoice.id)}>
                Wyślij do KSeF
              </Button>
            )}
          </div>
        </div>
      )}

      <DocumentPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${invoice.number} · Podgląd dokumentu`}
        tabs={tabs}
      />

      <SendToClientModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        documentType="invoice"
        documentName={invoice.number}
        defaultEmail={client?.email}
        portalUrl={invoice.project_id ? `${getAppOrigin()}/client/project/${invoice.project_id}` : undefined}
      />
    </div>
  )
}
