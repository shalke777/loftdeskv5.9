import { useState, useEffect, useCallback } from 'react'
import type {
  CreateExpenseForProjectInput,
  ExpenseSourceType,
  ExpenseCostType,
  DocumentLineItem,
} from '@/features/expenses/api/expenses.api'
import type { AnalysisResult } from '@/services/ai/analysis.types'
import { ExpenseConfidenceBadge } from './ExpenseConfidenceBadge'
import {
  DetectedMaterialsSection,
  WorkScopeSection,
  SuggestedEstimateSection,
} from './AnalysisSections'
import { ArrowLeftRight, Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'

interface Props {
  projectId:   string
  parseResult: AnalysisResult | null
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

// ── Editable Line Item model ──────────────────────────────────────────────────
interface EditableLineItem {
  id: string
  name: string
  quantity: string
  unit: string
  net_amount: string
  vat_rate: string
  gross_amount: string
}

let _itemIdCounter = 0
function nextItemId() { return `li-${++_itemIdCounter}-${Date.now()}` }

function docLineToEditable(item: DocumentLineItem): EditableLineItem {
  return {
    id: nextItemId(),
    name: item.name ?? '',
    quantity: item.quantity != null ? String(item.quantity) : '',
    unit: item.unit ?? '',
    net_amount: item.net_amount != null ? String(item.net_amount) : '',
    vat_rate: item.vat_rate != null ? String(item.vat_rate) : '',
    gross_amount: item.gross_amount != null ? String(item.gross_amount) : '',
  }
}

function editableToDocLine(item: EditableLineItem): DocumentLineItem {
  return {
    name: item.name || null,
    quantity: item.quantity ? parseFloat(item.quantity) : null,
    unit: item.unit || null,
    unit_net: null,
    net_amount: item.net_amount ? parseFloat(item.net_amount) : null,
    vat_rate: item.vat_rate ? parseInt(item.vat_rate, 10) : null,
    vat_amount: null,
    gross_amount: item.gross_amount ? parseFloat(item.gross_amount) : null,
  }
}

function emptyLineItem(): EditableLineItem {
  return { id: nextItemId(), name: '', quantity: '', unit: 'szt', net_amount: '', vat_rate: '23', gross_amount: '' }
}

// ── Form state ───────────────────────────────────────────────────────────────
function emptyState() {
  return {
    vendor_name:      '',
    vendor_nip:       '',
    buyer_name:       '',
    buyer_nip:        '',
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

const AUTOFILL_FIELDS: (keyof FormState)[] = [
  'vendor_name', 'vendor_nip', 'buyer_name', 'buyer_nip', 'invoice_number', 'issue_date',
  'sale_date', 'net_amount', 'vat_amount', 'gross_amount', 'currency', 'payment_due_date',
]

const UNIT_OPTIONS = ['szt', 'm²', 'mb', 'km', 'kg', 'l', 'kpl', 'op', 'rbh', 'godz', 'h', 'ton', 'zest']
const VAT_OPTIONS = ['23', '8', '5', '0', 'zw']

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
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([])
  const [lineItemsDirty, setLineItemsDirty] = useState(false)
  const [autofilled, setAutofilled] = useState<Set<keyof FormState>>(new Set())

  const isRoomPhoto = parseResult?.input_type === 'room_photo'

  // Pre-fill from parse result
  useEffect(() => {
    if (!parseResult) return

    if (isRoomPhoto) {
      setForm({
        ...emptyState(),
        notes: parseResult.document_fields?.notes ?? '',
        cost_type: 'material',
      })
      return
    }

    const df = parseResult.document_fields
    const next: FormState = {
      vendor_name:      df?.vendor_name      ?? '',
      vendor_nip:       df?.vendor_nip        ?? '',
      buyer_name:       df?.buyer_name        ?? '',
      buyer_nip:        df?.buyer_nip         ?? '',
      invoice_number:   df?.document_number   ?? '',
      issue_date:       df?.issue_date        ?? '',
      sale_date:        df?.sale_date         ?? '',
      net_amount:       df?.net_amount        != null ? String(df.net_amount)    : '',
      vat_amount:       df?.vat_amount        != null ? String(df.vat_amount)    : '',
      gross_amount:     df?.gross_amount      != null ? String(df.gross_amount)  : '',
      currency:         df?.currency          ?? 'PLN',
      cost_type:        '',
      category:         '',
      payment_due_date: df?.payment_due_date ?? '',
      notes:            df?.notes             ?? '',
    }
    setForm(next)

    const filled = new Set<keyof FormState>(
      AUTOFILL_FIELDS.filter((k) => {
        const v = next[k]
        return v !== '' && v !== 'PLN'
      })
    )
    setAutofilled(filled)

    // Initialize editable line items from parse result
    if (parseResult.line_items && parseResult.line_items.length > 0) {
      setLineItems(parseResult.line_items.map(docLineToEditable))
    }
  }, [parseResult])

  function set(field: keyof FormState, value: string) {
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

  // ── Swap buyer ↔ vendor ──────────────────────────────────────────────────
  const handleSwapBuyerVendor = useCallback(() => {
    setForm(prev => ({
      ...prev,
      vendor_name: prev.buyer_name,
      vendor_nip:  prev.buyer_nip,
      buyer_name:  prev.vendor_name,
      buyer_nip:   prev.vendor_nip,
    }))
    setAutofilled(new Set())
  }, [])

  // ── Line item CRUD ─────────────────────────────────────────────────────────
  const updateLineItem = useCallback((id: string, field: keyof EditableLineItem, value: string) => {
    setLineItemsDirty(true)
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const next = { ...item, [field]: value }
      // Auto-calc gross from net + vat
      if (field === 'net_amount' || field === 'vat_rate') {
        const net = parseFloat(field === 'net_amount' ? value : next.net_amount)
        const vatPct = parseInt(field === 'vat_rate' ? value : next.vat_rate, 10)
        if (!isNaN(net) && !isNaN(vatPct)) {
          next.gross_amount = String(Math.round(net * (1 + vatPct / 100) * 100) / 100)
        }
      }
      return next
    }))
  }, [])

  const addLineItem = useCallback(() => {
    setLineItemsDirty(true)
    setLineItems(prev => [...prev, emptyLineItem()])
  }, [])

  const removeLineItem = useCallback((id: string) => {
    setLineItemsDirty(true)
    setLineItems(prev => prev.filter(item => item.id !== id))
  }, [])

  // Sum validation: compare line items gross sum vs form gross
  const lineItemsSum = lineItems.reduce((sum, item) => {
    const g = parseFloat(item.gross_amount)
    return sum + (isNaN(g) ? 0 : g)
  }, 0)
  const formGross = parseFloat(form.gross_amount)
  const sumMismatch = lineItems.length > 0 && !isNaN(formGross) && formGross > 0
    && Math.abs(lineItemsSum - formGross) > formGross * 0.05

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isRoomPhoto && !form.vendor_name.trim()) return alert('Podaj nazwę sprzedawcy')

    const vendorName = isRoomPhoto
      ? (form.vendor_name.trim() || `Analiza pomieszczenia ${new Date().toLocaleDateString('pl-PL')}`)
      : form.vendor_name.trim()

    // Merge edited line items back into analysis_payload for persistence
    const editedPayload: typeof parseResult = parseResult ? {
      ...parseResult,
      line_items: lineItems.map(editableToDocLine),
      document_fields: parseResult.document_fields ? {
        ...parseResult.document_fields,
        buyer_name: form.buyer_name.trim() || null,
        buyer_nip:  form.buyer_nip.trim()  || null,
      } : parseResult.document_fields,
    } : null

    onSave({
      file,
      source_type:    sourceType,
      vendor_name:    vendorName,
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
      analysis_payload:           editedPayload ?? null,
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
      ? { ...inputStyle, borderLeftColor: 'var(--color-success)', borderLeftWidth: 3 }
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

      {/* Editable line items — card list */}
      {!isRoomPhoto && lineItems.length > 0 && (
        <EditableLineItemsList
          items={lineItems}
          onUpdate={updateLineItem}
          onRemove={removeLineItem}
          onAdd={addLineItem}
          sumMismatch={sumMismatch}
          lineItemsSum={lineItemsSum}
          formGross={formGross}
          inputStyle={inputStyle}
        />
      )}
      {!isRoomPhoto && lineItems.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={addLineItem}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
            <Plus size={14} /> Dodaj pozycję
          </button>
        </div>
      )}

      {/* Future analysis sections */}
      {parseResult?.detected_materials && parseResult.detected_materials.length > 0 && (
        <DetectedMaterialsSection items={parseResult.detected_materials} />
      )}
      {parseResult?.work_scope && parseResult.work_scope.length > 0 && (
        <WorkScopeSection items={parseResult.work_scope} />
      )}
      {parseResult?.suggested_estimate_items && parseResult.suggested_estimate_items.length > 0 && (
        <SuggestedEstimateSection items={parseResult.suggested_estimate_items} />
      )}

      {/* Section: sprzedawca — hidden for room_photo */}
      {!isRoomPhoto && (
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
      )}

      {/* Section: nabywca — editable with swap button */}
      {!isRoomPhoto && (
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <legend style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', marginBottom: 4, padding: 0, display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          Nabywca
          <button type="button" onClick={handleSwapBuyerVendor}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-brand)', background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', marginLeft: 'auto' }}
            title="Zamień nabywcę ze sprzedawcą">
            <ArrowLeftRight size={12} /> Zamień
          </button>
        </legend>

        <div style={fieldStyle}>
          <label style={labelStyle}>Nazwa nabywcy <AutoChip field="buyer_name" /></label>
          <input
            style={autoStyle('buyer_name')}
            value={form.buyer_name}
            onChange={(e) => set('buyer_name', e.target.value)}
            placeholder="np. Twoja firma Sp. z o.o."
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>NIP nabywcy <AutoChip field="buyer_nip" /></label>
          <input
            style={autoStyle('buyer_nip')}
            value={form.buyer_nip}
            onChange={(e) => set('buyer_nip', e.target.value)}
            placeholder="10 cyfr"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
      </fieldset>
      )}

      {/* Section: faktura — hidden for room_photo */}
      {!isRoomPhoto && (
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
      )}

      {/* Section: kwoty — hidden for room_photo */}
      {!isRoomPhoto && (
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
      )}

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
          disabled={saving || (!isRoomPhoto && !form.vendor_name.trim())}
        >
          {saving ? 'Zapisywanie…' : isRoomPhoto ? 'Zapisz analizę' : 'Zapisz koszt'}
        </button>
      </div>
    </form>
  )
}

