import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { formatDate } from '@/shared/lib/formatters'

export function PortalHeader({
  estimateNumber,
  estimateName,
  customerName,
  contractorName,
  contractorEmail,
  expiresAt,
  expired,
  estimateStatus,
}: {
  estimateNumber: string
  estimateName: string
  customerName: string
  contractorName: string
  contractorEmail: string
  expiresAt: string
  expired: boolean
  estimateStatus: 'draft' | 'sent' | 'accepted' | 'rejected'
}) {
  const badgeVariant = estimateStatus === 'accepted' ? 'success' : estimateStatus === 'rejected' ? 'danger' : 'warning'
  return (
    <Card>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <div>
          <h3>{estimateNumber}</h3>
          <p>{estimateName}</p>
        </div>
        <Badge variant={badgeVariant}>{estimateStatus}</Badge>
      </div>
      <p>Klient: {customerName}</p>
      <p>Wykonawca: {contractorName}</p>
      <p>Kontakt: {contractorEmail || 'brak'}</p>
      <p className="field__label">{expired ? 'Link wygasł' : `Ważny do ${formatDate(expiresAt)}`}</p>
    </Card>
  )
}
