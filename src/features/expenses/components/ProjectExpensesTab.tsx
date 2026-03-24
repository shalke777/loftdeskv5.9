import { useState } from 'react'
import { translateError } from '@/shared/lib/errorMessages'
import type { ExpenseSourceType, CreateExpenseForProjectInput, ExpenseInvoiceV4 } from '@/features/expenses/api/expenses.api'
import { useProjectExpenses } from '@/features/expenses/hooks/useProjectExpenses'
import { useCreateExpense }   from '@/features/expenses/hooks/useCreateExpense'
import { useParseInvoice, callParseInvoiceAI } from '@/features/expenses/hooks/useParseInvoice'
import { ExpenseCameraCapture } from './ExpenseCameraCapture'
import { ExpensePreviewPane }   from './ExpensePreviewPane'
import { ExpenseConfirmForm }   from './ExpenseConfirmForm'
import { ApprovalStatusBadge } from './ApprovalStatusBadge'
import { ExpenseApprovalModal } from './ExpenseApprovalModal'
import type { ParseInvoiceResult } from '@/features/expenses/api/expenses.api'
import type { ApprovalStatus } from '@/features/expenses/api/cost-approvals.api'

type TabMode = 'list' | 'capture' | 'processing' | 'confirm'

interface Props { projectId: string }

const APPROVAL_LABELS: Record<ApprovalStatus | 'not_sent', string> = {
  not_sent:       'Nie wysłano',
  pending_client: 'Oczekuje na klienta',
  accepted:       'Zaakceptowany',
  rejected:       'Odrzucony',
  questioned:     'Klient ma pytanie',
  cancelled:      'Anulowany',
}

const SOURCE_ICONS: Record<string, string> = {
  camera:  '📷',
  gallery: '🖼️',
  pdf:     '📄',
  manual:  '✏️',
}

