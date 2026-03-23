import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { Select } from '@/shared/ui/Select/Select'
import { useToast } from '@/shared/hooks/useToast'
import type { CreateInvoiceInput, Invoice, InvoiceItem } from '@/entities/invoice/model'
import { generateId } from '@/shared/lib/generateId'
import { useClients } from '@/features/clients/hooks/useClients'
import { useContracts } from '@/features/contracts/hooks/useContracts'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { calcInvoiceTotals } from '@/features/invoices/lib/invoice.calculations'
import { formatCurrency } from '@/shared/lib/formatters'
import { useSettings } from '@/features/settings/hooks/useSettings'

const INVOICE_TYPE_OPTIONS = [
  { value: 'standard', label: 'Faktura VAT (standardowa)' },
  { value: 'advance', label: 'Faktura zaliczkowa' },
  { value: 'final', label: 'Faktura końcowa' },
  { value: 'partial', label: 'Faktura częściowa' },
]
const PAYMENT_METHOD_OPTIONS = [
  { value: 'transfer', label: 'Przelew bankowy' },
  { value: 'cash', label: 'Gotówka' },
  { value: 'card', label: 'Karta płatnicza' },
]
const DUE_DAYS_OPTIONS = [
  { value: '3', label: '3 dni' },
  { value: '7', label: '7 dni' },
  { value: '14', label: '14 dni' },
  { value: '30', label: '30 dni' },
  { value: '60', label: '60 dni' },
]

const DRAFT_KEY = 'invoice_form_draft'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function loadDraft() {
  try { const r = sessionStorage.getItem(DRAFT_KEY); if (r) return JSON.parse(r) as Record<string, unknown> } catch { /* ignore */ }
  return null
}
function saveDraft(data: object) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)) } catch { /* ignore */ } }
function clearDraft() { try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ } }

interface Props { companyId: string; onSubmit: (input: CreateInvoiceInput) => Promise<void>; initialInvoice?: Invoice | null }

