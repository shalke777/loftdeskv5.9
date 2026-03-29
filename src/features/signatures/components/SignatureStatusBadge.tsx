// =============================================================================
// SignatureStatusBadge.tsx — mini-badge showing approval status for a document
// =============================================================================

import { Badge } from '@/shared/ui/Badge/Badge'
import { useSignatureRequestsForDocumentWithParts, useApprovalEventsForDocument } from '@/features/signatures/hooks/useSignatureRequests'
import type { SignatureRequestWithParticipants } from '@/features/signatures/types/signature.types'

interface Props {
  documentType: 'estimate' | 'contract'
  documentId: string
  className?: string
}

function deriveStatus(req: SignatureRequestWithParticipants): 'pending' | 'completed' | 'rejected' | 'cancelled' | 'questioned' {
  if (req.status === 'completed')  return 'completed'
  if (req.status === 'rejected')   return 'rejected'
  if (req.status === 'cancelled' || req.status === 'expired') return 'cancelled'
  // Derive from participants
  const parts = req.participants ?? []
  if (parts.some(p => p.status === 'rejected')) return 'rejected'
  if (parts.length > 0 && parts.every(p => p.status === 'approved' || p.status === 'signed')) return 'completed'
  if (parts.some(p => p.status === 'questioned')) return 'questioned'
  return 'pending'
}

const LABEL: Record<string, string> = {
  pending:    'Oczekuje na akceptację',
  completed:  'Zaakceptowano',
  rejected:   'Odrzucono',
  cancelled:  'Anulowano',
  questioned: 'Pytanie klienta',
}

const VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  pending:    'warning',
  completed:  'success',
  rejected:   'danger',
  cancelled:  'default',
  questioned: 'warning',
}

export function SignatureStatusBadge({ documentType, documentId, className }: Props) {
  const { data: requests } = useSignatureRequestsForDocumentWithParts(documentType, documentId)
  const { data: approvalEvents } = useApprovalEventsForDocument(documentType, documentId)

  // Show only if there's at least one active/recent request
  const active = requests?.find(
    r => r.status !== 'cancelled' && r.status !== 'expired',
  )
  if (!active) return null

  let status = deriveStatus(active)

  // 'questioned' is not a final decision — participant.status is never written
  // for it, so deriveStatus can't detect it. Fall back to approval_events.
  if (status === 'pending') {
    const hasOpenQuestion = (approvalEvents ?? []).some(
      e => e.signature_request_id === active.id && e.decision === 'questioned',
    )
    if (hasOpenQuestion) status = 'questioned'
  }

  return (
    <Badge variant={VARIANT[status]} style={{ cursor: 'default' }}>
      {LABEL[status]}
    </Badge>
  )
}
