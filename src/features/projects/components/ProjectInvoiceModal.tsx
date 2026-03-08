import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Select } from '@/shared/ui/Select/Select'
import { Modal } from '@/shared/ui/Modal/Modal'
import { generateId } from '@/shared/lib/generateId'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useContracts } from '@/features/contracts/hooks/useContracts'
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

const VAT_OPTIONS = [
  { value: '23', label: '23%' },
  { value: '8', label: '8%' },
  { value: '5', label: '5%' },
  { value: '0', label: '0%' },
  { value: '-1', label: 'zw. (zwolniony)' },
]

function emptyTranche(): InvoiceTranche {
  return { id: generateId(), label: '', amount: 0, due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) }
}

export function ProjectInvoiceModal({ open, onClose, onSubmit, projectId, isLoading }: Props) {
  const { data: projects = [] } = useProjects()
  const { data: contracts = [] } = useContracts()
  const project = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId])

  // Contracts linked to this project
  const projectContracts = useMemo(() => contracts.filter((c) => c.project_id === projectId), [contracts, projectId])
  const contractOptions = useMemo(() => projectContracts.map((c) => ({ value: c.id, label: `${c.number} · ${formatCurrency(c.value)}` })), [projectContracts])

  const [vatRate, setVatRate] = useState('23')
  const [selectedContractId, setSelectedContractId] = useState('')
  const [tranches, setTranches] = useState<InvoiceTranche[]>([emptyTranche()])

  const selectedContract = useMemo(() => projectContracts.find((c) => c.id === selectedContractId) ?? null, [projectContracts, selectedContractId])

  // Reset when modal opens with new project
  useEffect(() => {
    if (projectId && project) {
      setVatRate('23')
      setTranches([emptyTranche()])
      // Auto-select first contract if only one
      if (projectContracts.length === 1) {
        setSelectedContractId(projectContracts[0].id)
      } else {
        setSelectedContractId('')
      }
    }
  }, [projectId, project?.id])

  // Load tranches from selected contract
  useEffect(() => {
    if (selectedContract) {
      const contractVat = selectedContract.vat_rate ?? 23
      setVatRate(String(contractVat))
      const contractTranches = selectedContract.tranches ?? []
      if (contractTranches.length > 0) {
        setTranches(contractTranches.map((t) => ({
          id: t.id,
          label: t.label,
          amount: t.amount,
          due_date: t.due_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        })))
      } else {
        // Contract without tranches — one item with full value
        setTranches([{
          id: generateId(),
          label: `Realizacja umowy ${selectedContract.number}`,
          amount: selectedContract.value_net ?? selectedContract.value,
          due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        }])
      }
    }
  }, [selectedContract?.id])

  const totalTranches = useMemo(() => tranches.reduce((sum, t) => sum + (Number(t.amount) || 0), 0), [tranches])
  const effectiveVat = Number(vatRate) === -1 ? 0 : Number(vatRate)

  function patchTranche(id: string, key: keyof InvoiceTranche, value: string) {
    setTranches((prev) => prev.map((t) => t.id === id ? { ...t, [key]: key === 'amount' ? Number(value) || 0 : value } : t))
  }
  function addTranche() { setTranches((prev) => [...prev, emptyTranche()]) }
  function removeTranche(id: string) { setTranches((prev) => prev.filter((t) => t.id !== id)) }

  function handleSubmit() {
    if (!projectId) return
    const valid = tranches.filter((t) => t.label.trim() && t.amount > 0)
    if (!valid.length) return
    onSubmit({ projectId, vatRate: effectiveVat, tranches: valid })
  }

  const canSubmit = tranches.some((t) => t.label.trim() && t.amount > 0)

  return (
    <Modal open={open} onClose={onClose} title="Generuj fakturę z projektu">
      {project ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Project info */}
          <div className="card" style={{ background: '#f7fafc' }}>
            <div style={{ fontWeight: 600 }}>{project.number}</div>
            <div style={{ fontSize: 14, color: '#718096' }}>{project.name}{project.client_id ? '' : ' · brak klienta'}</div>
          </div>

          {/* Contract selector */}
          {projectContracts.length > 0 ? (
            <Select label="Umowa" value={selectedContractId} onChange={(e) => setSelectedContractId(e.target.value)} options={contractOptions} placeholder="Wybierz umowę" />
          ) : (
            <div style={{ fontSize: 13, color: '#b7791f', background: '#fffff0', padding: '8px 12px', borderRadius: 6 }}>
              Brak umów powiązanych z tym projektem. Dodaj transze ręcznie lub najpierw utwórz umowę.
            </div>
          )}

          {/* VAT rate dropdown */}
          <Select label="Stawka VAT" value={vatRate} onChange={(e) => setVatRate(e.target.value)} options={VAT_OPTIONS} placeholder="Wybierz stawkę" />

          {/* Tranches */}
          {tranches.map((tranche, idx) => (
            <div key={tranche.id} className="card" style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>Transza {idx + 1}</strong>
                {tranches.length > 1 ? <Button variant="danger" size="sm" onClick={() => removeTranche(tranche.id)}>Usuń</Button> : null}
              </div>
              <Input label="Nazwa / etap" value={tranche.label} onChange={(e) => patchTranche(tranche.id, 'label', e.target.value)} placeholder="np. Zaliczka, Etap 1, Płatność końcowa" />
              <div className="grid-2">
                <Input label="Kwota (zł)" type="number" value={String(tranche.amount || '')} onChange={(e) => patchTranche(tranche.id, 'amount', e.target.value)} placeholder="0.00" />
                <Input label="Termin płatności" type="date" value={tranche.due_date} onChange={(e) => patchTranche(tranche.id, 'due_date', e.target.value)} />
              </div>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addTranche}>+ Dodaj transzę</Button>

          {/* Summary */}
          {totalTranches > 0 ? (
            <div className="card" style={{ background: '#f7fafc' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>Suma transz: <strong>{formatCurrency(totalTranches)}</strong></div>
                <div>Brutto (VAT {effectiveVat}%): <strong>{formatCurrency(Math.round(totalTranches * (1 + effectiveVat / 100) * 100) / 100)}</strong></div>
              </div>
            </div>
          ) : null}

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
