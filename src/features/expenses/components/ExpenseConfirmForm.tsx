import { useState, useEffect } from 'react'
import type {
  ParseInvoiceResult,
  ParseInvoiceLineItem,
  CreateExpenseForProjectInput,
  ExpenseSourceType,
  ExpenseCostType,
} from '@/features/expenses/api/expenses.api'
import { ExpenseConfidenceBadge } from './ExpenseConfidenceBadge'

interface Props {
  projectId:   string
  parseResult: ParseInvoiceResult | null
  sourceType:  ExpenseSourceType
  file:        File | null
  onSave:      (data: Omit<CreateExpenseForProjectInput, 'company_id' | 'project_id'> & { file?: File | null }) => void
  onCancel:    () => void
  saving:      boolean
}

const COST_TYPE_LABELS: Record<ExpenseCostType | 'other', string> = {
  material:   'Materiały',
  service:    'Usługi',
  equipment:  'Sprzęt / narzędzia',
  labor:      'Robocizna',
  transport:  'Transport',
  other:      'Inne',
}

const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP']

function emptyState() {
  return {
    vendor_name:      '',
    vendor_nip:       '',
    invoice_number:   '',
    issue_date:       '',
    sale_date:        '',
    net_amount:       '',
    vat_amount:       '',
    gross_amount:     '',
    currency:         'PLN',
    cost_type:        '' as ExpenseCostType | '',
    category:         '',
    payment_due_date: '',
    notes:            '',
  }
}

type FormState = ReturnType<typeof emptyState>

// ── Line items read-only display (AI extraction) ─────────────────────────────

