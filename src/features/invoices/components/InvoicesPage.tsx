import { useMemo, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Modal } from '@/shared/ui/Modal/Modal'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { StatusFilter } from '@/shared/ui/StatusFilter/StatusFilter'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useCreateCorrection, useCreateInvoice, useDeleteInvoice, useFinalizeInvoice, useInvoices, useMarkInvoicePaid, useSendInvoiceToKsef, useUpdateInvoice } from '@/features/invoices/hooks/useInvoices'
import { InvoiceRow } from '@/features/invoices/components/InvoiceRow'
import { InvoiceForm } from '@/features/invoices/components/InvoiceModal/InvoiceForm'
import { InvoiceImportModal } from '@/features/invoices/components/InvoiceImportModal'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { PlanLimitGuard } from '@/features/billing/components/PlanLimitGuard'
import { useClients } from '@/features/clients/hooks/useClients'
import type { Invoice } from '@/entities/invoice/model'

type FilterStatus = 'all' | Invoice['status'] | 'ksef' | 'correction'

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: 'all',        label: 'Wszystkie' },
  { value: 'unpaid',     label: 'Nieopłacone' },
  { value: 'paid',       label: 'Opłacone' },
  { value: 'overdue',    label: 'Przeterminowane' },
  { value: 'ksef',       label: 'KSeF' },
  { value: 'correction', label: 'Korekty' },
]

export function InvoicesPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const companyId = useCompanyId()
  const { data, isLoading } = useInvoices()
  const { data: clients = [] } = useClients()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const deleteInvoice = useDeleteInvoice()
  const finalizeInvoice = useFinalizeInvoice()
  const markPaid = useMarkInvoicePaid()
  const sendToKsef = useSendInvoiceToKsef()
  const createCorrection = useCreateCorrection()
  const canCreate = useCan('invoices.create')
  const canDelete = useCan('invoices.delete')
  const canMarkPaid = useCan('invoices.markPaid')
  const canSendToKsef = useCan('invoices.sendToKsef')

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map(c => [c.id, c.name])),
    [clients],
  )

  const counts = useMemo(() => ({
    all:        data?.length ?? 0,
    unpaid:     data?.filter(i => i.status === 'unpaid').length  ?? 0,
    paid:       data?.filter(i => i.status === 'paid').length    ?? 0,
    overdue:    data?.filter(i => i.status === 'overdue').length ?? 0,
    ksef:       data?.filter(i => i.ksef_status === 'ksef_sent').length ?? 0,
    correction: data?.filter(i => i.invoice_type === 'correction').length ?? 0,
  }), [data])

  const visible = useMemo(() => {
    if (!data) return []
    if (filterStatus === 'all') return data
    if (filterStatus === 'ksef') return data.filter(i => i.ksef_status === 'ksef_sent')
    if (filterStatus === 'correction') return data.filter(i => i.invoice_type === 'correction')
    return data.filter(i => i.status === filterStatus)
  }, [data, filterStatus])

  async function submit(input: any) {
    if (editing) await updateInvoice.mutateAsync({ id: editing.id, input })
    else await createInvoice.mutateAsync(input)
    setEditing(null); setOpen(false)
  }

  async function saveDraft(input: any) {
    await createInvoice.mutateAsync(input)
    setEditing(null); setOpen(false)
  }

  async function handleCreateCorrection(invoiceId: string) {
    const correction = await createCorrection.mutateAsync(invoiceId)
    setEditing(correction); setOpen(true)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <PageHeader title="Faktury" subtitle="Faktury powiązane z umowami, gotowe do KSeF — edytuj, drukuj PDF i wysyłaj do Ministerstwa Finansów." />
        <div className="toolbar__actions">
          {canCreate && (
            <PlanLimitGuard resource="invoices">
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload size={16} style={{ marginRight: 4 }} />
                Import
              </Button>
              <Button onClick={() => { setEditing(null); setOpen(true) }}>
                <Plus size={16} style={{ marginRight: 4 }} />
                Nowa faktura
              </Button>
            </PlanLimitGuard>
          )}
          <StatusFilter
            options={FILTER_LABELS.map(o => ({ ...o, count: counts[o.value as keyof typeof counts] }))}
            value={filterStatus}
            onChange={v => setFilterStatus(v as FilterStatus)}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={filterStatus === 'all' ? 'Brak faktur' : 'Brak faktur w tej kategorii'}
          description={filterStatus === 'all' ? 'Wystaw pierwszą fakturę — możesz wygenerować ją bezpośrednio z wyceny lub umowy.' : 'Zmień filtr lub utwórz nową fakturę.'}
          action={canCreate && filterStatus === 'all'
            ? <Button onClick={() => { setEditing(null); setOpen(true) }}>Utwórz fakturę</Button>
            : undefined}
        />
      ) : (
        <div className="proj-list">
          {visible.map(invoice => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              clientName={invoice.client_id ? (clientMap[invoice.client_id] ?? null) : null}
              onEdit={i => { setEditing(i); setOpen(true) }}
              onDelete={id => deleteInvoice.mutate(id)}
              onMarkPaid={id => markPaid.mutate(id)}
              onSendToKsef={id => sendToKsef.mutate(id)}
              onFinalize={id => finalizeInvoice.mutate(id)}
              onCreateCorrection={canCreate ? handleCreateCorrection : undefined}
              canDelete={canDelete}
              canMarkPaid={canMarkPaid}
              canSendToKsef={canSendToKsef}
            />
          ))}
        </div>
      )}

      {canCreate && (
        <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edytuj fakturę' : 'Nowa faktura'}>
          <InvoiceForm companyId={companyId} initialInvoice={editing} onSubmit={submit} onSaveDraft={editing ? undefined : saveDraft} />
        </Modal>
      )}

      {canCreate && (
        <InvoiceImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          companyId={companyId}
          onImport={(imported) => {
            setImportOpen(false)
            setEditing(imported)
            setOpen(true)
          }}
        />
      )}
    </div>
  )
}
