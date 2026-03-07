import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Select } from '@/shared/ui/Select/Select'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { ItemsEditor } from '@/features/estimates/components/EstimateModal/ItemsEditor'
import type { Estimate, EstimateItem } from '@/entities/estimate/model'
import { calcTotals } from '@/features/estimates/lib/estimate.calculations'

interface Props {
  onSubmit: (input: { name: string; client_id: string | null; project_id?: string | null; notes?: string; company_id: string; status?: Estimate['status']; valid_until?: string | null; items?: EstimateItem[] }) => void | Promise<void>
  companyId: string
  initialEstimate?: Estimate | null
}

export function EstimateForm({ onSubmit, companyId, initialEstimate }: Props) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<Estimate['status']>('draft')
  const [validUntil, setValidUntil] = useState('')
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<EstimateItem[]>([])
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients])
  const projectOptions = useMemo(() => projects.map((p) => ({ value: p.id, label: `${p.number} · ${p.name}` })), [projects])
  const totals = useMemo(() => calcTotals(items), [items])

  useEffect(() => {
    setName(initialEstimate?.name || '')
    setNotes(initialEstimate?.notes || '')
    setClientId(initialEstimate?.client_id || '')
    setStatus(initialEstimate?.status || 'draft')
    setValidUntil(initialEstimate?.valid_until?.slice(0, 10) || '')
    setProjectId(initialEstimate?.project_id || '')
    setItems(initialEstimate?.items?.length ? initialEstimate.items : [])
  }, [initialEstimate, companyId])

  // Auto-generate estimate name if not set and client selected
  useEffect(() => {
    if (!name && clientId) {
      const client = clients.find(c => c.id === clientId)
      if (client) {
        const today = new Date()
        const dateStr = today.toLocaleDateString('pl-PL')
        setName(`Wycena dla ${client.name} (${dateStr})`)
      }
    }
  }, [name, clientId, clients])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="grid-2">
        <Input label="Nazwa wyceny" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Klient" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clientOptions} placeholder="Bez przypisania" />
        <Select label="Projekt" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projectOptions} placeholder="Bez projektu" />
        <Select label="Status" value={status} onChange={(e) => setStatus((e.target.value || 'draft') as Estimate['status'])} options={[{ value: 'draft', label: 'Szkic' }, { value: 'sent', label: 'Wysłany' }, { value: 'accepted', label: 'Akceptacja' }, { value: 'rejected', label: 'Odrzucony' }]} />
        <Input label="Ważny do" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        <Input label="Notatki" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <ItemsEditor items={items} onChange={setItems} />
      <div className="card"><strong>Podsumowanie</strong><div>Netto: {totals.net.toFixed(2)} zł · Brutto: {totals.gross.toFixed(2)} zł</div></div>
      <div className="actions-row">
        <Button onClick={() => onSubmit({ name, notes, client_id: clientId || null, project_id: projectId || null, company_id: companyId, status, valid_until: validUntil || null, items })}>{initialEstimate ? 'Zapisz zmiany' : 'Zapisz wycenę'}</Button>
      </div>
    </div>
  )
}
