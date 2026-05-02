import { memo, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, Edit2, FileText, FileMinus, Mail, Trash2, Bell, Download } from 'lucide-react'
import type { Invoice } from '@/entities/invoice/model'
import { Button } from '@/shared/ui/Button/Button'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildInvoicePreview, buildInvoiceXml } from '@/services/pdf/documentPreview'
import { formatCurrency } from '@/shared/lib/formatters'
import { useClients } from '@/features/clients/hooks/useClients'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'
import { useInvoiceDetail } from '@/features/invoices/hooks/useInvoices'
import { SendToClientModal } from '@/shared/ui/SendToClientModal/SendToClientModal'
import { getAppOrigin } from '@/shared/lib/native'
import { downloadBlob } from '@/shared/lib/downloads'

const STATUS_LABEL: Record<Invoice['status'], string> = {
  draft: 'Szkic', unpaid: 'Nieopłacona', paid: 'Opłacona', overdue: 'Przeterminowana',
}
const STATUS_CLASS: Record<Invoice['status'], string> = {
  draft:   'proj-status proj-status--draft',
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
  onFinalize: (id: string) => void
  onCreateCorrection?: (id: string) => void
  canDelete?: boolean
  canMarkPaid?: boolean
  canSendToKsef?: boolean
}

export function InvoiceRowImpl({
  invoice: invoiceProp, clientName,
  onEdit, onDelete, onMarkPaid, onSendToKsef, onFinalize, onCreateCorrection,
  canDelete = true, canMarkPaid = true, canSendToKsef = true,
}: Props) {
  const isDraft = invoiceProp.status === 'draft'
  const isCorrection = invoiceProp.invoice_type === 'correction'
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Lazy detail fetch: items are NOT in the LIST payload anymore.
  const needsDetail = expanded || previewOpen || sendOpen || downloadingPdf
  const { data: detail } = useInvoiceDetail(invoiceProp.id, needsDetail)
  const invoice = detail ?? invoiceProp

  // Compute days overdue from due_date (client-side, for display only)
  const daysOverdue = useMemo(() => {
    if (!invoice.due_date || invoice.status === 'paid' || invoice.status === 'draft') return null
    const due = new Date(invoice.due_date)
    const now = new Date()
    due.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    const diff = Math.floor((now.getTime() - due.getTime()) / 86_400_000)
    return diff > 0 ? diff : null
  }, [invoice.due_date, invoice.status])

  const reminderCount = (invoice as any).reminder_count as number | undefined

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

  async function downloadPdfDirect(e: React.MouseEvent) {
    e.stopPropagation()
    if (downloadingPdf) return
    setDownloadingPdf(true)
    try {
      const { generatePdfBlob } = await import('@/services/pdf/pdfGenerator')
      const html = buildInvoicePreview(invoice, clientMeta, undefined, companyMetaFull)
      const blob = await generatePdfBlob(html)
      const filename = `${(invoice.number ?? 'faktura').replace(/\//g, '-')}.pdf`
      await downloadBlob(filename, blob)
    } catch (err) {
      console.error('[LoftDesk] PDF download failed', err)
      const html = buildInvoicePreview(invoice, clientMeta, undefined, companyMetaFull)
      await downloadBlob(
        `${(invoice.number ?? 'faktura').replace(/\//g, '-')}.html`,
        new Blob([html], { type: 'text/html;charset=utf-8' }),
      )
    } finally {
      setDownloadingPdf(false)
    }
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
          <span className="proj-row__name">{invoice.number ?? <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Szkic — bez numeru</span>}</span>
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
            <span className={`${KSEF_CLASS[invoice.ksef_status]} invoice-row__ksef`} style={{ fontSize: 11 }}>
              {KSEF_LABEL[invoice.ksef_status]}
            </span>
          )}
          {isCorrection && (
            <span style={{ background: 'rgba(168,50,40,0.1)', color: '#A83228', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>KOR</span>
          )}
          <span className={STATUS_CLASS[invoice.status]}>{STATUS_LABEL[invoice.status]}</span>
          {daysOverdue !== null && (
            <span className="invoice-row__overdue" style={{
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
              background: daysOverdue >= 14 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              color: daysOverdue >= 14 ? 'var(--color-error, #ef4444)' : 'var(--color-warning, #f59e0b)',
              whiteSpace: 'nowrap',
            }}>
              +{daysOverdue}d
            </span>
          )}
          {reminderCount !== undefined && reminderCount > 0 && (
            <span className="invoice-row__reminder" title={`Wysłano ${reminderCount}/3 przypomnień`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, minHeight: 28,
              padding: '4px 6px', borderRadius: 4, fontSize: 11,
              color: 'var(--color-text-secondary)',
            }}>
              <Bell size={14} />
              {reminderCount}/3
            </span>
          )}
          <div className="proj-row__actions">
            {!isDraft && (
              <button
                className="proj-action-btn"
                title="Wyślij do klienta"
                onClick={e => { e.stopPropagation(); setSendOpen(true) }}
              >
                <Mail size={14} />
              </button>
            )}
            {!isDraft && (
              <button
                className="proj-action-btn"
                title="PDF / XML"
                onClick={e => { e.stopPropagation(); setPreviewOpen(true) }}
              >
                <FileText size={14} />
              </button>
            )}
            {!isDraft && (
              <button
                className="proj-action-btn"
                title={downloadingPdf ? 'Generowanie PDF…' : 'Pobierz PDF na dysk'}
                onClick={downloadPdfDirect}
                disabled={downloadingPdf}
                style={downloadingPdf ? { opacity: 0.5 } : undefined}
              >
                <Download size={14} />
              </button>
            )}
            {canEdit && (
              <button
                className="proj-action-btn"
                title="Edytuj"
                onClick={e => { e.stopPropagation(); onEdit(invoice) }}
              >
                <Edit2 size={14} />
              </button>
            )}
            {isDraft && (
              <button
                className="proj-action-btn proj-action-btn--primary"
                title="Wystaw fakturę — nadaj numer"
                onClick={e => { e.stopPropagation(); onFinalize(invoice.id) }}
              >
                <CheckCircle size={14} />
              </button>
            )}
            {!isDraft && invoice.status !== 'paid' && canMarkPaid && (
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
            {!isDraft && !isCorrection && onCreateCorrection && invoice.ksef_status !== 'ksef_sent' && (
              <button
                className="proj-action-btn"
                title="Wystaw fakturę korygującą"
                onClick={e => { e.stopPropagation(); onCreateCorrection(invoice.id) }}
              >
                <FileMinus size={14} />
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
                <br />
                {invoice.due_date}
                {daysOverdue !== null && (
                  <span style={{
                    marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: daysOverdue >= 14 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    color: daysOverdue >= 14 ? 'var(--color-error, #ef4444)' : 'var(--color-warning, #f59e0b)',
                  }}>+{daysOverdue}d</span>
                )}
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
            {reminderCount !== undefined && reminderCount > 0 && (
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Przypomnienia</span>
                <br />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <Bell size={13} style={{ color: 'var(--color-text-secondary)' }} />
                  {reminderCount}/3 wysłane
                </span>
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
            {isDraft ? (
              <Button onClick={() => onFinalize(invoice.id)}>Wystaw fakturę</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setPreviewOpen(true)}>PDF / XML</Button>
                <Button variant="secondary" loading={downloadingPdf} onClick={e => { void downloadPdfDirect(e) }}>
                  {downloadingPdf ? 'Generowanie…' : 'Pobierz PDF'}
                </Button>
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
              </>
            )}
          </div>
        </div>
      )}

      <DocumentPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${invoice.number ?? 'Szkic'} · Podgląd dokumentu`}
        tabs={tabs}
      />

      <SendToClientModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        documentType="invoice"
        documentName={invoice.number ?? 'Szkic'}
        defaultEmail={client?.email}
        portalUrl={invoice.project_id ? `${getAppOrigin()}/client/project/${invoice.project_id}` : undefined}
        pdfHtml={tabs[0].content}
      />
    </div>
  )
}

export const InvoiceRow = memo(InvoiceRowImpl)
