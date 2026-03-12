import { useState }            from 'react'
import { useCostApprovals }    from '@/features/expenses/hooks/useCostApprovals'
import { useCreateCostApproval } from '@/features/expenses/hooks/useCreateCostApproval'
import { ApprovalStatusBadge } from './ApprovalStatusBadge'
import type { ApprovalStatus } from '@/features/expenses/api/cost-approvals.api'

interface Props { projectId: string }

type FilterKey = 'all' | ApprovalStatus

const FILTER_LABELS: Record<FilterKey, string> = {
  all:            'Wszystkie',
  pending_client: 'Oczekujące',
  accepted:       'Zaakceptowane',
  rejected:       'Odrzucone',
  questioned:     'Pytania',
  cancelled:      'Anulowane',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ProjectApprovalsTab({ projectId }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [cancelId, setCancelId] = useState<string | null>(null)

  const { data: approvals = [], isLoading } = useCostApprovals(projectId)
  const { cancel } = useCreateCostApproval(projectId)

  const visible = filter === 'all' ? approvals : approvals.filter((a) => a.status === filter)

  const totalGross = approvals
    .filter((a) => a.status === 'accepted')
    .reduce((sum, a) => sum + (a.snapshot_amount_gross ?? 0), 0)

  const pendingCount  = approvals.filter((a) => a.status === 'pending_client').length
  const acceptedCount = approvals.filter((a) => a.status === 'accepted').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>

      {/* Header + summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          Akceptacje kosztów
          {approvals.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted, #6b7280)' }}>
              ({approvals.length})
            </span>
          )}
        </h3>
        {approvals.length > 0 && (
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-muted, #6b7280)' }}>
            {pendingCount > 0 && <span>⏳ {pendingCount} oczekują</span>}
            {acceptedCount > 0 && (
              <span style={{ fontWeight: 600, color: 'var(--color-success, #16a34a)' }}>
                ✅ {totalGross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN zaakceptowane
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      {approvals.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
            const count = key === 'all' ? approvals.length : approvals.filter((a) => a.status === key).length
            if (key !== 'all' && count === 0) return null
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding:      '7px 14px',
                  border:       'none',
                  background:   'transparent',
                  fontWeight:   filter === key ? 700 : 400,
                  fontSize:     12,
                  color:        filter === key ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                  borderBottom: filter === key ? '2px solid var(--color-brand)' : '2px solid transparent',
                  cursor:       'pointer',
                  marginBottom: -1,
                }}
              >
                {FILTER_LABELS[key]}
                {count > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.75 }}>({count})</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted, #6b7280)' }}>
          <span className="spinner" style={{ width: 16, height: 16 }} />
          Ładowanie akceptacji…
        </div>
      )}

      {/* Empty state */}
      {!isLoading && approvals.length === 0 && (
        <div
          style={{
            textAlign: 'center', padding: '48px 24px',
            border: '2px dashed var(--color-border, #e5e7eb)',
            borderRadius: 10, color: 'var(--color-text-muted, #6b7280)',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Brak akceptacji kosztów</p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Wyślij koszt do akceptacji klienta z zakładki <strong>💰 Koszty</strong>.
          </p>
        </div>
      )}

      {/* Empty filter state */}
      {!isLoading && approvals.length > 0 && visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--color-text-muted, #6b7280)', fontSize: 13 }}>
          Brak akceptacji w tej kategorii.
        </div>
      )}

      {/* Approvals list */}
      {!isLoading && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((approval) => (
            <div
              key={approval.id}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: 14, borderRadius: 8,
                border: '1px solid var(--color-border, #e5e7eb)',
                background: 'var(--color-surface, #fff)',
              }}
            >
              {/* Status badge */}
              <div style={{ paddingTop: 2 }}>
                <ApprovalStatusBadge status={approval.status} showLabel={false} />
              </div>

              {/* Main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {approval.snapshot_vendor ?? 'Nieznany sprzedawca'}
                  </span>
                  {approval.snapshot_invoice_number && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted, #6b7280)' }}>
                      #{approval.snapshot_invoice_number}
                    </span>
                  )}
                  <ApprovalStatusBadge status={approval.status} />
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4, fontSize: 12, color: 'var(--color-text-muted, #6b7280)' }}>
                  {approval.snapshot_amount_gross != null && (
                    <span style={{ fontWeight: 600, color: 'var(--color-text, #111)' }}>
                      {approval.snapshot_amount_gross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                    </span>
                  )}
                  <span>Wysłano: {formatDate(approval.sent_at)}</span>
                  {approval.responded_at && (
                    <span>Odpowiedź: {formatDate(approval.responded_at)}</span>
                  )}
                </div>

                {/* Client comment */}
                {approval.client_comment && (
                  <div
                    style={{
                      marginTop: 8, padding: '6px 10px', borderRadius: 6,
                      background: 'var(--color-surface-soft, #f9fafb)',
                      border: '1px solid var(--color-border, #e5e7eb)',
                      fontSize: 13, fontStyle: 'italic',
                    }}
                  >
                    💬 {approval.client_comment}
                  </div>
                )}
              </div>

              {/* Actions */}
              {approval.status === 'pending_client' && (
                <div style={{ flexShrink: 0 }}>
                  {cancelId === approval.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 11, padding: '4px 10px', background: 'var(--color-danger, #dc2626)', borderColor: 'var(--color-danger, #dc2626)', color: '#fff' }}
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate({ approval_id: approval.id }, { onSuccess: () => setCancelId(null) })}
                      >
                        {cancel.isPending ? '…' : 'Tak, anuluj'}
                      </button>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setCancelId(null)}>
                        Nie
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => setCancelId(approval.id)}
                    >
                      Anuluj
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
