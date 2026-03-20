import { useMemo, useState } from 'react'
import { Invoice } from '@/entities/invoice/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { formatCurrency } from '@/shared/lib/formatters'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildInvoicePreview, buildInvoiceXml } from '@/services/pdf/documentPreview'
import { useClients } from '@/features/clients/hooks/useClients'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'
import { SendToClientModal } from '@/shared/ui/SendToClientModal/SendToClientModal'

function statusVariant(status: Invoice['status']) { if (status === 'paid') return 'success'; if (status === 'overdue') return 'danger'; return 'warning' }

export function InvoiceCard({ invoice, onDelete, onMarkPaid, onOpen, onEdit, canDelete = true, canMarkPaid = true }: { invoice: Invoice; onDelete: (id: string) => void; onMarkPaid: (id: string) => void; onOpen: (invoice: Invoice) => void; onEdit?: (invoice: Invoice) => void; canDelete?: boolean; canMarkPaid?: boolean }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const { data: clients = [] } = useClients()
  const { user } = useAuth()
  const companyMeta = useCompanyMeta()
  const client = clients.find((item) => item.id === invoice.client_id)
  const tabs = useMemo(() => ([
    { key: 'pdf', label: 'Podgląd PDF', type: 'html' as const, content: buildInvoicePreview(invoice, client ? { name: client.name, address: client.address, postalCity: `${client.postal_code || ''} ${client.city || ''}`.trim(), nip: client.nip, email: client.email, phone: client.phone } : undefined, undefined, { name: companyMeta.name || user?.companyName, nip: companyMeta.nip, address: companyMeta.address, postalCity: companyMeta.postalCity, email: companyMeta.email || user?.email, phone: companyMeta.phone, bankAccount: companyMeta.bankAccount, logoUrl: companyMeta.logoUrl }) },
    { key: 'xml', label: 'Podgląd XML', type: 'xml' as const, content: buildInvoiceXml(invoice) },
  ]), [client, companyMeta, invoice, user?.companyName, user?.email])

  function handleDelete() {
    if (!window.confirm(`Usunąć fakturę ${invoice.number}? Tej operacji nie można cofnąć.`)) return
    onDelete(invoice.id)
  }

  return <><Card><div className="toolbar"><div><strong>{invoice.number}</strong><div className="field__label">Termin: {invoice.due_date || 'brak'}</div></div><Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge></div><p>Wartość brutto: {formatCurrency(invoice.total_gross)}</p><p>KSeF: {invoice.ksef_status || 'nie wysłano'}</p><div className="actions-row"><Button variant="ghost" onClick={() => onOpen(invoice)}>Szczegóły</Button><Button variant="ghost" onClick={() => setPreviewOpen(true)}>PDF / XML</Button>{onEdit && invoice.ksef_status !== 'ksef_sent' ? <Button variant="secondary" onClick={() => onEdit(invoice)}>Edytuj</Button> : null}{invoice.status !== 'paid' && canMarkPaid ? <Button variant="secondary" onClick={() => onMarkPaid(invoice.id)}>Oznacz jako opłaconą</Button> : null}<Button variant="secondary" onClick={() => setSendOpen(true)}>Wyślij do klienta</Button>{canDelete ? <Button variant="danger" onClick={handleDelete}>Usuń</Button> : null}</div></Card><DocumentPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`${invoice.number} · Podgląd dokumentu`} tabs={tabs} /><SendToClientModal open={sendOpen} onClose={() => setSendOpen(false)} documentType="invoice" documentName={invoice.number} defaultEmail={client?.email} portalUrl={invoice.project_id ? `${window.location.origin}/client/project/${invoice.project_id}` : undefined} /></>
}
