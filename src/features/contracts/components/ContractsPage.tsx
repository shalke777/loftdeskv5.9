import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Modal } from '@/shared/ui/Modal/Modal'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { StatusFilter } from '@/shared/ui/StatusFilter/StatusFilter'
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
    () => Object.fromEntries(clients.map(c => [c.id, c])),
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        {canCreate && (
          <PlanLimitGuard resource="contracts">
            <Button onClick={() => { setEditing(null); setOpen(true) }}>
              <Plus size={16} style={{ marginRight: 4 }} />
              Nowa umowa
            </Button>
          </PlanLimitGuard>
        )}
        <div style={{ marginLeft: 'auto' }}>
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
          title={filterStatus === 'all' ? 'Brak umów' : 'Brak umów w tej kategorii'}
          description={filterStatus === 'all' ? 'Utwórz pierwszą umowę — połącz z wycenioną robotą i ustal transze płatności.' : 'Zmień filtr lub utwórz nową umowę.'}
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
              clientName={contract.client_id ? (clientMap[contract.client_id]?.name ?? null) : null}
              client={contract.client_id ? (clientMap[contract.client_id] ?? null) : null}
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
