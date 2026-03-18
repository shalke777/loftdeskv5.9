import { useMemo, useState } from 'react'
import { Contract } from '@/entities/contract/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { formatCurrency } from '@/shared/lib/formatters'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildContractPreview } from '@/services/pdf/documentPreview'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'
import { SendToClientModal } from '@/shared/ui/SendToClientModal/SendToClientModal'

export function ContractCard({ contract, onDelete, onOpen, onEdit, canDelete = true }: { contract: Contract; onDelete: (id: string) => void; onOpen: (contract: Contract) => void; onEdit?: (contract: Contract) => void; canDelete?: boolean }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const { user } = useAuth()
  const companyMeta = useCompanyMeta()
  const client = clients.find((item) => item.id === contract.client_id)
  const project = projects.find((item) => item.id === contract.project_id)
  const tabs = useMemo(() => [{ key: 'pdf', label: 'Podgląd PDF', type: 'html' as const, content: buildContractPreview(contract, client?.name, project?.name, { name: companyMeta.name || user?.companyName, nip: companyMeta.nip, address: companyMeta.address, postalCity: companyMeta.postalCity, email: companyMeta.email || user?.email, phone: companyMeta.phone, logoUrl: companyMeta.logoUrl }) }], [client?.name, companyMeta, contract, project?.name, user?.companyName, user?.email])
  return <><Card><div className="toolbar"><div><strong>{contract.number}</strong><div className="field__label">Data podpisu: {contract.sign_date || 'brak'}</div></div><Badge variant={contract.status === 'signed' ? 'success' : 'warning'}>{contract.status}</Badge></div><p>Wartość umowy: {formatCurrency(contract.value)}</p><p>Transze: {contract.tranches?.length || 0}</p><div className="actions-row"><Button variant="ghost" onClick={() => onOpen(contract)}>Szczegóły</Button><Button variant="ghost" onClick={() => setPreviewOpen(true)}>PDF</Button>{onEdit ? <Button variant="secondary" onClick={() => onEdit(contract)}>Edytuj</Button> : null}<Button variant="secondary" onClick={() => setSendOpen(true)}>Wyślij do klienta</Button>{canDelete ? <Button variant="danger" onClick={() => onDelete(contract.id)}>Usuń</Button> : null}</div></Card><DocumentPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`${contract.number} · Podgląd dokumentu`} tabs={tabs} /><SendToClientModal open={sendOpen} onClose={() => setSendOpen(false)} documentType="contract" documentName={contract.number} defaultEmail={client?.email} projectId={contract.project_id ?? undefined} companyId={contract.company_id} /></>
}
