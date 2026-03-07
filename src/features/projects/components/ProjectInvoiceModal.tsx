import { useMemo, useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Modal } from '@/shared/ui/Modal/Modal'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { formatCurrency } from '@/shared/lib/formatters'

export type InvoiceTranche = { id: string; label: string; amount: number; due_date: string }

export type InvoiceFromProjectConfig = {
  projectId: string
  vatRate: number
  tranches: InvoiceTranche[]
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (config: InvoiceFromProjectConfig) => void
  projectId: string | null
  isLoading?: boolean
}

function emptyTranche(): InvoiceTranche {
  return { id: crypto.randomUUID(), label: '', amount: 0, due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) }
}

export function ProjectInvoiceModal({ open, onClose, onSubmit, projectId, isLoading }: Props) {
  const { data: projects = [] } = useProjects()
  const project = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId])
  const [vatRate, setVatRate] = useState(23)
  const [tranches, setTranches] = useState<InvoiceTranche[]>([emptyTranche()])
  const [mode, setMode] = useState<'simple' | 'tranches'>('simple')
  const [simpleDesc, setSimpleDesc] = useState('')
  const [simpleAmount, setSimpleAmount] = useState('')
  const [simpleDueDate, setSimpleDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))

  // Reset state when modal opens with new project
  useMemo(() => {
    if (projectId && project) {
      setSimpleDesc(`Realizacja projektu: ${project.name}`)
      setSimpleAmount('')
      setSimpleDueDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
      setTranches([emptyTranche()])
      setVatRate(23)
      setMode('simple')
    }
  }, [projectId, project?.id])

  const totalTranches = useMemo(() => tranches.reduce((sum, t) => sum + (Number(t.amount) || 0), 0), [tranches])
  const simpleGross = useMemo(() => {
    const net = Number(simpleAmount) || 0
    return Math.round(net * (1 + vatRate / 100) * 100) / 100
  }, [simpleAmount, vatRate])

  function patchTranche(id: string, key: keyof InvoiceTranche, value: string) {
    setTranches((prev) => prev.map((t) => t.id === id ? { ...t, [key]: key === 'amount' ? Number(value) || 0 : value } : t))
  }
  function addTranche() { setTranches((prev) => [...prev, emptyTranche()]) }
  function removeTranche(id: string) { setTranches((prev) => prev.filter((t) => t.id !== id)) }

  function handleSubmit() {
    if (!projectId) return
    if (mode === 'simple') {
      const amount = Number(simpleAmount) || 0
      onSubmit({
        projectId,
        vatRate,
        tranches: [{ id: crypto.randomUUID(), label: simpleDesc || `Realizacja projektu`, amount, due_date: simpleDueDate }],
      })
    } else {
      const valid = tranches.filter((t) => t.label.trim() && t.amount > 0)
      if (!valid.length) return
      onSubmit({ projectId, vatRate, tranches: valid })
    }
  }

  const canSubmit = mode === 'simple'
    ? (Number(simpleAmount) || 0) > 0
    : tranches.some((t) => t.label.trim() && t.amount > 0)

  return (
    <Modal open={open} onClose={onClose} title="Generuj fakturę z projektu">
      {project ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Project info */}
          <div className="card" style={{ background: '#f7fafc' }}>
            <div style={{ fontWeight: 600 }}>{project.number}</div>
            <div style={{ fontSize: 14, color: '#718096' }}>{project.name}{project.client_id ? '' : ' · brak klienta'}</div>
          </div>

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant={mode === 'simple' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('simple')}>Jedna pozycja</Button>
            <Button variant={mode === 'tranches' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('tranches')}>Transze</Button>
          </div>

          {/* VAT rate */}
          <Input label="Stawka VAT (%)" type="number" value={String(vatRate)} onChange={(e) => setVatRate(Number(e.target.value) || 0)} />

          {mode === 'simple' ? (
            <>
              <Input label="Opis pozycji" value={simpleDesc} onChange={(e) => setSimpleDesc(e.target.value)} />
              <div className="grid-2">
                <Input label="Kwota netto (zł)" type="number" value={simpleAmount} onChange={(e) => setSimpleAmount(e.target.value)} placeholder="0.00" />
                <Input label="Termin płatności" type="date" value={simpleDueDate} onChange={(e) => setSimpleDueDate(e.target.value)} />
              </div>
              {(Number(simpleAmount) || 0) > 0 ? (
                <div style={{ fontSize: 13, color: '#718096' }}>
                  Brutto: <strong>{formatCurrency(simpleGross)}</strong>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {tranches.map((tranche, idx) => (
                <div key={tranche.id} className="card" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>Transza {idx + 1}</strong>
                    {tranches.length > 1 ? <Button variant="danger" size="sm" onClick={() => removeTranche(tranche.id)}>Usuń</Button> : null}
                  </div>
                  <Input label="Nazwa / etap" value={tranche.label} onChange={(e) => patchTranche(tranche.id, 'label', e.target.value)} placeholder="np. Zaliczka, Etap 1, Płatność końcowa" />
                  <div className="grid-2">
                    <Input label="Kwota netto (zł)" type="number" value={String(tranche.amount || '')} onChange={(e) => patchTranche(tranche.id, 'amount', e.target.value)} placeholder="0.00" />
                    <Input label="Termin płatności" type="date" value={tranche.due_date} onChange={(e) => patchTranche(tranche.id, 'due_date', e.target.value)} />
                  </div>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={addTranche}>+ Dodaj transzę</Button>

              {totalTranches > 0 ? (
                <div className="card" style={{ background: '#f7fafc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div>Suma netto transz: <strong>{formatCurrency(totalTranches)}</strong></div>
                    <div>Brutto (VAT {vatRate}%): <strong>{formatCurrency(Math.round(totalTranches * (1 + vatRate / 100) * 100) / 100)}</strong></div>
                  </div>
                </div>
              ) : null}
            </>
          )}

          <div className="actions-row">
            <Button onClick={handleSubmit} disabled={!canSubmit || isLoading}>
              {isLoading ? 'Generowanie…' : 'Generuj fakturę'}
            </Button>
            <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 24, color: '#718096' }}>Ładowanie projektu…</div>
      )}
    </Modal>
  )
}
