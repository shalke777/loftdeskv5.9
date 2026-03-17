import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { Select } from '@/shared/ui/Select/Select'
import type { CreateProjectInput, Project } from '@/entities/project/model'
import { useClients } from '@/features/clients/hooks/useClients'

export function ProjectForm({ companyId, onSubmit, initialProject }: { companyId: string; onSubmit: (input: CreateProjectInput) => Promise<void>; initialProject?: Project | null }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState<Project['status']>('offer')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const { data: clients = [] } = useClients()
  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients])

  useEffect(() => {
    setName(initialProject?.name || '')
    setAddress(initialProject?.address || '')
    setNotes(initialProject?.notes || '')
    setClientId(initialProject?.client_id || '')
    setStatus(initialProject?.status || 'offer')
    setStartDate(initialProject?.start_date || '')
    setEndDate(initialProject?.end_date || '')
  }, [initialProject])

  return (
    <div className="grid-2">
      <Input label="Nazwa projektu" value={name} onChange={(e) => setName(e.target.value)} />
      <Select label="Klient" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clientOptions} placeholder="Bez przypisania" />
      <Select label="Status" value={status} onChange={(e) => setStatus((e.target.value || 'offer') as Project['status'])} options={[{ value: 'offer', label: 'W ofercie' }, { value: 'active', label: 'Aktywny' }, { value: 'done', label: 'Zakończony' }, { value: 'cancelled', label: 'Anulowany' }]} />
      <Input label="Adres" value={address} onChange={(e) => setAddress(e.target.value)} />
      <Input label="Start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      <Input label="Koniec" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      <Input label="Notatki" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="actions-row" style={{ gridColumn: '1 / -1' }}><Button onClick={() => onSubmit({ company_id: companyId, client_id: clientId || null, name, status, start_date: startDate || null, end_date: endDate || null, address, notes })}>{initialProject ? 'Zapisz zmiany' : 'Zapisz projekt'}</Button></div>
    </div>
  )
}
