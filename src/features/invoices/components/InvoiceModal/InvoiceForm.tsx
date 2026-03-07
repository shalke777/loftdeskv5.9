import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { Select } from '@/shared/ui/Select/Select'
import type { CreateInvoiceInput, Invoice, InvoiceItem } from '@/entities/invoice/model'
import { useClients } from '@/features/clients/hooks/useClients'
import { useContracts } from '@/features/contracts/hooks/useContracts'
import { calcInvoiceTotals } from '@/features/invoices/lib/invoice.calculations'
import { formatCurrency } from '@/shared/lib/formatters'

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

interface Props { companyId: string; onSubmit: (input: CreateInvoiceInput) => Promise<void>; initialInvoice?: Invoice | null }

export function InvoiceForm({ companyId, onSubmit, initialInvoice }: Props) {
  const [invoiceType, setInvoiceType] = useState('standard')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [saleDate, setSaleDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [issuePlace, setIssuePlace] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [bankAccount, setBankAccount] = useState('')
  const [clientId, setClientId] = useState('')
  const [contractId, setContractId] = useState('')
  const [selectedTrancheId, setSelectedTrancheId] = useState('')
  const [advanceTotal, setAdvanceTotal] = useState('0')
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [notes, setNotes] = useState('')

  const { data: clients = [] } = useClients()
  const { data: contracts = [] } = useContracts()
  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.name })), [clients])
  const contractOptions = useMemo(() => contracts.map((c) => ({ value: c.id, label: `${c.number} · ${formatCurrency(c.value)}` })), [contracts])
  const selectedContract = useMemo(() => contracts.find((c) => c.id === contractId) ?? null, [contracts, contractId])
  const trancheOptions = useMemo(() => (selectedContract?.tranches ?? []).map((t) => ({ value: t.id, label: `${t.label} · ${formatCurrency(t.amount)}` })), [selectedContract])
  const totals = useMemo(() => calcInvoiceTotals(items), [items])

  useEffect(() => {
    setInvoiceType(initialInvoice?.invoice_type || 'standard')
    setIssueDate(initialInvoice?.issue_date || new Date().toISOString().slice(0, 10))
    setSaleDate(initialInvoice?.sale_date || '')
    setDueDate(initialInvoice?.due_date || '')
    setIssuePlace(initialInvoice?.issue_place || '')
    setPaymentMethod(initialInvoice?.payment_method || 'transfer')
    setBankAccount(initialInvoice?.bank_account || '')
    setClientId(initialInvoice?.client_id || '')
    setContractId(initialInvoice?.contract_id || '')
    setSelectedTrancheId('')
    setAdvanceTotal(String(initialInvoice?.advance_total ?? 0))
    setItems(initialInvoice?.items?.length ? initialInvoice.items : [{ id: crypto.randomUUID(), description: 'Usługa', unit: 'kpl', quantity: 1, unit_price: 0, vat_rate: 23, sort_order: 1, tranche_label: '' }])
    setNotes(initialInvoice?.notes || '')
  }, [initialInvoice])

  // Auto-fill client when contract changes
  useEffect(() => {
    if (selectedContract?.client_id) setClientId(selectedContract.client_id)
    if (selectedContract?.location) setIssuePlace(selectedContract.location)
  }, [selectedContract])

  function applyTranche(trancheId: string) {
    setSelectedTrancheId(trancheId)
    const tranche = selectedContract?.tranches?.find((t) => t.id === trancheId)
    if (!tranche || !selectedContract) return
    const lbl = tranche.label.toLowerCase()
    const autoType = lbl.includes('zaliczka') ? 'advance'
      : lbl.includes('końcow') || lbl.includes('koncow') ? 'final'
      : 'partial'
    setInvoiceType(autoType)
    const vatRate = (selectedContract as any).vat_rate ?? 23
    const trancheNet = Math.round((tranche.amount / (1 + vatRate / 100)) * 100) / 100
    const trancheDesc = autoType === 'advance'
      ? `Zaliczka na wykonanie robót budowlanych zgodnie z umową nr ${selectedContract.number} – ${tranche.label}`
      : autoType === 'final'
      ? `Rozliczenie końcowe – umowa nr ${selectedContract.number} – ${tranche.label}`
      : `Wykonanie robót – umowa nr ${selectedContract.number} – ${tranche.label}`
    setItems([{ id: crypto.randomUUID(), description: trancheDesc, unit: 'kpl', quantity: 1, unit_price: trancheNet, vat_rate: vatRate, sort_order: 1, tranche_label: tranche.label }])
    if (tranche.due_date) setDueDate(tranche.due_date)
  }

  function patchItem(id: string, key: keyof InvoiceItem, value: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [key]: ['quantity', 'unit_price', 'vat_rate', 'sort_order'].includes(String(key)) ? Number(value) : value } : item))
  }
  function addItem() { setItems((prev) => [...prev, { id: crypto.randomUUID(), description: 'Nowa pozycja', unit: 'kpl', quantity: 1, unit_price: 0, vat_rate: 23, sort_order: prev.length + 1, tranche_label: '' }]) }
  function removeItem(id: string) { setItems((prev) => prev.filter((i) => i.id !== id).map((i, idx) => ({ ...i, sort_order: idx + 1 }))) }

  const vatDiff = totals.totalGross - totals.totalNet
  const remainsToPay = Math.max(0, totals.totalGross - Number(advanceTotal))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="grid-2">
        <Select label="Rodzaj faktury" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} options={INVOICE_TYPE_OPTIONS} />
        <Select label="Umowa" value={contractId} onChange={(e) => setContractId(e.target.value)} options={contractOptions} placeholder="Bez umowy" />
        {selectedContract?.tranches?.length ? <Select label="Transza / płatność z umowy" value={selectedTrancheId} onChange={(e) => applyTranche(e.target.value)} options={trancheOptions} placeholder="Wybierz transzę" /> : null}
        <Select label="Klient (nabywca)" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clientOptions} placeholder="Bez przypisania" />
        <Input label="Data wystawienia" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        <Input label="Data sprzedaży / wykonania usługi" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
        <Input label="Termin płatności" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Input label="Miejsce wystawienia" value={issuePlace} onChange={(e) => setIssuePlace(e.target.value)} placeholder="np. Warszawa" />
        <Select label="Forma płatności" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} options={PAYMENT_METHOD_OPTIONS} />
        {paymentMethod === 'transfer' ? <Input label="Nr rachunku bankowego (opcjonalnie)" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="PL00 0000 …" /> : null}
        {invoiceType === 'final' ? <Input label="Suma wcześniejszych zaliczek (potrącenie)" type="number" value={advanceTotal} onChange={(e) => setAdvanceTotal(e.target.value)} /> : null}
        <Input label="Uwagi" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="card" style={{ display: 'grid', gap: 12 }}>
            <div className="grid-2">
              <Input label="Opis pozycji" value={item.description} onChange={(e) => patchItem(item.id, 'description', e.target.value)} />
              <Input label="Jednostka" value={item.unit} onChange={(e) => patchItem(item.id, 'unit', e.target.value)} />
              <Input label="Ilość" type="number" value={String(item.quantity)} onChange={(e) => patchItem(item.id, 'quantity', e.target.value)} />
              <Input label="Cena netto" type="number" value={String(item.unit_price)} onChange={(e) => patchItem(item.id, 'unit_price', e.target.value)} />
              <Input label="VAT %" type="number" value={String(item.vat_rate)} onChange={(e) => patchItem(item.id, 'vat_rate', e.target.value)} />
              <Input label="Etykieta etapu / transzy" value={item.tranche_label || ''} onChange={(e) => patchItem(item.id, 'tranche_label', e.target.value)} />
            </div>
            <div className="actions-row"><Button variant="danger" size="sm" onClick={() => removeItem(item.id)}>Usuń pozycję</Button></div>
          </div>
        ))}
      </div>
      <div className="actions-row"><Button variant="secondary" onClick={addItem}>Dodaj pozycję</Button></div>

      <div className="card">
        <strong>Podsumowanie</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          <div><div style={{ fontSize: 13, color: '#888' }}>Netto</div><div style={{ fontWeight: 700 }}>{formatCurrency(totals.totalNet)}</div></div>
          <div><div style={{ fontSize: 13, color: '#888' }}>VAT</div><div style={{ fontWeight: 700 }}>{formatCurrency(vatDiff)}</div></div>
          <div><div style={{ fontSize: 13, color: '#888' }}>Brutto</div><div style={{ fontWeight: 700 }}>{formatCurrency(totals.totalGross)}</div></div>
        </div>
        {invoiceType === 'final' && Number(advanceTotal) > 0
          ? <div style={{ marginTop: 8, fontSize: 14 }}>Pozostało do zapłaty: <strong>{formatCurrency(remainsToPay)}</strong></div>
          : null}
      </div>

      <div className="actions-row">
        <Button onClick={() => onSubmit({
          company_id: companyId,
          client_id: clientId || null,
          project_id: null,
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
        })}>
          {initialInvoice ? 'Zapisz zmiany' : 'Zapisz fakturę'}
        </Button>
      </div>
    </div>
  )
}
