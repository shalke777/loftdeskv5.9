// =============================================================================
// SignatureStatusBadge.tsx — mini-badge showing approval status for a document
// =============================================================================

import { Badge } from '@/shared/ui/Badge/Badge'
import { useSignatureRequestsForDocumentWithParts } from '@/features/signatures/hooks/useSignatureRequests'
import type { SignatureRequestWithParticipants } from '@/features/signatures/types/signature.types'

interface Props {
  documentType: 'estimate' | 'contract'
  documentId: string
  className?: string
}

function deriveStatus(req: SignatureRequestWithParticipants): 'pending' | 'completed' | 'rejected' | 'cancelled' {
  if (req.status === 'completed')  return 'completed'
  if (req.status === 'rejected')   return 'rejected'
  if (req.status === 'cancelled' || req.status === 'expired') return 'cancelled'
  // Derive from participants
  const parts = req.participants ?? []
  if (parts.some(p => p.status === 'rejected')) return 'rejected'
  if (parts.length > 0 && parts.every(p => p.status === 'approved' || p.status === 'signed')) return 'completed'
  return 'pending'
}

const LABEL: Record<string, string> = {
  pending:   'Oczekuje na akceptację',
  completed: 'Zaakceptowano',
  rejected:  'Odrzucono',
  cancelled: 'Anulowano',
}

const VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending:   'warning',
  completed: 'success',
  rejected:  'danger',
  cancelled: 'default',
}

export function SignatureStatusBadge({ documentType, documentId, className }: Props) {
  const { data: requests } = useSignatureRequestsForDocumentWithParts(documentType, documentId)

  // Show only if there's at least one active/recent request
  const active = requests?.find(
    r => r.status !== 'cancelled' && r.status !== 'expired',
  )
  if (!active) return null

  const status = deriveStatus(active)

  return (
    <Badge variant={VARIANT[status]} style={{ cursor: 'default' }}>
      {LABEL[status]}
    </Badge>
  )
}
