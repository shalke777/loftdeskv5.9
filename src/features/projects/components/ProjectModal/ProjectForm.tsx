import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { Select } from '@/shared/ui/Select/Select'
import type { CreateProjectInput, Project } from '@/entities/project/model'
import { useClients, useCreateClient } from '@/features/clients/hooks/useClients'
import { useCompanyId } from '@/features/auth/hooks/useAuth'

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

  // Inline new client form
  const [showNewClient, setShowNewClient] = useState(false)
  const [ncName, setNcName]   = useState('')
  const [ncEmail, setNcEmail] = useState('')
  const [ncPhone, setNcPhone] = useState('')
  const createClient = useCreateClient()
  const _companyId = useCompanyId()

  useEffect(() => {
    setName(initialProject?.name || '')
    setAddress(initialProject?.address || '')
    setNotes(initialProject?.notes || '')
    setClientId(initialProject?.client_id || '')
    setStatus(initialProject?.status || 'offer')
    setStartDate(initialProject?.start_date || '')
    setEndDate(initialProject?.end_date || '')
  }, [initialProject])

  async function handleAddClient() {
    if (!ncName.trim()) return
    try {
      const newClient = await createClient.mutateAsync({
        company_id: _companyId,
        name: ncName.trim(),
        email: ncEmail.trim(),
        phone: ncPhone.trim(),
        city: '', address: '', postal_code: '', nip: '', contact_person: '',
      })
      setClientId(newClient.id)
      setShowNewClient(false)
      setNcName(''); setNcEmail(''); setNcPhone('')
    } catch {
      // error toast already raised by useCreateClient
    }
  }

  return (
    <div className="grid-2">
      <Input label="Nazwa projektu" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Select label="Klient" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clientOptions} placeholder="Bez przypisania" />
        <button
          type="button"
          onClick={() => setShowNewClient(v => !v)}
          style={{ fontSize: 12, color: 'var(--color-brand, #77BA8A)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 0', marginTop: 2, width: 'fit-content' }}
        >
          {showNewClient ? '↑ Zamknij' : '+ Dodaj nowego klienta'}
        </button>
        {showNewClient && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8, padding: 12, background: 'var(--color-surface-raised, var(--color-surface))', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            <Input label="Nazwa klienta *" value={ncName} onChange={(e) => setNcName(e.target.value)} />
            <Input label="E-mail" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} />
            <Input label="Telefon" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="sm"
                loading={createClient.isPending}
                onClick={handleAddClient}
                disabled={!ncName.trim()}
              >
                Dodaj i przypisz
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setShowNewClient(false); setNcName(''); setNcEmail(''); setNcPhone('') }}
              >
                Anuluj
              </Button>
            </div>
          </div>
        )}
      </div>
      <Select label="Status" value={status} onChange={(e) => setStatus((e.target.value || 'offer') as Project['status'])} options={[{ value: 'offer', label: 'W ofercie' }, { value: 'active', label: 'Aktywny' }, { value: 'done', label: 'Zakończony' }, { value: 'cancelled', label: 'Anulowany' }]} />
      <Input label="Adres" value={address} onChange={(e) => setAddress(e.target.value)} />
      <Input label="Start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      <Input label="Koniec" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      <Input label="Notatki" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="actions-row" style={{ gridColumn: '1 / -1' }}><Button onClick={() => onSubmit({ company_id: companyId, client_id: clientId || null, name, status, start_date: startDate || null, end_date: endDate || null, address, notes })}>{initialProject ? 'Zapisz zmiany' : 'Zapisz projekt'}</Button></div>
    </div>
  )
}

