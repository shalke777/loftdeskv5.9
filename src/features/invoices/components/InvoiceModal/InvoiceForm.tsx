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
import { ClientModal } from '@/features/clients/components/ClientModal'

const INVOICE_TYPE_OPTIONS = [
  { value: 'standard', label: 'Faktura VAT (standardowa)' },
  { value: 'advance', label: 'Faktura zaliczkowa' },
  { value: 'final', label: 'Faktura końcowa' },
  { value: 'partial', label: 'Faktura częściowa' },
  { value: 'correction', label: 'Faktura korygująca' },
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

interface Props { companyId: string; onSubmit: (input: CreateInvoiceInput) => Promise<void>; onSaveDraft?: (input: CreateInvoiceInput) => Promise<void>; initialInvoice?: Invoice | null; initialProjectId?: string | null; initialClientId?: string | null; initialContractId?: string | null }

export function InvoiceForm({ companyId, onSubmit, onSaveDraft, initialInvoice, initialProjectId, initialClientId, initialContractId }: Props) {
  const isNew = !initialInvoice
  const isCorrection = initialInvoice?.invoice_type === 'correction'
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
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [contractId, setContractId] = useState('')
  const [selectedTrancheId, setSelectedTrancheId] = useState('')
  const [advanceTotal, setAdvanceTotal] = useState('0')
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [notes, setNotes] = useState('')
  const [projectId, setProjectId] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')

  const { data: clients = [] } = useClients()
  const { data: contracts = [] } = useContracts()
  const { data: projects = [] } = useProjects()
  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.name })), [clients])

  // Auto-select newly created client
  const prevClientCount = useRef(clients.length)
  useEffect(() => {
    if (clients.length > prevClientCount.current && newClientOpen === false) {
      const newest = clients[clients.length - 1]
      if (newest) setClientId(newest.id)
    }
    prevClientCount.current = clients.length
  }, [clients.length, newClientOpen])
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
      setCorrectionReason(initialInvoice.correction_reason || '')
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
        setClientId(initialClientId ?? ''); setContractId(initialContractId ?? ''); setSelectedTrancheId(''); setAdvanceTotal('0')
        setItems([{ id: generateId(), description: 'Usługa', unit: 'kpl', quantity: 1, unit_price: 0, vat_rate: 23, sort_order: 1, tranche_label: '' }])
        setProjectId(initialProjectId ?? ''); setNotes('')
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

  async function buildInput(asDraft: boolean): Promise<CreateInvoiceInput> {
    return {
      company_id: companyId,
      client_id: clientId || null,
      project_id: projectId || null,
      contract_id: contractId || null,
      status: asDraft ? 'draft' : (initialInvoice?.status && initialInvoice.status !== 'draft' ? initialInvoice.status : 'unpaid'),
      draft: asDraft,
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
      corrected_invoice_id: initialInvoice?.corrected_invoice_id ?? null,
      correction_reason: invoiceType === 'correction' ? correctionReason : null,
    }
  }

  async function handleSubmit() {
    if (items.length === 0) { toast.error('Brak pozycji', 'Dodaj co najmniej jedną pozycję do faktury.'); return }
    if (invoiceType === 'correction' && !correctionReason.trim()) { toast.error('Brak powodu korekty', 'Podaj powód korekty faktury.'); return }
    setSubmitting(true)
    try {
      await onSubmit(await buildInput(false))
      clearDraft()
    } finally { setSubmitting(false) }
  }

  async function handleSaveDraft() {
    if (items.length === 0) { toast.error('Brak pozycji', 'Dodaj co najmniej jedną pozycję do faktury.'); return }
    setSubmitting(true)
    try {
      const cb = onSaveDraft ?? onSubmit
      await cb(await buildInput(true))
      clearDraft()
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ── Korekta: nagłówek i powód ── */}
      {isCorrection && (
        <div style={{ background: 'rgba(168,50,40,0.06)', border: '1px solid rgba(168,50,40,0.2)', borderRadius: 10, padding: '12px 16px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#A83228', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>FAKTURA KORYGUJĄCA</span>
            {initialInvoice?.corrected_invoice_id && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Korekta do faktury
              </span>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Powód korekty <span style={{ color: '#A83228' }}>*</span>
            </label>
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="np. Błędna stawka VAT, zmiana ilości, błąd w nazwie towaru…"
              rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, background: 'var(--color-bg)', color: 'var(--color-text-primary)', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
        </div>
      )}

      {/* ── Sekcja nagłówkowa ── */}
      <div className="form-grid">
        <Select label="Rodzaj faktury" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} options={INVOICE_TYPE_OPTIONS} disabled={isCorrection} />
        <Select label="Umowa" value={contractId} onChange={(e) => setContractId(e.target.value)} options={contractOptions} placeholder="Bez umowy" />
        {selectedContract?.tranches?.length ? (
          <Select label="Transza / płatność z umowy" value={selectedTrancheId} onChange={(e) => applyTranche(e.target.value)} options={trancheOptions} placeholder="Wybierz transzę" />
        ) : null}
        <Select label="Projekt" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projectOptions} placeholder="Bez projektu" />
        <div>
          <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Select label="Klient (nabywca)" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clientOptions} placeholder="Bez przypisania" />
            </div>
            <Button type="button" variant="secondary" onClick={() => setNewClientOpen(true)} style={{ whiteSpace: 'nowrap', marginBottom: 1 }}>+ Nowy</Button>
          </div>
        </div>
        <Input label="Miejsce wystawienia" value={issuePlace} onChange={(e) => setIssuePlace(e.target.value)} placeholder="np. Warszawa" />
      </div>
      <ClientModal open={newClientOpen} onClose={() => setNewClientOpen(false)} />

      {/* ── Daty ── */}
      <div style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Daty</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 170px', gap: '12px 16px' }}>
          <Input label="Data wystawienia" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <Input label="Data sprzedaży / wyk. usługi" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          <Select
            label="Termin płatności"
            value={dueDays}
            onChange={(e) => setDueDays(e.target.value)}
            options={DUE_DAYS_OPTIONS}
          />
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 500 }}>
              Termin płatności — data
            </label>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
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
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 500 }}>Uwagi</label>
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
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pozycje faktury</div>
          <Button variant="secondary" size="sm" onClick={addItem}>+ Dodaj pozycję</Button>
        </div>

        {items.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) 62px 66px 72px 108px 110px 30px', gap: 6, padding: '0 2px 6px', borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
              {['Opis pozycji', 'VAT', 'Jedn.', 'Ilość', 'Cena netto', 'Etykieta', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>

            {/* Table rows */}
            {items.map((item, idx) => (
              <Fragment key={item.id}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) 62px 66px 72px 108px 110px 30px', gap: 6, alignItems: 'center', padding: '4px 0' }}>
                  <input
                    className="input"
                    style={{ width: '100%', fontSize: 13 }}
                    value={item.description}
                    onChange={e => patchItem(item.id, 'description', e.target.value)}
                    onFocus={e => e.target.select()}
                    placeholder="Opis usługi"
                  />
                  <select
                    className="input"
                    style={{ padding: '0 4px', fontSize: 13 }}
                    value={String(item.vat_rate)}
                    onChange={e => patchItem(item.id, 'vat_rate', e.target.value)}
                  >
                    <option value="23">23%</option>
                    <option value="8">8%</option>
                    <option value="5">5%</option>
                    <option value="0">0%</option>
                  </select>
                  <input
                    className="input"
                    style={{ fontSize: 13 }}
                    value={item.unit}
                    onChange={e => patchItem(item.id, 'unit', e.target.value)}
                    onFocus={e => e.target.select()}
                  />
                  <input
                    className="input"
                    type="number"
                    style={{ fontSize: 13 }}
                    value={String(item.quantity)}
                    onChange={e => patchItem(item.id, 'quantity', e.target.value)}
                    onFocus={e => e.target.select()}
                  />
                  <input
                    className="input"
                    type="number"
                    style={{ fontSize: 13 }}
                    value={String(item.unit_price)}
                    onChange={e => patchItem(item.id, 'unit_price', e.target.value)}
                    onFocus={e => e.target.select()}
                  />
                  <input
                    className="input"
                    style={{ fontSize: 13 }}
                    value={item.tranche_label || ''}
                    onChange={e => patchItem(item.id, 'tranche_label', e.target.value)}
                    onFocus={e => e.target.select()}
                    placeholder="opcjonalnie"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    title="Usuń pozycję"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  >×</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right', paddingBottom: 4, borderBottom: idx < items.length - 1 ? '1px solid var(--color-border)' : 'none', marginBottom: idx < items.length - 1 ? 4 : 0 }}>
                  Netto: {formatCurrency(item.unit_price * item.quantity)} · Brutto: {formatCurrency(item.unit_price * item.quantity * (1 + item.vat_rate / 100))}
                </div>
              </Fragment>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Brak pozycji — kliknij &quot;+ Dodaj pozycję&quot;
          </div>
        )}
      </div>

      {/* ── Podsumowanie ── */}
      <div style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 10 }}>Podsumowanie</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 24px', fontSize: 13 }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Netto</span>
          <span style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(totals.totalNet)}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>VAT</span>
          <span style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(vatDiff)}</span>
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>Brutto</span>
          <span style={{ fontWeight: 700, textAlign: 'right', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>{formatCurrency(totals.totalGross)}</span>
        </div>
        {invoiceType === 'final' && Number(advanceTotal) > 0 ? (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-primary)' }}>
            Pozostało do zapłaty: <strong>{formatCurrency(remainsToPay)}</strong>
          </div>
        ) : null}
      </div>

      <div className="actions-row">
        {initialInvoice ? (
          <Button loading={submitting} onClick={handleSubmit}>Zapisz zmiany</Button>
        ) : (
          <>
            {onSaveDraft !== undefined && (
              <Button variant="secondary" loading={submitting} onClick={handleSaveDraft}>Zapisz szkic</Button>
            )}
            <Button loading={submitting} onClick={handleSubmit}>Wystaw fakturę</Button>
          </>
        )}
      </div>
    </div>
  )
}