function LineItemsSection({ items }: { items: ParseInvoiceLineItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 8, overflow: 'hidden',
        background: 'var(--color-surface-soft, rgba(0,0,0,0.02))',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
          color: 'var(--color-text-muted)',
        }}
      >
        <span>Pozycje faktury ({items.length})</span>
        <span style={{ fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px', fontWeight: 600 }}>#</th>
                <th style={{ padding: '6px 4px', fontWeight: 600 }}>Nazwa</th>
                <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>Ilość</th>
                <th style={{ padding: '6px 4px', fontWeight: 600 }}>J.m.</th>
                <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>Netto</th>
                <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>VAT%</th>
                <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>Brutto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '6px 4px', color: 'var(--color-text-muted)' }}>{i + 1}</td>
                  <td style={{ padding: '6px 4px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name ?? '—'}
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                    {item.quantity != null ? item.quantity : '—'}
                  </td>
                  <td style={{ padding: '6px 4px' }}>{item.unit ?? '—'}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                    {item.net_amount != null ? item.net_amount.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                    {item.vat_rate != null ? `${item.vat_rate}%` : '—'}
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>
                    {item.gross_amount != null ? item.gross_amount.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Fields that can be auto-filled from OCR result
const AUTOFILL_FIELDS: (keyof FormState)[] = [
  'vendor_name', 'vendor_nip', 'invoice_number', 'issue_date',
  'sale_date', 'net_amount', 'vat_amount', 'gross_amount', 'currency', 'payment_due_date',
]

export function ExpenseConfirmForm({
  projectId,
  parseResult,
  sourceType,
  file,
  onSave,
  onCancel,
  saving,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyState())
  // Track which fields were populated from the parse result (for autofill badge)
  const [autofilled, setAutofilled] = useState<Set<keyof FormState>>(new Set())

  // Pre-fill from parse result
  useEffect(() => {
    if (!parseResult) return
    const next: FormState = {
      vendor_name:      parseResult.vendor_name      ?? '',
      vendor_nip:       parseResult.vendor_nip        ?? '',
      invoice_number:   parseResult.invoice_number   ?? '',
      issue_date:       parseResult.issue_date        ?? '',
      sale_date:        parseResult.sale_date         ?? '',
      net_amount:       parseResult.net_amount        != null ? String(parseResult.net_amount)    : '',
      vat_amount:       parseResult.vat_amount        != null ? String(parseResult.vat_amount)    : '',
      gross_amount:     parseResult.gross_amount      != null ? String(parseResult.gross_amount)  : '',
      currency:         parseResult.currency          ?? 'PLN',
      cost_type:        '',
      category:         '',
      payment_due_date: parseResult.payment_due_date ?? '',
      notes:            parseResult.notes             ?? '',
    }
    setForm(next)
    // Mark which fields actually got a value from the parser
    const filled = new Set<keyof FormState>(
      AUTOFILL_FIELDS.filter((k) => {
        const v = next[k]
        return v !== '' && v !== 'PLN' // PLN is default, not an extracted value
      })
    )
    setAutofilled(filled)
  }, [parseResult])

  function set(field: keyof FormState, value: string) {
    // Once the user edits a field, remove the "auto" indicator — the value is no longer purely from OCR.
    setAutofilled(prev => { const next = new Set(prev); next.delete(field); return next })
    setForm((prev) => {
      const next = { ...prev, [field]: value }

      // Auto-derive gross = net + vat
      if ((field === 'net_amount' || field === 'vat_amount') && !next.gross_amount) {
        const n = parseFloat(next.net_amount)
        const v = parseFloat(next.vat_amount)
        if (!isNaN(n) && !isNaN(v)) next.gross_amount = String(Math.round((n + v) * 100) / 100)
      }

      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vendor_name.trim()) return alert('Podaj nazwę sprzedawcy')

    onSave({
      file,
      source_type:    sourceType,
      vendor_name:    form.vendor_name.trim(),
      vendor_nip:     form.vendor_nip.trim()  || null,
      invoice_number: form.invoice_number.trim() || null,
      issue_date:     form.issue_date    || null,
      sale_date:      form.sale_date     || null,
      net_amount:     form.net_amount    ? parseFloat(form.net_amount)    : null,
      vat_amount:     form.vat_amount    ? parseFloat(form.vat_amount)    : null,
      gross_amount:   form.gross_amount  ? parseFloat(form.gross_amount)  : null,
      currency:       form.currency,
      cost_type:      (form.cost_type as ExpenseCostType) || null,
      category:       form.category.trim()  || null,
      payment_due_date: form.payment_due_date || null,
      notes:          form.notes.trim()     || null,
      extraction_confidence:      parseResult?.extraction_confidence      ?? null,
      extraction_warnings:        parseResult?.extraction_warnings        ?? null,
      requires_user_confirmation: parseResult?.requires_user_confirmation ?? null,
      parser_source:              parseResult?.parser_source              ?? 'manual',
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px', borderRadius: 6, fontSize: 14,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text, #111)',
  }
  const labelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 600,
    color: 'var(--color-text-muted)', marginBottom: 4,
  }
  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column' }

  // Returns extra style for autofilled inputs (subtle left-border tint)
  function autoStyle(field: keyof FormState): React.CSSProperties {
    return autofilled.has(field)
      ? { ...inputStyle, borderLeftColor: 'var(--color-success, #77BA8A)', borderLeftWidth: 3 }
      : inputStyle
  }

  // Small "auto" chip shown beside label when field was autofilled
  function AutoChip({ field }: { field: keyof FormState }) {
    return autofilled.has(field)
      ? <span className="exp-label-auto">auto</span>
      : null
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Confidence badge */}
      {parseResult && (
        <ExpenseConfidenceBadge
          confidence={parseResult.extraction_confidence}
          warnings={parseResult.extraction_warnings}
        />
      )}

      {/* Line items from AI extraction (read-only) */}
      {parseResult?.line_items && parseResult.line_items.length > 0 && (
        <LineItemsSection items={parseResult.line_items} />
      )}

      {/* Section: sprzedawca */}
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <legend style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', marginBottom: 4, padding: 0 }}>
          Sprzedawca
        </legend>

        <div style={fieldStyle}>
          <label style={labelStyle}>Nazwa sprzedawcy * <AutoChip field="vendor_name" /></label>
          <input
            style={autoStyle('vendor_name')}
            value={form.vendor_name}
            onChange={(e) => set('vendor_name', e.target.value)}
            placeholder="np. ABC Sp. z o.o."
            required
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>NIP sprzedawcy <AutoChip field="vendor_nip" /></label>
          <input
            style={autoStyle('vendor_nip')}
            value={form.vendor_nip}
            onChange={(e) => set('vendor_nip', e.target.value)}
            placeholder="10 cyfr"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
      </fieldset>

      {/* Section: faktura */}
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <legend style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', marginBottom: 4, padding: 0 }}>
          Faktura
        </legend>

        <div style={fieldStyle}>
          <label style={labelStyle}>Numer faktury <AutoChip field="invoice_number" /></label>
          <input
            style={autoStyle('invoice_number')}
            value={form.invoice_number}
            onChange={(e) => set('invoice_number', e.target.value)}
            placeholder="np. FV/2026/001"
          />
        </div>

        <div className="form-grid" style={{ gap: 10 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Data wystawienia <AutoChip field="issue_date" /></label>
            <input
              style={autoStyle('issue_date')}
              type="date"
              value={form.issue_date}
              onChange={(e) => set('issue_date', e.target.value)}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Data sprzedaży</label>
            <input
              style={inputStyle}
              type="date"
              value={form.sale_date}
              onChange={(e) => set('sale_date', e.target.value)}
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Termin płatności</label>
          <input
            style={inputStyle}
            type="date"
            value={form.payment_due_date}
            onChange={(e) => set('payment_due_date', e.target.value)}
          />
        </div>
      </fieldset>

      {/* Section: kwoty */}
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <legend style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', marginBottom: 4, padding: 0 }}>
          Kwoty
        </legend>

        <div className="form-grid" style={{ gap: 10 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Netto <AutoChip field="net_amount" /></label>
            <input
              style={autoStyle('net_amount')}
              type="number"
              step="0.01"
              min="0"
              value={form.net_amount}
              onChange={(e) => set('net_amount', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>VAT <AutoChip field="vat_amount" /></label>
            <input
              style={autoStyle('vat_amount')}
              type="number"
              step="0.01"
              min="0"
              value={form.vat_amount}
              onChange={(e) => set('vat_amount', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Brutto <AutoChip field="gross_amount" /></label>
            <input
              style={autoStyle('gross_amount')}
              type="number"
              step="0.01"
              min="0"
              value={form.gross_amount}
              onChange={(e) => set('gross_amount', e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Waluta</label>
          <select
            style={inputStyle}
            value={form.currency}
            onChange={(e) => set('currency', e.target.value)}
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </fieldset>

      {/* Section: klasyfikacja */}
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <legend style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', marginBottom: 4, padding: 0 }}>
          Klasyfikacja
        </legend>

        <div style={fieldStyle}>
          <label style={labelStyle}>Typ kosztu</label>
          <select
            style={inputStyle}
            value={form.cost_type}
            onChange={(e) => set('cost_type', e.target.value)}
          >
            <option value="">— wybierz —</option>
            {(Object.entries(COST_TYPE_LABELS) as [ExpenseCostType | 'other', string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Kategoria (opcjonalna)</label>
          <input
            style={inputStyle}
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            placeholder="np. Instalacje elektryczne"
          />
        </div>
      </fieldset>

      {/* Notes */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Notatka</label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Opis towarów / usług…"
        />
      </div>

      {/* Buttons */}
      <div className="actions-row" style={{ paddingTop: 4 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="btn"
          disabled={saving || !form.vendor_name.trim()}
        >
          {saving ? 'Zapisywanie…' : 'Zapisz koszt'}
        </button>
      </div>
    </form>
  )
}
