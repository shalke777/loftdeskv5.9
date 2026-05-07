import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Select } from '@/shared/ui/Select/Select'
import { useToast } from '@/shared/hooks/useToast'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { ItemsEditor } from '@/features/estimates/components/EstimateModal/ItemsEditor'
import type { Estimate, EstimateItem } from '@/entities/estimate/model'
import { calcTotals } from '@/features/estimates/lib/estimate.calculations'
import { ClientModal } from '@/features/clients/components/ClientModal'

const DRAFT_KEY = 'estimate_form_draft'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw) as Record<string, unknown>
  } catch { /* ignore */ }
  return null
}
function saveDraft(data: object) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}
export function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

interface Props {
  onSubmit: (input: { name: string; client_id: string | null; project_id?: string | null; notes?: string; company_id: string; status?: Estimate['status']; estimate_type?: 'preliminary' | 'final'; valid_until?: string | null; items?: EstimateItem[] }) => void | Promise<void>
  companyId: string
  initialEstimate?: Estimate | null
  initialProjectId?: string | null
  initialClientId?: string | null
}

export function EstimateForm({ onSubmit, companyId, initialEstimate, initialProjectId, initialClientId }: Props) {
  const isNew = !initialEstimate
  const saveGuard = useRef(false)
  const isSubmittingRef = useRef(false)

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [clientId, setClientId] = useState('')
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [status, setStatus] = useState<Estimate['status']>('draft')
  const [estimateType, setEstimateType] = useState<'preliminary' | 'final'>('preliminary')
  const [validUntil, setValidUntil] = useState('')
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<EstimateItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [isAiDraft, setIsAiDraft] = useState(false)

  const { data: clients = [] } = useClients()
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
  const projectOptions = useMemo(() => projects.map((p) => ({ value: p.id, label: `${p.number} · ${p.name}` })), [projects])
  const totals = useMemo(() => calcTotals(items), [items])

  const vatBreakdown = useMemo(() => {
    const groups: Record<number, number> = {}
    for (const item of items) {
      const vatAmt = item.unit_price * item.quantity * (item.vat_rate / 100)
      groups[item.vat_rate] = (groups[item.vat_rate] ?? 0) + vatAmt
    }
    return Object.entries(groups)
      .map(([rate, amount]) => ({ rate: Number(rate), amount }))
      .sort((a, b) => b.rate - a.rate)
  }, [items])

  // Init: editing from initialEstimate; new form from draft or defaults
  useEffect(() => {
    saveGuard.current = false
    if (initialEstimate) {
      setName(initialEstimate.name || '')
      setNotes(initialEstimate.notes || '')
      setClientId(initialEstimate.client_id || '')
      setStatus(initialEstimate.status || 'draft')
      setEstimateType(initialEstimate.estimate_type ?? 'preliminary')
      setValidUntil(initialEstimate.valid_until?.slice(0, 10) || '')
      setProjectId(initialEstimate.project_id || '')
      setItems(initialEstimate.items?.length ? initialEstimate.items : [])
    } else {
      const draft = loadDraft()
      if (draft) {
        setName((draft.name as string) ?? '')
        setNotes((draft.notes as string) ?? '')
        setClientId((draft.clientId as string) ?? '')
        setStatus(((draft.status as string) ?? 'draft') as Estimate['status'])
        setValidUntil((draft.validUntil as string) ?? todayStr())
        setProjectId((draft.projectId as string) ?? '')
        setItems((draft.items as EstimateItem[]) ?? [])
        setIsAiDraft(draft._source === 'ai_analysis' || draft._source === 'project_analysis' || draft._source === 'voice_whisper' || draft._source === 'voice_note')
      } else {
        setName(''); setNotes(''); setClientId(initialClientId || ''); setStatus('draft'); setEstimateType('preliminary')
        setValidUntil(todayStr()); setProjectId(initialProjectId || ''); setItems([])
        setIsAiDraft(false)
      }
    }
    const t = setTimeout(() => { saveGuard.current = true }, 0)
    return () => clearTimeout(t)
  }, [initialEstimate, companyId])

  // Auto-generate name when client is selected and name is empty
  useEffect(() => {
    if (!name && clientId) {
      const client = clients.find((c) => c.id === clientId)
      if (client) setName(`Wycena dla ${client.name} (${new Date().toLocaleDateString('pl-PL')})`)
    }
  }, [name, clientId, clients])

  // Persist draft on every change (new form only)
  useEffect(() => {
    if (!isNew || !saveGuard.current) return
    saveDraft({ name, notes, clientId, status, validUntil, projectId, items })
  }, [name, notes, clientId, status, validUntil, projectId, items, isNew])

  const toast = useToast()

  async function handleSubmit() {
    // P1-2: ref-based guard prevents double-submit in the React 18 batching gap
    // between first click and button re-rendering as disabled/loading.
    if (isSubmittingRef.current) return
    if (!name.trim()) {
      toast.error('Wymagane pole', 'Nazwa wyceny jest wymagana.')
      return
    }
    isSubmittingRef.current = true
    setSubmitting(true)
    try {
      await onSubmit({ name, notes, client_id: clientId || null, project_id: projectId || null, company_id: companyId, status, estimate_type: estimateType, valid_until: validUntil || null, items })
      clearDraft()
    } catch {
      // Error toast is shown by mutation onError — do NOT clear draft so user can retry
    } finally {
      setSubmitting(false)
      isSubmittingRef.current = false
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ── AI draft provenance banner ── */}
      {isAiDraft && (
        <div style={{
          background: 'var(--color-warning-soft)', border: '1px solid var(--color-warning)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, lineHeight: 1.6,
          color: 'var(--color-text-primary)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🤖</span> Pozycje z analizy AI — draft do weryfikacji
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-secondary)', fontSize: 11 }}>
            <li>Ceny jednostkowe wymagają uzupełnienia (domyślnie 0,00 zł)</li>
            <li>Stawka VAT ustawiona na 8% — zweryfikuj dla każdej pozycji</li>
            <li>Ilości i jednostki oszacowane przez AI — sprawdź przed wysyłką</li>
          </ul>
        </div>
      )}

      {/* ── 1. Nagłówek: nazwa + klient + projekt ── */}
      <div className="form-grid">
        <div className="form-grid--full">
          <Input label="Nazwa wyceny *" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Remont łazienki – oferta wstępna" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Select label="Klient" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clientOptions} placeholder="Bez przypisania" />
            </div>
            <Button type="button" variant="secondary" onClick={() => setNewClientOpen(true)} style={{ whiteSpace: 'nowrap', marginBottom: 1 }}>+ Nowy</Button>
          </div>
        </div>
        <Select label="Projekt" value={projectId} onChange={(e) => {
          const pid = e.target.value
          setProjectId(pid)
          if (pid) {
            const proj = projects.find(p => p.id === pid)
            if (proj?.client_id) setClientId(proj.client_id)
          }
        }} options={projectOptions} placeholder="Bez projektu" />
      </div>

      {/* ── 2. Pozycje ── */}
      <ItemsEditor items={items} onChange={setItems} />

      {/* ── 3. Podsumowanie ── */}
      {items.length > 0 && (
        <div style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 10 }}>Podsumowanie</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 24px', fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Netto</span>
            <span style={{ fontWeight: 500, textAlign: 'right' }}>{totals.net.toFixed(2)} zł</span>
            {vatBreakdown.map(({ rate, amount }) => (
              <Fragment key={rate}>
                <span style={{ color: 'var(--color-text-secondary)' }}>VAT {rate}%</span>
                <span style={{ fontWeight: 500, textAlign: 'right' }}>{amount.toFixed(2)} zł</span>
              </Fragment>
            ))}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 2 }}>Brutto</span>
            <span style={{ fontWeight: 700, textAlign: 'right', borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 2 }}>{totals.gross.toFixed(2)} zł</span>
          </div>
        </div>
      )}

      {/* ── 4. Szczegóły: ważność, status, notatki ── */}
      <div className="form-grid">
        <Input label="Ważny do" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus((e.target.value || 'draft') as Estimate['status'])}
          options={[{ value: 'draft', label: 'Szkic' }, { value: 'sent', label: 'Wysłany' }, { value: 'accepted', label: 'Akceptacja' }, { value: 'rejected', label: 'Odrzucony' }]}
        />
        <Select
          label="Rodzaj wyceny"
          value={estimateType}
          onChange={(e) => setEstimateType((e.target.value || 'preliminary') as 'preliminary' | 'final')}
          options={[{ value: 'preliminary', label: 'Wstępna (informacyjna)' }, { value: 'final', label: 'Właściwa' }]}
        />
        <div className="form-grid--full">
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 500 }}>Notatki</label>
          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Dodatkowe informacje, warunki, uwagi do wyceny..."
            style={{ width: '100%', minHeight: 56, resize: 'vertical', fontSize: 13, padding: '8px 10px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div className="actions-row">
        <Button loading={submitting} onClick={handleSubmit}>
          {initialEstimate ? 'Zapisz zmiany' : 'Zapisz wycenę'}
        </Button>
      </div>
      <ClientModal open={newClientOpen} onClose={() => setNewClientOpen(false)} />
    </div>
  )
}