export function InvoiceForm({ companyId, onSubmit, initialInvoice }: Props) {
  const isNew = !initialInvoice
  const saveGuard = useRef(false)
  const [submitting, setSubmitting] = useState(false)

  const { profile } = useSettings()
  const companyIban = (profile as any)?.iban || ''

  const [invoiceType, setInvoiceType] = useState('standard')
  const [issueDate, setIssueDate] = useState(todayStr())
  const [saleDate, setSaleDate] = useState(todayStr())
  const [dueDays, setDueDays] = useState('14')
  const [dueDate, setDueDate] = useState(() => addDays(todayStr(), 14))
  const [issuePlace, setIssuePlace] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [bankAccount, setBankAccount] = useState('')
  const [clientId, setClientId] = useState('')
  const [contractId, setContractId] = useState('')
  const [selectedTrancheId, setSelectedTrancheId] = useState('')
  const [advanceTotal, setAdvanceTotal] = useState('0')
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [notes, setNotes] = useState('')
  const [projectId, setProjectId] = useState('')

  const { data: clients = [] } = useClients()
  const { data: contracts = [] } = useContracts()
  const { data: projects = [] } = useProjects()
  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.name })), [clients])
  const contractOptions = useMemo(() => contracts.map((c) => ({ value: c.id, label: `${c.number} · ${formatCurrency(c.value)}` })), [contracts])
  const projectOptions = useMemo(() => projects.map((p) => ({ value: p.id, label: `${p.number} · ${p.name}` })), [projects])
  const selectedContract = useMemo(() => contracts.find((c) => c.id === contractId) ?? null, [contracts, contractId])
  const trancheOptions = useMemo(() => (selectedContract?.tranches ?? []).map((t) => ({ value: t.id, label: `${t.label} · ${formatCurrency(t.amount)}` })), [selectedContract])
  const totals = useMemo(() => calcInvoiceTotals(items), [items])
  const vatDiff = totals.totalGross - totals.totalNet
  const remainsToPay = Math.max(0, totals.totalGross - Number(advanceTotal))

  // ── Init: edit mode or draft/defaults ──────────────────────────────────────
  useEffect(() => {
    saveGuard.current = false
    if (initialInvoice) {
      setInvoiceType(initialInvoice.invoice_type || 'standard')
      setIssueDate(initialInvoice.issue_date || todayStr())
      setSaleDate(initialInvoice.sale_date || todayStr())
      setDueDays('14')
      setDueDate(initialInvoice.due_date || addDays(initialInvoice.issue_date || todayStr(), 14))
      setIssuePlace(initialInvoice.issue_place || '')
      setPaymentMethod(initialInvoice.payment_method || 'transfer')
      setBankAccount(initialInvoice.bank_account || '')
      setClientId(initialInvoice.client_id || '')
      setContractId(initialInvoice.contract_id || '')
      setSelectedTrancheId('')
      setAdvanceTotal(String(initialInvoice.advance_total ?? 0))
      setItems(initialInvoice.items?.length ? initialInvoice.items : [{ id: generateId(), description: 'Usługa', unit: 'kpl', quantity: 1, unit_price: 0, vat_rate: 23, sort_order: 1, tranche_label: '' }])
      setProjectId(initialInvoice.project_id || '')
      setNotes(initialInvoice.notes || '')
    } else {
      const draft = loadDraft()
      if (draft) {
        setInvoiceType((draft.invoiceType as string) ?? 'standard')
        setIssueDate((draft.issueDate as string) ?? todayStr())
        setSaleDate((draft.saleDate as string) ?? todayStr())
        setDueDays((draft.dueDays as string) ?? '14')
        setDueDate((draft.dueDate as string) ?? addDays(todayStr(), 14))
        setIssuePlace((draft.issuePlace as string) ?? '')
        setPaymentMethod((draft.paymentMethod as string) ?? 'transfer')
        setBankAccount((draft.bankAccount as string) ?? '')
        setClientId((draft.clientId as string) ?? '')
        setContractId((draft.contractId as string) ?? '')
        setSelectedTrancheId('')
        setAdvanceTotal((draft.advanceTotal as string) ?? '0')
        setItems((draft.items as InvoiceItem[]) ?? [{ id: generateId(), description: 'Usługa', unit: 'kpl', quantity: 1, unit_price: 0, vat_rate: 23, sort_order: 1, tranche_label: '' }])
        setProjectId((draft.projectId as string) ?? '')
        setNotes((draft.notes as string) ?? '')
      } else {
        // fresh defaults
        const today = todayStr()
        setInvoiceType('standard')
        setIssueDate(today); setSaleDate(today)
        setDueDays('14'); setDueDate(addDays(today, 14))
        setIssuePlace(''); setPaymentMethod('transfer')
        setBankAccount(companyIban)
        setClientId(''); setContractId(''); setSelectedTrancheId(''); setAdvanceTotal('0')
        setItems([{ id: generateId(), description: 'Usługa', unit: 'kpl', quantity: 1, unit_price: 0, vat_rate: 23, sort_order: 1, tranche_label: '' }])
        setProjectId(''); setNotes('')
      }
    }
    const t = setTimeout(() => { saveGuard.current = true }, 0)
    return () => clearTimeout(t)
  }, [initialInvoice, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill IBAN once profile loads (new form only, if field still empty) ─
  useEffect(() => {
    if (isNew && companyIban && !bankAccount) setBankAccount(companyIban)
  }, [companyIban]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill client when contract changes ──────────────────────────────────
  useEffect(() => {
    if (selectedContract?.client_id) setClientId(selectedContract.client_id)
    if (selectedContract?.location) setIssuePlace(selectedContract.location)
  }, [selectedContract])

  // ── Recalculate dueDate when issueDate or dueDays changes ───────────────────
  useEffect(() => {
    if (!saveGuard.current) return
    setDueDate(addDays(issueDate, Number(dueDays)))
  }, [issueDate, dueDays])

  // ── Persist draft on every change (new form only) ──────────────────────────
  useEffect(() => {
    if (!isNew || !saveGuard.current) return
    saveDraft({ invoiceType, issueDate, saleDate, dueDays, dueDate, issuePlace, paymentMethod, bankAccount, clientId, contractId, advanceTotal, items, projectId, notes })
  }, [invoiceType, issueDate, saleDate, dueDays, dueDate, issuePlace, paymentMethod, bankAccount, clientId, contractId, advanceTotal, items, projectId, notes, isNew])

  function applyTranche(trancheId: string) {
    setSelectedTrancheId(trancheId)
    const tranche = selectedContract?.tranches?.find((t) => t.id === trancheId)
    if (!tranche || !selectedContract) return
    const lbl = tranche.label.toLowerCase()
    const autoType = lbl.includes('zaliczka') ? 'advance' : lbl.includes('końcow') || lbl.includes('koncow') ? 'final' : 'partial'
    setInvoiceType(autoType)
    const vatRate = (selectedContract as any).vat_rate ?? 23
    const trancheNet = Math.round((tranche.amount / (1 + vatRate / 100)) * 100) / 100
    const trancheDesc = autoType === 'advance'
      ? `Zaliczka na wykonanie robót budowlanych zgodnie z umową nr ${selectedContract.number} – ${tranche.label}`
      : autoType === 'final'
      ? `Rozliczenie końcowe – umowa nr ${selectedContract.number} – ${tranche.label}`
      : `Wykonanie robót – umowa nr ${selectedContract.number} – ${tranche.label}`
    setItems([{ id: generateId(), description: trancheDesc, unit: 'kpl', quantity: 1, unit_price: trancheNet, vat_rate: vatRate, sort_order: 1, tranche_label: tranche.label }])
    if (tranche.due_date) setDueDate(tranche.due_date)
  }

  const toast = useToast()

  function patchItem(id: string, key: keyof InvoiceItem, value: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [key]: ['quantity', 'unit_price', 'vat_rate', 'sort_order'].includes(String(key)) ? Number(value) : value } : item))
  }
  function addItem() { setItems((prev) => [...prev, { id: generateId(), description: 'Nowa pozycja', unit: 'kpl', quantity: 1, unit_price: 0, vat_rate: 23, sort_order: prev.length + 1, tranche_label: '' }]) }
  function removeItem(id: string) { setItems((prev) => prev.filter((i) => i.id !== id).map((i, idx) => ({ ...i, sort_order: idx + 1 }))) }

  async function handleSubmit() {
    if (items.length === 0) {
      toast.error('Brak pozycji', 'Dodaj co najmniej jedną pozycję do faktury.')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        company_id: companyId,
        client_id: clientId || null,
        project_id: projectId || null,
        contract_id: contractId || null,
        status: 'unpaid',
        invoice_type: invoiceType as Invoice['invoice_type'],
        issue_date: issueDate,
        sale_date: saleDate || null,
        issue_place: issuePlace || null,
        due_date: dueDate || null,
        payment_method: paymentMethod as Invoice['payment_method'],
        bank_account: bankAccount || null,
        tranche_id: selectedTrancheId || null,
        advance_total: invoiceType === 'final' ? (Number(advanceTotal) || null) : null,
        notes,
        items,
      })
      clearDraft()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ── Sekcja nagłówkowa ── */}
      <div className="form-grid">
        <Select label="Rodzaj faktury" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} options={INVOICE_TYPE_OPTIONS} />
        <Select label="Umowa" value={contractId} onChange={(e) => setContractId(e.target.value)} options={contractOptions} placeholder="Bez umowy" />
        {selectedContract?.tranches?.length ? (
          <Select label="Transza / płatność z umowy" value={selectedTrancheId} onChange={(e) => applyTranche(e.target.value)} options={trancheOptions} placeholder="Wybierz transzę" />
        ) : null}
        <Select label="Projekt" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projectOptions} placeholder="Bez projektu" />
        <Select label="Klient (nabywca)" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clientOptions} placeholder="Bez przypisania" />
        <Input label="Miejsce wystawienia" value={issuePlace} onChange={(e) => setIssuePlace(e.target.value)} placeholder="np. Warszawa" />
      </div>

      {/* ── Daty ── */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Daty</div>
        <div className="form-grid">
          <Input label="Data wystawienia" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <Input label="Data sprzedaży / wyk. usługi" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          <Select
            label="Termin płatności"
            value={dueDays}
            onChange={(e) => setDueDays(e.target.value)}
            options={DUE_DAYS_OPTIONS}
          />
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
              Termin płatności — data
            </label>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      {/* ── Płatność ── */}
      <div className="form-grid">
        <Select label="Forma płatności" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} options={PAYMENT_METHOD_OPTIONS} />
        {paymentMethod === 'transfer' ? (
          <Input
            label="Nr rachunku bankowego"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            placeholder="PL00 0000 …"
          />
        ) : <div />}
        {invoiceType === 'final' ? (
          <Input label="Suma wcześniejszych zaliczek (potrącenie)" type="number" value={advanceTotal} onChange={(e) => setAdvanceTotal(e.target.value)} />
        ) : null}
        <div className="form-grid--full">
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>Uwagi</label>
          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Dodatkowe informacje, warunki płatności..."
            style={{ width: '100%', minHeight: 48, resize: 'vertical', fontSize: 13, padding: '8px 10px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* ── Pozycje ── */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pozycje faktury</div>
        {items.map((item, idx) => (
          <div key={item.id} className="card" style={{ display: 'grid', gap: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Pozycja {idx + 1}</div>
            <div className="form-grid">
              <div className="form-grid--full">
                <Input label="Opis pozycji" value={item.description} onChange={(e) => patchItem(item.id, 'description', e.target.value)} />
              </div>
              <Select label="VAT %" value={String(item.vat_rate)} onChange={(e) => patchItem(item.id, 'vat_rate', e.target.value)} options={[{ value: '23', label: '23%' }, { value: '8', label: '8%' }, { value: '5', label: '5%' }, { value: '0', label: '0%' }]} />
              <Input label="Jednostka" value={item.unit} onChange={(e) => patchItem(item.id, 'unit', e.target.value)} />
              <Input label="Ilość" type="number" value={String(item.quantity)} onChange={(e) => patchItem(item.id, 'quantity', e.target.value)} />
              <Input label="Cena netto" type="number" value={String(item.unit_price)} onChange={(e) => patchItem(item.id, 'unit_price', e.target.value)} />
              <Input label="Etykieta transzy" value={item.tranche_label || ''} onChange={(e) => patchItem(item.id, 'tranche_label', e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Netto: {formatCurrency(item.unit_price * item.quantity)} · Brutto: {formatCurrency(item.unit_price * item.quantity * (1 + item.vat_rate / 100))}
              </span>
              <Button variant="danger" size="sm" onClick={() => removeItem(item.id)}>Usuń</Button>
            </div>
          </div>
        ))}
        <div><Button variant="secondary" onClick={addItem}>+ Dodaj pozycję</Button></div>
      </div>

      {/* ── Podsumowanie ── */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 10 }}>Podsumowanie</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 24px', fontSize: 13 }}>
          <span style={{ color: '#6b7280' }}>Netto</span>
          <span style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(totals.totalNet)}</span>
          <span style={{ color: '#6b7280' }}>VAT</span>
          <span style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(vatDiff)}</span>
          <span style={{ color: '#111827', fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>Brutto</span>
          <span style={{ fontWeight: 700, textAlign: 'right', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>{formatCurrency(totals.totalGross)}</span>
        </div>
        {invoiceType === 'final' && Number(advanceTotal) > 0 ? (
          <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
            Pozostało do zapłaty: <strong>{formatCurrency(remainsToPay)}</strong>
          </div>
        ) : null}
      </div>

      <div className="actions-row">
        <Button loading={submitting} onClick={handleSubmit}>
          {initialInvoice ? 'Zapisz zmiany' : 'Zapisz fakturę'}
        </Button>
      </div>
    </div>
  )
}


