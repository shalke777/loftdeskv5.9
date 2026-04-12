import { useMemo, useState } from 'react'
import type { Contract } from '@/entities/contract/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { formatCurrency } from '@/shared/lib/formatters'
import { useClients } from '@/features/clients/hooks/useClients'
import { useEstimates } from '@/features/estimates/hooks/useEstimates'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildContractPreview } from '@/services/pdf/documentPreview'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'

export function ContractDetail({ contract, onSign, onEdit, canSign = true }: { contract: Contract | null; onSign: (id: string) => void; onEdit?: (contract: Contract) => void; canSign?: boolean }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const { data: clients = [] } = useClients()
  const { data: estimates = [] } = useEstimates()
  const { user } = useAuth()
  const companyMeta = useCompanyMeta()
  if (!contract) return null
  const client = clients.find((item) => item.id === contract.client_id)
  const estimate = estimates.find((item) => item.id === contract.estimate_id)
  const tabs = useMemo(() => [{ key: 'pdf', label: 'Podgląd PDF', type: 'html' as const, content: buildContractPreview(contract, client?.name, estimate?.name, { name: companyMeta.name || user?.companyName, nip: companyMeta.nip, address: companyMeta.address, postalCity: companyMeta.postalCity, email: companyMeta.email || user?.email, phone: companyMeta.phone, logoUrl: companyMeta.logoUrl }, estimate?.number) }], [client?.name, companyMeta, contract, estimate?.name, estimate?.number, user?.companyName, user?.email])
  return <><Card><div className="toolbar"><div><h3>{contract.number}</h3><p>{client?.name || 'Bez klienta'}{estimate ? ` · ${estimate.number}` : ''}</p></div><Badge variant={contract.status === 'signed' ? 'success' : 'warning'}>{contract.status}</Badge></div><p>Data podpisu: {contract.sign_date || 'Nie podpisano'}</p>{contract.start_date ? <p>Termin: {contract.start_date}{contract.end_date ? ` – ${contract.end_date}` : ''}</p> : null}{contract.location ? <p>Lokalizacja: {contract.location}</p> : null}<p>Wartość: {formatCurrency(contract.value)}</p><p>{contract.notes || 'Brak notatek'}</p><div className="actions-row preview-links"><Button variant="ghost" onClick={() => setPreviewOpen(true)}>PDF</Button>{onEdit ? <Button variant="secondary" onClick={() => onEdit(contract)}>Edytuj</Button> : null}{contract.status !== 'signed' && canSign ? <Button onClick={() => onSign(contract.id)}>Oznacz jako podpisaną</Button> : null}</div></Card><DocumentPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`${contract.number} · Podgląd dokumentu`} tabs={tabs} /></>
}
