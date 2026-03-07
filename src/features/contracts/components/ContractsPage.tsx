import { useMemo, useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Modal } from '@/shared/ui/Modal/Modal'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useContracts, useCreateContract, useDeleteContract, useSignContract, useUpdateContract } from '@/features/contracts/hooks/useContracts'
import { ContractCard } from '@/features/contracts/components/ContractCard'
import { ContractForm } from '@/features/contracts/components/ContractModal/ContractForm'
import { ContractDetail } from '@/features/contracts/components/ContractDetail'
import type { Contract } from '@/entities/contract/model'
import { useCan } from '@/features/auth/hooks/usePermissions'

export function ContractsPage() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Contract | null>(null)
  const [editing, setEditing] = useState<Contract | null>(null)
  const companyId = useCompanyId()
  const { data, isLoading } = useContracts()
  const createContract = useCreateContract(); const updateContract = useUpdateContract(); const signContract = useSignContract(); const deleteContract = useDeleteContract()
  const signedCount = useMemo(() => data?.filter((item) => item.status === 'signed').length ?? 0, [data])
  const canCreate = useCan('contracts.create'); const canDelete = useCan('contracts.delete'); const canSign = useCan('contracts.sign')
  async function submit(input: any) { if (editing) await updateContract.mutateAsync({ id: editing.id, input }); else await createContract.mutateAsync(input); setEditing(null); setOpen(false) }

  return (
    <div>
      <div className="toolbar"><PageHeader title="Umowy" subtitle="Gotowy wzór umowy, własne formularze, transze, edycja i podgląd PDF." /><div className="toolbar__actions">{canCreate ? <Button onClick={() => { setEditing(null); setOpen(true) }}>Nowa umowa</Button> : null}</div></div>
      <div className="grid-4" style={{ marginBottom: 16 }}><div className="card"><h3>Podpisane</h3><p>{signedCount}</p></div><div className="card"><h3>W przygotowaniu</h3><p>{(data?.length ?? 0) - signedCount}</p></div></div>
      {selected ? <ContractDetail contract={selected} onEdit={(item) => { setEditing(item); setOpen(true) }} onSign={(id) => signContract.mutate(id)} canSign={canSign} /> : null}
      {isLoading ? <Spinner /> : null}
      {!isLoading && !data?.length ? <EmptyState title="Brak umów" description="Dodaj pierwszą umowę do modułu dokumentów." /> : null}
      <div className="grid-2">{data?.map((contract) => <ContractCard key={contract.id} contract={contract} onEdit={(item) => { setEditing(item); setOpen(true) }} onOpen={setSelected} onDelete={(id) => deleteContract.mutate(id)} canDelete={canDelete} />)}</div>
      {canCreate ? <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edytuj umowę' : 'Nowa umowa'}><ContractForm companyId={companyId} initialContract={editing} onSubmit={submit} /></Modal> : null}
    </div>
  )
}
