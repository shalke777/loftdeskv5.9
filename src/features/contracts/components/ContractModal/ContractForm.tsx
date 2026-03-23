import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { Select } from '@/shared/ui/Select/Select'
import { generateId } from '@/shared/lib/generateId'
import type { Contract, ContractTranche, CreateContractInput, CustomParagraph } from '@/entities/contract/model'
import { useClients } from '@/features/clients/hooks/useClients'
import { useEstimates } from '@/features/estimates/hooks/useEstimates'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { formatCurrency } from '@/shared/lib/formatters'

const TRANCHE_COUNT_OPTIONS = [
  { value: '2', label: '2 (Zaliczka + końcowa)' },
  { value: '3', label: '3 transze' },
  { value: '4', label: '4 transze' },
  { value: '5', label: '5 transz' },
  { value: '6', label: '6 transz' },
  { value: '7', label: '7 transz' },
  { value: '8', label: '8 transz' },
  { value: '9', label: '9 transz' },
]

function buildDefaultTranches(count: number, totalGross: number): ContractTranche[] {
  const basePercent = Math.floor(100 / count)
  const remainder = 100 - basePercent * count
  const result: ContractTranche[] = []
  for (let i = 0; i < count; i++) {
    const pct = i === count - 1 ? basePercent + remainder : basePercent
    const amount = Math.round(totalGross * pct / 100)
    result.push({
      id: generateId(),
      label: i === 0 ? 'Zaliczka' : i === count - 1 ? 'Płatność końcowa' : `Etap ${i}`,
      amount,
      percent: pct,
      due_date: null,
      status: 'planned',
      condition: i === 0 ? 'Przed rozpoczęciem robót' : i === count - 1 ? 'Po odbiorze końcowym' : `Po zakończeniu etapu ${i}`,
    })
  }
  return result
}

