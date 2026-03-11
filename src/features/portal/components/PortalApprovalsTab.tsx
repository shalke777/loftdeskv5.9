import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import {
  portalGetApprovals,
  portalRespondApproval,
} from '@/features/portal/api/portal-project.api'
import type { CostApproval, ApprovalStatus, PortalScope } from '@/features/portal/model/project-portal.types'

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending_client: 'Oczekuje na decyzję',
  accepted:       'Zaakceptowany',
  rejected:       'Odrzucony',
  questioned:     'Masz pytanie',
  cancelled:      'Anulowany',
}

const STATUS_BADGE: Record<ApprovalStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  pending_client: 'warning',
  accepted:       'success',
  rejected:       'danger',
  questioned:     'default',
  cancelled:      'default',
}

function formatAmount(amount: number | null) {
  if (amount === null) return '—'
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Pojedyncza karta akceptacji ─────────────────────────────────────────────

interface ApprovalCardProps {
  approval:   CostApproval
  sessionId:  string
  canRespond: boolean
}

function ApprovalCard({ approval, sessionId, canRespond }: ApprovalCardProps) {
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const queryClient = useQueryClient()
  const isPending   = approval.status === 'pending_client'

  const respond = useMutation({
    mutationFn: (status: Extract<ApprovalStatus, 'accepted' | 'rejected' | 'questioned'>) =>
      portalRespondApproval(sessionId, {
        approval_id:               approval.id,
        status,
        client_comment:            comment || undefined,
        response_idempotency_key:  crypto.randomUUID(),
      }),
    onSuccess: () => {
      setComment('')
      setShowComment(false)
      queryClient.invalidateQueries({ queryKey: ['portal-approvals', sessionId] })
    },
  })

  return (
    <div
      style={{
        border:       '1px solid #e2e8f0',
        borderRadius: 10,
        padding:      '16px',
        background:   isPending ? '#fffbeb' : '#fafafa',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#1a202c', marginBottom: 4 }}>
            {approval.snapshot_vendor ?? 'Nieznany dostawca'}
          </div>
          {approval.snapshot_invoice_number && (
            <div style={{ fontSize: 12, color: '#718096' }}>
              Nr faktury: {approval.snapshot_invoice_number}
            </div>
          )}
          {approval.snapshot_description && (
            <div style={{ fontSize: 13, color: '#4a5568', marginTop: 4 }}>
              {approval.snapshot_description}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a202c' }}>
            {formatAmount(approval.snapshot_amount_gross)}
          </div>
          <div style={{ marginTop: 4 }}>
            <Badge variant={STATUS_BADGE[approval.status]}>{STATUS_LABEL[approval.status]}</Badge>
          </div>
        </div>
      </div>

      {approval.message_to_client && (
        <div
          style={{
            marginTop:    12,
            padding:      '10px 12px',
            background:   '#f1f5f9',
            borderRadius: 6,
            fontSize:     13,
            color:        '#374151',
            borderLeft:   '3px solid #4f46e5',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginBottom: 4 }}>
            Wiadomość od wykonawcy:
          </div>
          {approval.message_to_client}
        </div>
      )}

      {!isPending && approval.client_comment && (
        <div style={{ marginTop: 10, fontSize: 13, color: '#718096' }}>
          <span style={{ fontWeight: 500 }}>Twój komentarz: </span>{approval.client_comment}
        </div>
      )}

      {!isPending && approval.responded_at && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#a0aec0' }}>
          Odpowiedziano: {formatDate(approval.responded_at)}
        </div>
      )}

      {isPending && canRespond && (
        <div style={{ marginTop: 14 }}>
          {showComment && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Opcjonalny komentarz do odpowiedzi…"
              rows={2}
              style={{
                width:        '100%',
                marginBottom: 10,
                padding:      '8px 10px',
                border:       '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize:     13,
                fontFamily:   'inherit',
                resize:       'none',
                boxSizing:    'border-box',
              }}
            />
          )}
          {!showComment && (
            <button
              onClick={() => setShowComment(true)}
              style={{ fontSize: 12, color: '#718096', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10, textDecoration: 'underline' }}
            >
              + Dodaj komentarz
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              onClick={() => respond.mutate('accepted')}
              disabled={respond.isPending}
            >
              ✓ Akceptuję
            </Button>
            <Button
              variant="secondary"
              onClick={() => respond.mutate('questioned')}
              disabled={respond.isPending}
            >
              ? Mam pytanie
            </Button>
            <Button
              variant="ghost"
              onClick={() => respond.mutate('rejected')}
              disabled={respond.isPending}
            >
              ✕ Odrzucam
            </Button>
          </div>
        </div>
      )}

      {isPending && !canRespond && (
        <p style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
          Ten link dostępu nie pozwala na odpowiedź na akceptacje.
        </p>
      )}

      <div style={{ marginTop: 10, fontSize: 12, color: '#a0aec0' }}>
        Wysłano: {formatDate(approval.sent_at)}
      </div>
    </div>
  )
}

// ─── Główny komponent zakładki ────────────────────────────────────────────────

interface Props {
  sessionId:  string
  scope:      PortalScope[]
}

export function PortalApprovalsTab({ sessionId, scope }: Props) {
  const canRespond = scope.includes('respond_approvals')
  const canView    = scope.includes('read_approvals')

  const { data: approvals, isLoading } = useQuery({
    queryKey:      ['portal-approvals', sessionId],
    queryFn:       () => portalGetApprovals(sessionId),
    refetchInterval: 20_000,
    staleTime:     10_000,
    enabled:       canView,
  })

  if (!canView) {
    return (
      <Card>
        <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
          Ten link dostępu nie pozwala na przeglądanie akceptacji.
        </p>
      </Card>
    )
  }

  if (isLoading) return <Spinner />

  const list = approvals ?? []
  const pending  = list.filter(a => a.status === 'pending_client')
  const resolved = list.filter(a => a.status !== 'pending_client')

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {pending.length > 0 && (
        <Card>
          <h3 style={{ marginBottom: 16 }}>
            Wymagają Twojej odpowiedzi
            <span
              style={{
                display:      'inline-flex',
                alignItems:   'center',
                justifyContent: 'center',
                width:        20,
                height:       20,
                borderRadius: '50%',
                background:   '#f59e0b',
                color:        '#fff',
                fontSize:     11,
                fontWeight:   700,
                marginLeft:   8,
                verticalAlign: 'middle',
              }}
            >
              {pending.length}
            </span>
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {pending.map(a => (
              <ApprovalCard key={a.id} approval={a} sessionId={sessionId} canRespond={canRespond} />
            ))}
          </div>
        </Card>
      )}

      {resolved.length > 0 && (
        <Card>
          <h3 style={{ marginBottom: 16, color: '#718096' }}>Historia akceptacji</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {resolved.map(a => (
              <ApprovalCard key={a.id} approval={a} sessionId={sessionId} canRespond={false} />
            ))}
          </div>
        </Card>
      )}

      {list.length === 0 && (
        <Card>
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <p>Brak kosztów do akceptacji.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>
              Wykonawca powiadomi Cię, gdy pojawi się coś do zatwierdzenia.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
