import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Modal } from '@/shared/ui/Modal/Modal'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useCreateInvoice, useDeleteInvoice, useInvoices, useMarkInvoicePaid, useSendInvoiceToKsef, useUpdateInvoice } from '@/features/invoices/hooks/useInvoices'
import { InvoiceRow } from '@/features/invoices/components/InvoiceRow'
import { InvoiceForm } from '@/features/invoices/components/InvoiceModal/InvoiceForm'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { useClients } from '@/features/clients/hooks/useClients'
import type { Invoice } from '@/entities/invoice/model'

type FilterStatus = 'all' | Invoice['status'] | 'ksef'

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: 'all',     label: 'Wszystkie' },
  { value: 'unpaid',  label: 'Nieopłacone' },
  { value: 'paid',    label: 'Opłacone' },
  { value: 'overdue', label: 'Przeterminowane' },
  { value: 'ksef',    label: 'KSeF' },
]

export function InvoicesPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)

  const companyId = useCompanyId()
  const { data, isLoading } = useInvoices()
  const { data: clients = [] } = useClients()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const deleteInvoice = useDeleteInvoice()
  const markPaid = useMarkInvoicePaid()
  const sendToKsef = useSendInvoiceToKsef()
  const canCreate = useCan('invoices.create')
  const canDelete = useCan('invoices.delete')
  const canMarkPaid = useCan('invoices.markPaid')
  const canSendToKsef = useCan('invoices.sendToKsef')

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map(c => [c.id, c.name])),
    [clients],
  )

  const counts = useMemo(() => ({
    all:     data?.length ?? 0,
    unpaid:  data?.filter(i => i.status === 'unpaid').length  ?? 0,
    paid:    data?.filter(i => i.status === 'paid').length    ?? 0,
    overdue: data?.filter(i => i.status === 'overdue').length ?? 0,
    ksef:    data?.filter(i => i.ksef_status === 'ksef_sent').length ?? 0,
  }), [data])

  const visible = useMemo(() => {
    if (!data) return []
    if (filterStatus === 'all') return data
    if (filterStatus === 'ksef') return data.filter(i => i.ksef_status === 'ksef_sent')
    return data.filter(i => i.status === filterStatus)
  }, [data, filterStatus])

  async function submit(input: any) {
    if (editing) await updateInvoice.mutateAsync({ id: editing.id, input })
    else await createInvoice.mutateAsync(input)
    setEditing(null); setOpen(false)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <PageHeader title="Faktury" subtitle="Edycja do momentu wysyłki do KSeF, transze z umowy, PDF/XML i pełne rozbicie VAT." />
        <div className="toolbar__actions">
          {canCreate && (
            <Button onClick={() => { setEditing(null); setOpen(true) }}>
              <Plus size={16} style={{ marginRight: 4 }} />
              Nowa faktura
            </Button>
          )}
        </div>
      </div>

      <div className="proj-filters">
        {FILTER_LABELS.map(({ value, label }) => (
          <button key={value} type="button"
            className={`proj-filter-pill${filterStatus === value ? ' proj-filter-pill--active' : ''}`}
            onClick={() => setFilterStatus(value)}>
            {label}
            <span className="proj-filter-pill__count">{counts[value as keyof typeof counts]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={filterStatus === 'all' ? 'Brak faktur' : 'Brak faktur w tej kategorii'}
          description={filterStatus === 'all' ? 'Dodaj pierwszą fakturę do modułu rozliczeń.' : 'Zmień filtr lub utwórz nową fakturę.'}
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
              canDelete={canDelete}
              canMarkPaid={canMarkPaid}
              canSendToKsef={canSendToKsef}
            />
          ))}
        </div>
      )}

      {canCreate && (
        <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edytuj fakturę' : 'Nowa faktura'}>
          <InvoiceForm companyId={companyId} initialInvoice={editing} onSubmit={submit} />
        </Modal>
      )}
    </div>
  )
}
