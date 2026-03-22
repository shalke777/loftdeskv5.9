import { useEffect, useState } from 'react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useCreateClient, useUpdateClient } from '@/features/clients/hooks/useClients'
import { useToast } from '@/shared/hooks/useToast'
import type { Client } from '@/entities/client/model'

export function ClientModal({ open, onClose, initialClient }: { open: boolean; onClose: () => void; initialClient?: Client | null }) {
  const companyId = useCompanyId()
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [nip, setNip] = useState('')
  const [contactPerson, setContactPerson] = useState('')

  useEffect(() => {
    setName(initialClient?.name || '')
    setEmail(initialClient?.email || '')
    setPhone(initialClient?.phone || '')
    setCity(initialClient?.city || '')
    setAddress(initialClient?.address || '')
    setPostalCode(initialClient?.postal_code || '')
    setNip(initialClient?.nip || '')
    setContactPerson(initialClient?.contact_person || '')
  }, [initialClient, open])

  async function save() {
    if (!name.trim()) {
      toast.error('Wymagane pole', 'Nazwa kontrahenta jest wymagana.')
      return
    }
    const payload = { company_id: companyId, name, email, phone, city, address, postal_code: postalCode, nip, contact_person: contactPerson }
    try {
      if (initialClient?.id) await updateClient.mutateAsync({ id: initialClient.id, input: payload })
      else await createClient.mutateAsync(payload)
      onClose()
    } catch {
      toast.error('Nie udało się zapisać kontrahenta')
    }
  }

  const isPending = createClient.isPending || updateClient.isPending

  return (
    <Modal title={initialClient ? 'Edytuj kontrahenta' : 'Nowy kontrahent'} open={open} onClose={onClose}>
      <div className="grid-2">
        <Input label="Nazwa" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Osoba kontaktowa" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="NIP" value={nip} onChange={(e) => setNip(e.target.value)} />
        <Input label="Kod pocztowy" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        <Input label="Miasto" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input label="Adres" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="actions-row">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>Anuluj</Button>
        <Button onClick={save} loading={isPending}>{initialClient ? 'Zapisz zmiany' : 'Zapisz kontrahenta'}</Button>
      </div>
    </Modal>
  )
}