export function ProjectExpensesTab({ projectId }: Props) {
  const [mode,        setMode]        = useState<TabMode>('list')
  const [fileState,   setFileState]   = useState<File | null>(null)
  const [sourceType,  setSourceType]  = useState<ExpenseSourceType>('manual')
  const [parseResult, setParseResult] = useState<ParseInvoiceResult | null>(null)
  const [parseError,  setParseError]  = useState<string | null>(null)
  const [approvalExpense, setApprovalExpense] = useState<ExpenseInvoiceV4 | null>(null)

  const { data: expenses = [], isLoading } = useProjectExpenses(projectId)
  const createExpense = useCreateExpense(projectId)
  const parseInvoice  = useParseInvoice()

  // ── Handlers ──────────────────────────────────────────────────────────────

  function startCapture() { setMode('capture') }

  function startManual() {
    setFileState(null)
    setParseResult(null)
    setSourceType('manual')
    setMode('confirm')
  }

  function reset() {
    setMode('list')
    setFileState(null)
    setParseResult(null)
    setParseError(null)
    parseInvoice.reset()
    createExpense.reset()
  }

  function handleFileCapture(file: File, type: ExpenseSourceType) {
    setFileState(file)
    setSourceType(type)
    setParseResult(null)
    setMode('processing')

    parseInvoice.mutate(
      { file, sourceType: type },
      {
        onSuccess: async (ocrResult) => {
          const ocrConf = ocrResult?.extraction_confidence ?? 0
          if (ocrConf < 65) {
            // AI fallback — OCR returned low confidence
            try {
              const aiResult = await callParseInvoiceAI(file)
              const aiConf = aiResult.extraction_confidence ?? 0
              if (aiConf > 0 && aiConf >= ocrConf) {
                setParseResult(aiResult); setParseError(null); setMode('confirm')
                return
              }
            } catch (aiErr) { console.warn('[expenses] AI fallback failed (low OCR confidence):', aiErr) }
          }
          setParseResult(ocrResult); setParseError(null); setMode('confirm')
        },
        onError: async (err) => {
          // OCR failed entirely — try AI before showing error
          const msg = err instanceof Error ? err.message : 'Nie udało się odczytać faktury.'
          if (!msg.includes('Sesja wygasła') && !msg.includes('Za dużo żądań')) {
            try {
              const aiResult = await callParseInvoiceAI(file)
              if ((aiResult.extraction_confidence ?? 0) > 0) {
                setParseResult(aiResult); setParseError(null); setMode('confirm')
                return
              }
            } catch (aiErr) { console.warn('[expenses] AI fallback failed (OCR error):', aiErr) }
          }
          setParseError(msg); setMode('confirm')
        },
      },
    )
  }

  function handleSave(data: Omit<CreateExpenseForProjectInput, 'company_id' | 'project_id'> & { file?: File | null }) {
    createExpense.mutate(data, {
      onSuccess: reset,
    })
  }

  // ── Rendering: list ───────────────────────────────────────────────────────

  if (mode === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Koszty projektu
            {expenses.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)' }}>
                ({expenses.length})
              </span>
            )}
          </h3>
          <button type="button" className="btn" onClick={startCapture} style={{ fontSize: 13 }}>
            + Dodaj koszt
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <span className="spinner" style={{ width: 16, height: 16 }} />
            Ładowanie kosztów…
          </div>
        )}

        {/* Empty state */}
        {!isLoading && expenses.length === 0 && (
          <div
            style={{
              textAlign: 'center', padding: '48px 24px',
              border: '2px dashed var(--color-border)',
              borderRadius: 10, color: 'var(--color-text-muted)',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧾</div>
            <p style={{ margin: '0 0 16px', fontWeight: 600 }}>Brak kosztów</p>
            <p style={{ margin: '0 0 20px', fontSize: 13 }}>Dodaj pierwszy koszt projektu — zrób zdjęcie faktury lub wpisz ręcznie.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={startCapture}>📷 Zrób zdjęcie / PDF</button>
              <button type="button" className="btn btn-secondary" onClick={startManual}>✏️ Wpisz ręcznie</button>
            </div>
          </div>
        )}

        {/* Expense list */}
        {!isLoading && expenses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {expenses.map((exp) => (
              <div
                key={exp.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: 14, borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: exp.possible_duplicate
                    ? 'var(--color-warning-soft, rgba(212,150,10,0.12))'
                    : 'var(--color-surface)',
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>
                  {SOURCE_ICONS[exp.source_type ?? 'manual'] ?? '🧾'}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exp.vendor_name ?? exp.vendor ?? 'Nieznany sprzedawca'}
                    </span>
                    {exp.invoice_number && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        #{exp.invoice_number}
                      </span>
                    )}
                    {exp.possible_duplicate && (
                      <span
                        style={{
                          fontSize: 11, padding: '2px 6px', borderRadius: 99,
                          background: 'var(--color-warning, #D4960A)', color: '#fff', fontWeight: 600,
                        }}
                      >
                        Możliwy duplikat
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {exp.issue_date && <span>📅 {exp.issue_date}</span>}
                    {exp.amount_gross != null && (
                      <span style={{ fontWeight: 600, color: 'var(--color-text, #111)' }}>
                        {exp.amount_gross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} {exp.currency ?? 'PLN'}
                      </span>
                    )}
                    {exp.approval_status && (exp.approval_status as string) !== 'not_sent' && (
                      <ApprovalStatusBadge status={exp.approval_status as ApprovalStatus} />
                    )}
                    {exp.cost_type && <span>🏷️ {exp.cost_type}</span>}
                  </div>
                </div>

                {/* Send to approval button */}
                {(!exp.approval_status || (exp.approval_status as string) === 'not_sent') && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
                    onClick={() => setApprovalExpense(exp)}
                    title="Wyślij do akceptacji klienta"
                  >
                    📤 Akceptacja
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary row */}
        {expenses.length > 0 && (() => {
          const totalGross = expenses.reduce((sum, e) => sum + (e.amount_gross ?? 0), 0)
          return (
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--color-surface-soft)',
                border: '1px solid var(--color-border)',
                fontSize: 13, fontWeight: 600,
              }}
            >
              <span>Suma kosztów (brutto)</span>
              <span>{totalGross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN</span>
            </div>
          )
        })()}

        {/* Approval modal */}
        {approvalExpense && (
          <ExpenseApprovalModal
            projectId={projectId}
            expense={approvalExpense}
            onClose={() => setApprovalExpense(null)}
          />
        )}
      </div>
    )
  }

  // ── Rendering: capture ────────────────────────────────────────────────────

  if (mode === 'capture') {
    return (
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>
            ← Wróć
          </button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Dodaj koszt</h3>
        </div>
        <ExpenseCameraCapture onCapture={handleFileCapture} onManual={startManual} />
      </div>
    )
  }
  // ── Rendering: processing (OCR w toku) ─────────────────────────────────────

  if (mode === 'processing') {
    return (
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 13 }}>← Anuluj</button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Odczytuję fakturę…</h3>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: fileState ? 'minmax(0,1fr) minmax(0,1.4fr)' : '1fr', gap: 20, alignItems: 'start' }}>
          {fileState && (
            <ExpensePreviewPane file={fileState} parseResult={null} parsing={true} />
          )}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 20, padding: '52px 24px',
            background: 'var(--color-surface-soft)',
            border: '1px solid var(--color-border)',
            borderRadius: 8, minHeight: 280,
          }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 15 }}>Odczytuję tekst z faktury…</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                OCR analizuje obraz — zazwyczaj trwa 10–25&nbsp;sekund.<br />
                Pola zostaną wypełnione automatycznie.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  // ── Rendering: confirm ────────────────────────────────────────────────────

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={createExpense.isPending} style={{ fontSize: 13 }}>
          ← Wróć
        </button>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {fileState ? 'Potwierdź koszt' : 'Wpisz dane faktury'}
        </h3>
      </div>

      {createExpense.isError && (
        <div
          style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: 'var(--color-danger-soft, rgba(239,68,68,0.12))',
            border: '1px solid var(--color-danger, #EF6B6B)',
            color: 'var(--color-danger, #EF6B6B)',
          }}
        >
          Błąd zapisu: {translateError(createExpense.error)}
        </div>
      )}

      {parseError && (
        <div
          style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: 'var(--color-warning-soft, rgba(212,150,10,0.12))',
            border: '1px solid rgba(212,150,10,0.30)',
            color: 'var(--color-text, #111)',
          }}
        >
          ⚠️ Odczyt faktury nie powiódł się: {parseError} — uzupełnij pola ręcznie.
        </div>
      )}

      <div
        className="form-grid"
        style={{
          gridTemplateColumns: fileState ? 'minmax(0, 1fr) minmax(0, 1.4fr)' : '1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {fileState && (
          <ExpensePreviewPane
            file={fileState}
            parseResult={parseResult}
            parsing={parseInvoice.isPending}
          />
        )}

        <ExpenseConfirmForm
          projectId={projectId}
          parseResult={parseResult}
          sourceType={sourceType}
          file={fileState}
          onSave={handleSave}
          onCancel={reset}
          saving={createExpense.isPending}
        />
      </div>
    </div>
  )
}
