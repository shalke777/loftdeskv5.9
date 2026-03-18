import { useState } from 'react'
import { useCreateCostApproval } from '@/features/expenses/hooks/useCreateCostApproval'
import { useExpenseApprovals }   from '@/features/expenses/hooks/useCostApprovals'
import { ApprovalStatusBadge }   from './ApprovalStatusBadge'
import type { ExpenseInvoiceV4 } from '@/features/expenses/api/expenses.api'

interface Props {
  projectId: string
  expense:   ExpenseInvoiceV4
  onClose:   () => void
}

const s = {
  overlay: {
    position:       'fixed' as const,
    inset:          0,
    background:     'rgba(0,0,0,0.45)',
    zIndex:         1000,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '16px',
  } satisfies React.CSSProperties,

  modal: {
    background:   'var(--color-surface, #fff)',
    borderRadius: 12,
    width:        '100%',
    maxWidth:     520,
    maxHeight:    '90vh',
    overflowY:    'auto' as const,
    padding:      24,
    display:      'flex',
    flexDirection: 'column' as const,
    gap:          16,
  } satisfies React.CSSProperties,

  label: {
    display:    'block',
    fontSize:   12,
    fontWeight: 600,
    color:      'var(--color-text-muted, #6b7280)',
    marginBottom: 4,
  } satisfies React.CSSProperties,

  input: {
    width:         '100%',
    boxSizing:     'border-box' as const,
    padding:       '8px 10px',
    borderRadius:  6,
    fontSize:      14,
    border:        '1px solid var(--color-border, #d1d5db)',
    background:    'var(--color-surface, #fff)',
    color:         'var(--color-text, #111)',
  } satisfies React.CSSProperties,
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-muted, #6b7280)', minWidth: 130 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}

export function ExpenseApprovalModal({ projectId, expense, onClose }: Props) {
  const [message, setMessage] = useState('')

  const { create } = useCreateCostApproval(projectId)

  // Check if expense already has a pending approval
  const { data: existingApprovals = [] } = useExpenseApprovals(expense.id)
  const pendingApproval = existingApprovals.find((a) => a.status === 'pending_client')
  const latestApproval  = existingApprovals[0]

  // Gross amount display
  const amountStr = expense.amount_gross != null
    ? `${expense.amount_gross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} ${expense.currency ?? 'PLN'}`
    : '—'

  const vendorName = expense.vendor_name ?? expense.vendor ?? null

  function handleSend(e: React.FormEvent) {
    e.preventDefault()

    create.mutate(
      {
        expense_id:      expense.id,
        project_id:      projectId,
        message_to_client:       message.trim() || undefined,
        snapshot_vendor:         vendorName,
        snapshot_invoice_number: expense.invoice_number ?? null,
        snapshot_amount_gross:   expense.amount_gross ?? null,
        snapshot_description:    expense.description ?? (expense as any).notes ?? null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modal} role="dialog" aria-modal="true" aria-label="Wyślij do akceptacji">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Wyślij do akceptacji klienta</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted, #6b7280)', lineHeight: 1, padding: 4 }}
            aria-label="Zamknij"
          >×</button>
        </div>

        {/* Existing approval warning */}
        {pendingApproval && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef3c7', border: '1px solid #f59e0b', fontSize: 13 }}>
            ⚠️ Ten koszt ma już aktywną prośbę o akceptację.
            Wysłanie nowej spowoduje konflikt — anuluj poprzednią akceptację lub poczekaj na odpowiedź klienta.
          </div>
        )}

        {latestApproval && latestApproval.status !== 'pending_client' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted, #6b7280)' }}>
            Poprzedni status:
            <ApprovalStatusBadge status={latestApproval.status} />
          </div>
        )}

        {/* Snapshot — what the client will see */}
        <div style={{ background: 'var(--color-surface-soft, #f9fafb)', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted, #6b7280)' }}>
            Snapshot wysyłany do klienta
          </p>
          <Row label="Sprzedawca"   value={vendorName} />
          <Row label="Nr faktury"   value={expense.invoice_number} />
          <Row label="Data"         value={expense.issue_date} />
          <Row label="Kwota brutto" value={amountStr} />
          {(expense.description ?? (expense as any).notes) && (
            <Row label="Opis" value={expense.description ?? (expense as any).notes} />
          )}
        </div>

        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Optional message to client */}
          <div>
            <label style={s.label}>Wiadomość do klienta (opcjonalna)</label>
            <textarea
              style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Proszę o zatwierdzenie poniższego kosztu w ramach projektu…"
              maxLength={500}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted, #6b7280)' }}>{message.length}/500</span>
          </div>

          {/* Error */}
          {create.isError && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #dc2626', fontSize: 13, color: '#dc2626' }}>
              Błąd: {(create.error as Error)?.message ?? 'Nieznany błąd'}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={create.isPending}
            >Anuluj</button>
            <button
              type="submit"
              className="btn"
              disabled={create.isPending || !!pendingApproval}
            >
              {create.isPending ? 'Wysyłanie…' : '📤 Wyślij do akceptacji'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
