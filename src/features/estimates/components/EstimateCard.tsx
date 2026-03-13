import { useMemo, useState } from 'react'
import type { Estimate } from '@/entities/estimate/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { formatCurrency } from '@/shared/lib/formatters'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildEstimatePreview } from '@/services/pdf/documentPreview'
import { useClients } from '@/features/clients/hooks/useClients'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'
import { EstimateNextActions } from './EstimateNextActions'
import { useCreateProjectFromEstimate } from '@/features/projects/hooks/useProjects'

function variant(status: Estimate['status']) { if (status === 'accepted') return 'success'; if (status === 'rejected') return 'danger'; if (status === 'sent') return 'warning'; return 'default' }

export function EstimateCard({ estimate, onDelete, onCreateContract, onEdit }: { estimate: Estimate; onDelete?: (id: string) => void; onCreateContract?: (id: string) => void; onEdit?: (estimate: Estimate) => void }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const { data: clients = [] } = useClients()
  const { user } = useAuth()
  const companyMeta = useCompanyMeta()
  const client = clients.find((item) => item.id === estimate.client_id)
  const estimateToProject = useCreateProjectFromEstimate()
  const tabs = useMemo(() => [{ key: 'pdf', label: 'Podgląd PDF', type: 'html' as const, content: buildEstimatePreview(estimate, client ? { name: client.name, address: client.address, postalCity: `${client.postal_code || ''} ${client.city || ''}`.trim(), nip: client.nip, email: client.email, phone: client.phone } : undefined, { name: companyMeta.name || user?.companyName, nip: companyMeta.nip, address: companyMeta.address, postalCity: companyMeta.postalCity, email: companyMeta.email || user?.email, phone: companyMeta.phone, bankAccount: companyMeta.bankAccount, logoUrl: companyMeta.logoUrl }) }], [client, companyMeta, estimate, user?.companyName, user?.email])
  return (
    <>
      <Card>
        <div className="toolbar"><div><strong>{estimate.number}</strong><div>{estimate.name}</div></div><Badge variant={variant(estimate.status)}>{estimate.status}</Badge></div>
        <div className="actions-row preview-links">
          <Button variant="ghost" onClick={() => setPreviewOpen(true)}>PDF</Button>
          {onEdit ? <Button variant="secondary" onClick={() => onEdit(estimate)}>Edytuj</Button> : null}
          {estimate.status === 'accepted' && onCreateContract ? <Button variant="secondary" onClick={() => onCreateContract(estimate.id)}>Utwórz umowę</Button> : null}
          <Button
            variant="secondary"
            loading={estimateToProject.isPending}
            onClick={() => estimateToProject.mutate(estimate.id)}
            title="Utwórz projekt z tej wyceny lub przypisz do istniejącego"
          >
            → Projekt
          </Button>
          {onDelete ? <Button variant="danger" onClick={() => onDelete(estimate.id)}>Usuń</Button> : null}
        </div>
        <div style={{ marginTop: 12 }}>
          <EstimateNextActions estimate={estimate} />
        </div>
      </Card>
      <DocumentPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`${estimate.number} · Podgląd dokumentu`} tabs={tabs} />
    </>
  )
}
