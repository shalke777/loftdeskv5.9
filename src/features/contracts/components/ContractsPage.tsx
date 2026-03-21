import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Modal } from '@/shared/ui/Modal/Modal'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useContracts, useCreateContract, useDeleteContract, useSignContract, useUpdateContract } from '@/features/contracts/hooks/useContracts'
import { useCreateInvoiceFromContract } from '@/features/invoices/hooks/useInvoices'
import { ContractRow } from '@/features/contracts/components/ContractRow'
import { ContractForm } from '@/features/contracts/components/ContractModal/ContractForm'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { PlanLimitGuard } from '@/features/billing/components/PlanLimitGuard'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjects } from '@/features/projects/hooks/useProjects'
import type { Contract } from '@/entities/contract/model'

type FilterStatus = 'all' | Contract['status']

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: 'all',      label: 'Wszystkie' },
  { value: 'unsigned', label: 'W przygotowaniu' },
  { value: 'signed',   label: 'Podpisane' },
]

export function ContractsPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)

  const companyId = useCompanyId()
  const { data, isLoading } = useContracts()
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const createContract = useCreateContract()
  const updateContract = useUpdateContract()
  const signContract = useSignContract()
  const deleteContract = useDeleteContract()
  const createInvoiceFromContract = useCreateInvoiceFromContract()
  const canCreate = useCan('contracts.create')
  const canDelete = useCan('contracts.delete')
  const canSign = useCan('contracts.sign')

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map(c => [c.id, c.name])),
    [clients],
  )
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p.name])),
    [projects],
  )

  const counts = useMemo(() => ({
    all:      data?.length ?? 0,
    unsigned: data?.filter(c => c.status === 'unsigned').length ?? 0,
    signed:   data?.filter(c => c.status === 'signed').length   ?? 0,
  }), [data])

  const visible = useMemo(
    () => filterStatus === 'all' ? (data ?? []) : (data ?? []).filter(c => c.status === filterStatus),
    [data, filterStatus],
  )

  async function submit(input: any) {
    if (editing) await updateContract.mutateAsync({ id: editing.id, input })
    else await createContract.mutateAsync(input)
    setEditing(null); setOpen(false)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <PageHeader title="Umowy" subtitle="Wzory umów, transze płatności, edycja i podgląd PDF." />
        <div className="toolbar__actions">
          {canCreate && (
            <PlanLimitGuard resource="contracts">
              <Button onClick={() => { setEditing(null); setOpen(true) }}>
                <Plus size={16} style={{ marginRight: 4 }} />
                Nowa umowa
              </Button>
            </PlanLimitGuard>
          )}
        </div>
      </div>

      <div className="proj-filters">
        {FILTER_LABELS.map(({ value, label }) => (
          <button key={value} type="button"
            className={`proj-filter-pill${filterStatus === value ? ' proj-filter-pill--active' : ''}`}
            onClick={() => setFilterStatus(value)}>
            {label}
            <span className="proj-filter-pill__count">{counts[value]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={filterStatus === 'all' ? 'Brak umów' : 'Brak umów w tej kategorii'}
          description={filterStatus === 'all' ? 'Dodaj pierwszą umowę do modułu dokumentów.' : 'Zmień filtr lub utwórz nową umowę.'}
          action={canCreate && filterStatus === 'all'
            ? <Button onClick={() => { setEditing(null); setOpen(true) }}>Utwórz umowę</Button>
            : undefined}
        />
      ) : (
        <div className="proj-list">
          {visible.map(contract => (
            <ContractRow
              key={contract.id}
              contract={contract}
              clientName={contract.client_id ? (clientMap[contract.client_id] ?? null) : null}
              projectName={contract.project_id ? (projectMap[contract.project_id] ?? null) : null}
              onEdit={c => { setEditing(c); setOpen(true) }}
              onDelete={id => deleteContract.mutate(id)}
              onSign={id => signContract.mutate(id)}
              onCreateInvoice={id => createInvoiceFromContract.mutate(id)}
              canDelete={canDelete}
              canSign={canSign}
            />
          ))}
        </div>
      )}

      {canCreate && (
        <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edytuj umowę' : 'Nowa umowa'}>
          <ContractForm companyId={companyId} initialContract={editing} onSubmit={submit} />
        </Modal>
      )}
    </div>
  )
}
