import { useMemo, useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useSearch } from '@tanstack/react-router'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useCreateEstimate, useDeleteEstimate, useEstimates, useUpdateEstimate } from '@/features/estimates/hooks/useEstimates'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { QueryError } from '@/shared/ui/QueryError/QueryError'
import { EstimateRow } from '@/features/estimates/components/EstimateRow'
import { EstimateForm, clearDraft as clearEstimateDraft } from '@/features/estimates/components/EstimateModal/EstimateForm'
import { useEstimateToContract } from '@/workflows/estimate-to-contract/useEstimateToContract'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { PlanLimitGuard } from '@/features/billing/components/PlanLimitGuard'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjects } from '@/features/projects/hooks/useProjects'
import type { Estimate } from '@/entities/estimate/model'

type FilterStatus = 'all' | Estimate['status']

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: 'all',      label: 'Wszystkie' },
  { value: 'draft',    label: 'Szkic' },
  { value: 'sent',     label: 'Wysłane' },
  { value: 'accepted', label: 'Zaakceptowane' },
  { value: 'rejected', label: 'Odrzucone' },
]

export function EstimatesPage() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Estimate | null>(null)

  const { create: autoCreate } = useSearch({ from: '/_auth/estimates' as any }) as { create?: boolean }

  const companyId = useCompanyId()
  const { data, isLoading, isError, refetch } = useEstimates()
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const createEstimate = useCreateEstimate()
  const updateEstimate = useUpdateEstimate()
  const deleteEstimate = useDeleteEstimate()
  const estimateToContract = useEstimateToContract()
  const canCreate = useCan('estimates.create')
  const canDelete = useCan('estimates.delete')
  const canConvert = useCan('estimates.convert')

  // Auto-open create modal when navigated with ?create=1
  useEffect(() => {
    if (autoCreate && canCreate) {
      setEditing(null)
      setOpen(true)
    }
  }, [autoCreate, canCreate])

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map(c => [c.id, c.name])),
    [clients],
  )

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, `${p.number} · ${p.name}`])),
    [projects],
  )

  const counts = useMemo(() => ({
    all:      data?.length ?? 0,
    draft:    data?.filter(e => e.status === 'draft').length    ?? 0,
    sent:     data?.filter(e => e.status === 'sent').length     ?? 0,
    accepted: data?.filter(e => e.status === 'accepted').length ?? 0,
    rejected: data?.filter(e => e.status === 'rejected').length ?? 0,
  }), [data])

  const visible = useMemo(
    () => filterStatus === 'all' ? (data ?? []) : (data ?? []).filter(e => e.status === filterStatus),
    [data, filterStatus],
  )

  async function submit(input: any) {
    try {
      if (editing) await updateEstimate.mutateAsync({ id: editing.id, input })
      else await createEstimate.mutateAsync(input)
      setEditing(null); setOpen(false)
    } catch {
      // error displayed via onError in mutation
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <PageHeader title="Wyceny" subtitle="Przygotuj ofertę, wyślij do klienta i przekształć w umowę jednym kliknięciem." />
        <div className="toolbar__actions">
          {canCreate && (
            <PlanLimitGuard resource="estimates">
              <Button onClick={() => { setEditing(null); setOpen(true) }}>
                <Plus size={16} style={{ marginRight: 4 }} />
                Nowa wycena
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
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filterStatus === 'all' ? 'Brak wycen' : 'Brak wycen w tej kategorii'}
          description={filterStatus === 'all' ? 'Stwórz pierwszą wycenę dla klienta — z pozycjami, stawkami VAT i gotową do PDF.' : 'Zmień filtr lub utwórz nową wycenę.'}
          action={canCreate && filterStatus === 'all'
            ? <Button onClick={() => { setEditing(null); setOpen(true) }}>Utwórz wycenę</Button>
            : undefined}
        />
      ) : (
        <div className="proj-list">
          {visible.map(estimate => (
            <EstimateRow
              key={estimate.id}
              estimate={estimate}
              clientName={estimate.client_id ? (clientMap[estimate.client_id] ?? null) : null}
              projectName={estimate.project_id ? (projectMap[estimate.project_id] ?? null) : null}
              onEdit={e => { setEditing(e); setOpen(true) }}
              onDelete={canDelete ? id => deleteEstimate.mutate(id) : undefined}
              onCreateContract={canConvert ? id => estimateToContract.mutate(id) : undefined}
            />
          ))}
        </div>
      )}

      {canCreate && (
        <Modal open={open} onClose={() => { if (!editing) clearEstimateDraft(); setOpen(false) }} title={editing ? 'Edytuj wycenę' : 'Nowa wycena'}>
          <EstimateForm companyId={companyId} initialEstimate={editing} onSubmit={submit} />
        </Modal>
      )}
    </div>
  )
}
