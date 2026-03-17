import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Select } from '@/shared/ui/Select/Select'
import { ClientSelectWithCreate } from '@/shared/ui/ClientSelectWithCreate/ClientSelectWithCreate'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { ItemsEditor } from '@/features/estimates/components/EstimateModal/ItemsEditor'
import type { Estimate, EstimateItem } from '@/entities/estimate/model'
import { calcTotals } from '@/features/estimates/lib/estimate.calculations'

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
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

interface Props {
  onSubmit: (input: { name: string; client_id: string | null; project_id?: string | null; notes?: string; company_id: string; status?: Estimate['status']; valid_until?: string | null; items?: EstimateItem[] }) => void | Promise<void>
  companyId: string
  initialEstimate?: Estimate | null
}

export function EstimateForm({ onSubmit, companyId, initialEstimate }: Props) {
  const isNew = !initialEstimate
  const saveGuard = useRef(false)

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<Estimate['status']>('draft')
  const [validUntil, setValidUntil] = useState('')
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<EstimateItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
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
      } else {
        setName(''); setNotes(''); setClientId(''); setStatus('draft')
        setValidUntil(todayStr()); setProjectId(''); setItems([])
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

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await onSubmit({ name, notes, client_id: clientId || null, project_id: projectId || null, company_id: companyId, status, valid_until: validUntil || null, items })
      clearDraft()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ── Pola nagłówkowe ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="Nazwa wyceny *" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Remont łazienki – oferta wstępna" />
        </div>
        <ClientSelectWithCreate label="Kontrahent" value={clientId} onChange={setClientId} />
        <Select label="Projekt" value={projectId} onChange={(e) => {
          const pid = e.target.value
          setProjectId(pid)
          if (pid) {
            const proj = projects.find(p => p.id === pid)
            if (proj?.client_id) setClientId(proj.client_id)
          }
        }} options={projectOptions} placeholder="Bez projektu" />
        <Input label="Ważny do" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus((e.target.value || 'draft') as Estimate['status'])}
          options={[{ value: 'draft', label: 'Szkic' }, { value: 'sent', label: 'Wysłany' }, { value: 'accepted', label: 'Akceptacja' }, { value: 'rejected', label: 'Odrzucony' }]}
        />
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>Notatki</label>
          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Dodatkowe informacje, warunki, uwagi do wyceny..."
            style={{ width: '100%', minHeight: 56, resize: 'vertical', fontSize: 13, padding: '8px 10px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* ── Pozycje ── */}
      <ItemsEditor items={items} onChange={setItems} />

      {/* ── Podsumowanie ── */}
      {items.length > 0 && (
        <div style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border-light)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 10 }}>Podsumowanie</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 24px', fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Netto</span>
            <span style={{ fontWeight: 500, textAlign: 'right' }}>{totals.net.toFixed(2)} zł</span>
            {vatBreakdown.map(({ rate, amount }) => (
              <Fragment key={rate}>
                <span style={{ color: '#6b7280' }}>VAT {rate}%</span>
                <span style={{ fontWeight: 500, textAlign: 'right' }}>{amount.toFixed(2)} zł</span>
              </Fragment>
            ))}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 2 }}>Brutto</span>
            <span style={{ fontWeight: 700, textAlign: 'right', borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 2 }}>{totals.gross.toFixed(2)} zł</span>
          </div>
        </div>
      )}

      <div className="actions-row">
        <Button loading={submitting} onClick={handleSubmit}>
          {initialEstimate ? 'Zapisz zmiany' : 'Zapisz wycenę'}
        </Button>
      </div>
    </div>
  )
}