// ── Editable Line Items Card List ───────────────────────────────────────────

interface EditableLineItemsListProps {
  items: EditableLineItem[]
  onUpdate: (id: string, field: keyof EditableLineItem, value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
  sumMismatch: boolean
  lineItemsSum: number
  formGross: number
  inputStyle: React.CSSProperties
}

function EditableLineItemsList({ items, onUpdate, onRemove, onAdd, sumMismatch, lineItemsSum, formGross, inputStyle }: EditableLineItemsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const miniInput: React.CSSProperties = {
    ...inputStyle,
    padding: '5px 8px',
    fontSize: 12,
  }

  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <legend style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', marginBottom: 4, padding: 0, display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        📋 Pozycje ({items.length})
        <button type="button" onClick={onAdd}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', padding: '2px 0' }}>
          <Plus size={12} /> Dodaj
        </button>
      </legend>

      {items.map((item, idx) => {
        const isExpanded = expandedId === item.id
        const gross = parseFloat(item.gross_amount)
        return (
          <div key={item.id} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '8px 10px',
          }}>
            {/* Compact header — always visible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 18 }}>{idx + 1}.</span>
              <input
                style={{ ...miniInput, flex: 1 }}
                value={item.name}
                onChange={(e) => onUpdate(item.id, 'name', e.target.value)}
                placeholder="Nazwa pozycji"
              />
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 65, textAlign: 'right', color: 'var(--color-text)' }}>
                {!isNaN(gross) ? gross.toFixed(2) : '—'}
              </span>
              <button type="button" onClick={() => setExpandedId(isExpanded ? null : item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-text-muted)' }}>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button type="button" onClick={() => onRemove(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-error)' }}>
                <Trash2 size={13} />
              </button>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Ilość</label>
                  <input style={miniInput} type="number" step="0.01" value={item.quantity}
                    onChange={(e) => onUpdate(item.id, 'quantity', e.target.value)} placeholder="—" />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Jednostka</label>
                  <select style={miniInput} value={item.unit} onChange={(e) => onUpdate(item.id, 'unit', e.target.value)}>
                    <option value="">—</option>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>VAT %</label>
                  <select style={miniInput} value={item.vat_rate} onChange={(e) => onUpdate(item.id, 'vat_rate', e.target.value)}>
                    <option value="">—</option>
                    {VAT_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Netto</label>
                  <input style={miniInput} type="number" step="0.01" value={item.net_amount}
                    onChange={(e) => onUpdate(item.id, 'net_amount', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Brutto</label>
                  <input style={miniInput} type="number" step="0.01" value={item.gross_amount}
                    onChange={(e) => onUpdate(item.id, 'gross_amount', e.target.value)} placeholder="0.00" />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Sum mismatch warning */}
      {sumMismatch && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(184, 116, 42, 0.1)', border: '1px solid rgba(184, 116, 42, 0.3)', borderRadius: 6, fontSize: 12, color: 'var(--color-warning)' }}>
          <AlertTriangle size={14} />
          Suma pozycji ({lineItemsSum.toFixed(2)}) ≠ kwota brutto faktury ({isNaN(formGross) ? '—' : formGross.toFixed(2)})
        </div>
      )}
    </fieldset>
  )
}
