import { useMemo, useState } from 'react'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useCreateEstimate, useDeleteEstimate, useEstimates, useUpdateEstimate } from '@/features/estimates/hooks/useEstimates'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { EstimateCard } from '@/features/estimates/components/EstimateCard'
import { EstimateForm } from '@/features/estimates/components/EstimateModal/EstimateForm'
import { EstimateToContractFlow } from '@/workflows/estimate-to-contract/EstimateToContractFlow'
import { useEstimateToContract } from '@/workflows/estimate-to-contract/useEstimateToContract'
import { EstimateToInvoiceFlow } from '@/workflows/estimate-to-invoice/EstimateToInvoiceFlow'
import { useCreateProjectFromEstimate } from '@/features/projects/hooks/useProjects'
import { Card } from '@/shared/ui/Card/Card'
import { useCan } from '@/features/auth/hooks/usePermissions'
import type { Estimate } from '@/entities/estimate/model'

export function EstimatesPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Estimate | null>(null)
  const companyId = useCompanyId()
  const { data, isLoading } = useEstimates()
  const createEstimate = useCreateEstimate()
  const updateEstimate = useUpdateEstimate()
  const deleteEstimate = useDeleteEstimate()
  const estimateToContract = useEstimateToContract()
  const estimateToProject = useCreateProjectFromEstimate()
  const featuredAccepted = useMemo(() => data?.find((item) => item.status === 'accepted') ?? null, [data])
  const canCreate = useCan('estimates.create')
  const canDelete = useCan('estimates.delete')
  const canConvert = useCan('estimates.convert')

  async function submit(input: any) {
    if (editing) await updateEstimate.mutateAsync({ id: editing.id, input })
    else await createEstimate.mutateAsync(input)
    setEditing(null); setOpen(false)
  }

  return (
    <div>
      <div className="toolbar">
        <PageHeader title="Wyceny" subtitle="Edytowalne pozycje, portal klienta i workflow do umów, faktur i projektów." />
        <div className="toolbar__actions">{canCreate ? <Button onClick={() => { setEditing(null); setOpen(true) }}>Nowa wycena</Button> : null}</div>
      </div>
      {featuredAccepted && canConvert ? <div className="grid-3" style={{ marginBottom: 16 }}><EstimateToContractFlow estimate={featuredAccepted} /><EstimateToInvoiceFlow estimate={featuredAccepted} /><Card><h3>Workflow kosztorys → projekt</h3><p>Po wygranej ofercie uruchamiasz realizację z gotowym budżetem.</p><div className="actions-row"><Button disabled={featuredAccepted.status !== 'accepted'} loading={estimateToProject.isPending} onClick={() => estimateToProject.mutate(featuredAccepted.id)}>Utwórz projekt z kosztorysu</Button></div></Card></div> : null}
      {isLoading ? <Spinner /> : null}
      {!isLoading && !data?.length ? <EmptyState title="Brak kosztorysów" description="Dodaj pierwszą wycenę, aby uruchomić moduł ofert." /> : null}
      <div className="grid-2">{data?.map((estimate) => <EstimateCard key={estimate.id} estimate={estimate} onEdit={(item) => { setEditing(item); setOpen(true) }} onDelete={canDelete ? (id) => deleteEstimate.mutate(id) : undefined} onCreateContract={canConvert ? (id) => estimateToContract.mutate(id) : undefined} />)}</div>
      {canCreate ? <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edytuj wycenę' : 'Nowa wycena'}><EstimateForm companyId={companyId} initialEstimate={editing} onSubmit={submit} /></Modal> : null}
    </div>
  )
}