export function ContractForm({ companyId, onSubmit, initialContract }: { companyId: string; onSubmit: (input: CreateContractInput) => Promise<void>; initialContract?: Contract | null }) {
  const [estimateId, setEstimateId] = useState(initialContract?.estimate_id || '')
  const [trancheCount, setTrancheCount] = useState('2')
  const [tranches, setTranches] = useState<ContractTranche[]>([])
  const [customParagraphs, setCustomParagraphs] = useState<CustomParagraph[]>(initialContract?.custom_paragraphs || [])
  const [signDate, setSignDate] = useState(initialContract?.sign_date || new Date().toISOString().slice(0, 10))
  const [startDate, setStartDate] = useState(initialContract?.start_date || '')
  const [endDate, setEndDate] = useState(initialContract?.end_date || '')
  const [location, setLocation] = useState(initialContract?.location || '')
  const [notes, setNotes] = useState(initialContract?.notes || '')
  const [projectId, setProjectId] = useState(initialContract?.project_id || '')

  const { data: estimates = [] } = useEstimates()
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const projectOptions = projects.map((p) => ({ value: p.id, label: `${p.number} · ${p.name}` }))

  const selectedEstimate = estimates.find((e) => e.id === estimateId) ?? null
  const selectedClient = clients.find((c) => c.id === selectedEstimate?.client_id) ?? null

  // Auto-derive (estimate brutto = wartość umowy, no double VAT)
  const vatRate = selectedEstimate?.items[0]?.vat_rate ?? initialContract?.vat_rate ?? 23
  const totalGross = selectedEstimate?.total_gross ?? initialContract?.value ?? 0
  const totalNet = selectedEstimate?.total_net ?? initialContract?.value_net ?? 0
  const vatAmount = totalGross - totalNet

  // Auto-generate template name
  const templateName = selectedEstimate
    ? `Umowa · ${selectedEstimate.number}${selectedClient ? ` · ${selectedClient.name}` : ''}`
    : (initialContract?.template_name || 'Umowa LoftDesk')

  useEffect(() => {
    if (initialContract) {
      setEstimateId(initialContract.estimate_id || '')
      setSignDate(initialContract.sign_date || new Date().toISOString().slice(0, 10))
      setStartDate(initialContract.start_date || '')
      setEndDate(initialContract.end_date || '')
      setLocation(initialContract.location || '')
      setNotes(initialContract.notes || '')
      setProjectId(initialContract.project_id || '')
      setTranches(initialContract.tranches || [])
      setCustomParagraphs(initialContract.custom_paragraphs || [])
    }
  }, [initialContract])

  // When estimate or tranche count changes, rebuild tranches (only for new contracts)
  useEffect(() => {
    if (!initialContract && selectedEstimate && totalGross > 0) {
      setTranches(buildDefaultTranches(parseInt(trancheCount), totalGross))
    }
  }, [estimateId, trancheCount]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateTranche(id: string, field: keyof ContractTranche, raw: string) {
    setTranches((prev) => prev.map((t) => {
      if (t.id !== id) return t
      if (field === 'percent') {
        const pct = Math.min(100, Math.max(0, Number(raw)))
        return { ...t, percent: pct, amount: totalGross > 0 ? Math.round(totalGross * pct / 100) : t.amount }
      }
      if (field === 'amount') {
        const amt = Math.max(0, Number(raw))
        return { ...t, amount: amt, percent: totalGross > 0 ? Math.round(amt / totalGross * 100) : 0 }
      }
      return { ...t, [field]: raw }
    }))
  }

  function addParagraph() {
    setCustomParagraphs((prev) => [...prev, { id: generateId(), title: '', content: '', sort_order: prev.length }])
  }

  function removeParagraph(id: string) {
    setCustomParagraphs((prev) => prev.filter((p) => p.id !== id))
  }

  function updateParagraph(id: string, field: 'title' | 'content', value: string) {
    setCustomParagraphs((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p))
  }

  async function handleSubmit() {
    await onSubmit({
      company_id: companyId,
      estimate_id: estimateId || null,
      client_id: selectedEstimate?.client_id || initialContract?.client_id || null,
      project_id: projectId || null,
      status: initialContract?.status || 'unsigned',
      sign_date: signDate,
      start_date: startDate || null,
      end_date: endDate || null,
      location,
      value: totalGross,
      value_net: totalNet,
      vat_rate: vatRate,
      notes,
      template_name: templateName,
      template_content: '',
      tranches,
      custom_paragraphs: customParagraphs,
    })
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>

      {/* Sekcja: Wycena */}
      <div>
        <div className="field__label" style={{ marginBottom: 10, fontWeight: 600, fontSize: 13 }}>Powiązanie z wyceną (kosztorysem)</div>
        <div className="grid-2">
          <Select label="Wycena" value={estimateId} onChange={(e) => setEstimateId(e.target.value)} options={estimates.map((est) => ({ value: est.id, label: `${est.number} · ${est.name}` }))} placeholder="Wybierz wycenę" />
          <div className="field">
            <span className="field__label">Klient (z wyceny)</span>
            <div className="input" style={{ background: 'var(--color-surface-soft)', color: selectedClient ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'default' }}>
              {selectedClient?.name || (initialContract?.client_id ? '— wczytywanie —' : '— wybierz wycenę —')}
            </div>
          </div>
        </div>
        {totalGross > 0 ? (
          <div className="form-grid" style={{ marginTop: 10, padding: '10px 14px', background: 'var(--color-surface-soft)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
            <div><div className="field__label">Netto</div><strong>{formatCurrency(totalNet)}</strong></div>
            <div><div className="field__label">VAT ({vatRate}%)</div><strong>{formatCurrency(vatAmount)}</strong></div>
            <div><div className="field__label">Brutto (wartość umowy)</div><strong style={{ color: '#EF6B6B' }}>{formatCurrency(totalGross)}</strong></div>
          </div>
        ) : null}
      </div>

      {/* Sekcja: Terminy i dane */}
      <div>
        <div className="field__label" style={{ marginBottom: 10, fontWeight: 600, fontSize: 13 }}>Terminy i dane umowy</div>
        <div className="grid-2">
          <Input label="Data podpisu" type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)} />
          <Input label="Adres inwestycji / miejsce realizacji" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="np. ul. Kwiatowa 3, Warszawa" />
          <Select label="Projekt" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projectOptions} placeholder="Bez projektu" />
          <Input label="Termin rozpoczęcia robót" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="Termin zakończenia robót" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Input label="Notatki / ustalenia dodatkowe" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Sekcja: Transze */}
      <div>
        <div className="field__label" style={{ marginBottom: 10, fontWeight: 600, fontSize: 13 }}>Harmonogram płatności (transze)</div>
        <div style={{ marginBottom: 12, maxWidth: 280 }}>
          <Select
            label="Podziel wynagrodzenie na"
            value={trancheCount}
            onChange={(e) => {
              setTrancheCount(e.target.value)
              if (totalGross > 0) setTranches(buildDefaultTranches(parseInt(e.target.value), totalGross))
            }}
            options={TRANCHE_COUNT_OPTIONS}
          />
        </div>
        {tranches.length === 0 && totalGross === 0 ? (
          <div style={{ padding: 12, border: '1px dashed var(--color-border)', borderRadius: 8, color: 'var(--color-text-tertiary)', textAlign: 'center', fontSize: 13 }}>
            Wybierz wycenę — transze zostaną wygenerowane automatycznie
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: 8 }}>
          {tranches.map((t, index) => (
            <div key={t.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', background: index === 0 ? 'var(--color-surface-soft)' : 'var(--color-surface)' }}>
              <div className="grid-2" style={{ gap: 8 }}>
                <Input label={index === 0 ? 'Nazwa (Zaliczka)' : 'Nazwa transzy'} value={t.label} onChange={(e) => updateTranche(t.id, 'label', e.target.value)} />
                <div className="form-grid" style={{ gap: 8 }}>
                  <Input label="%" type="number" value={String(t.percent ?? 0)} onChange={(e) => updateTranche(t.id, 'percent', e.target.value)} />
                  <Input label="Kwota" type="number" value={String(t.amount)} onChange={(e) => updateTranche(t.id, 'amount', e.target.value)} />
                </div>
                <Input label="Termin płatności" type="date" value={t.due_date || ''} onChange={(e) => updateTranche(t.id, 'due_date', e.target.value)} />
                <Input label="Warunek / opis etapu" value={(t as any).condition || ''} onChange={(e) => updateTranche(t.id, 'condition' as any, e.target.value)} placeholder="np. Po zakończeniu etapu 1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sekcja: Paragrafy dodatkowe */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div className="field__label" style={{ fontWeight: 600, fontSize: 13 }}>Paragrafy dodatkowe</div>
            <div className="field__label" style={{ marginTop: 2 }}>Własne ustalenia: materiały powierzone, kary, dostęp do lokalu, odbiory częściowe, itp.</div>
          </div>
          <Button variant="secondary" size="sm" onClick={addParagraph} icon={<Plus size={14} />}>Dodaj §</Button>
        </div>
        {customParagraphs.length === 0 ? (
          <div style={{ padding: 12, border: '1px dashed var(--color-border)', borderRadius: 8, color: 'var(--color-text-tertiary)', textAlign: 'center', fontSize: 13 }}>Brak paragrafów dodatkowych</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {customParagraphs.map((p, index) => (
              <div key={p.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <Input label={`§${6 + index} — Tytuł`} value={p.title} onChange={(e) => updateParagraph(p.id, 'title', e.target.value)} placeholder="np. Materiały powierzone, Kary umowne…" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeParagraph(p.id)} icon={<Trash2 size={14} />}>{''}</Button>
                </div>
                <label className="field">
                  <span className="field__label">Treść</span>
                  <textarea className="input" rows={4} value={p.content} onChange={(e) => updateParagraph(p.id, 'content', e.target.value)} placeholder="Treść paragrafu…" />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="actions-row">
        <Button onClick={handleSubmit}>{initialContract ? 'Zapisz zmiany' : 'Zapisz umowę'}</Button>
      </div>
    </div>
  )
}


function parseTranches(value: string): ContractTranche[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, amount, due_date] = line.split('|').map((item) => item?.trim())
      return {
        id: generateId(),
        label: label || `Transza ${index + 1}`,
        amount: Number(amount || 0),
        due_date: due_date || null,
        status: 'planned',
      }
    })
}


