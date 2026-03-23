import { useState } from 'react'
import { Users } from 'lucide-react'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Card } from '@/shared/ui/Card/Card'
import { Table } from '@/shared/ui/Table/Table'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Button } from '@/shared/ui/Button/Button'
import { useClients, useDeleteClient } from '@/features/clients/hooks/useClients'
import { ClientModal } from '@/features/clients/components/ClientModal'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { PlanLimitGuard } from '@/features/billing/components/PlanLimitGuard'
import type { Client } from '@/entities/client/model'

function ClientCard({ client, onEdit, onDelete, canDelete }: {
  client: Client
  onEdit: (c: Client) => void
  onDelete?: (id: string) => void
  canDelete: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div className="client-card-mobile">
      <div className="client-card-mobile__top">
        <div className="client-card-mobile__name">{client.name}</div>
        {client.nip && <div className="client-card-mobile__nip">NIP: {client.nip}</div>}
      </div>
      <div className="client-card-mobile__details">
        {client.contact_person && <span>{client.contact_person}</span>}
        {client.phone && <span>{client.phone}</span>}
        {(client.city || client.address) && (
          <span>{`${client.postal_code || ''} ${client.city || ''}`.trim()}{client.address ? `, ${client.address}` : ''}</span>
        )}
      </div>
      <div className="client-card-mobile__actions">
        <Button variant="ghost" size="sm" onClick={() => onEdit(client)}>Edytuj</Button>
        {canDelete && !confirmDelete && (
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Usuń</Button>
        )}
        {canDelete && confirmDelete && (
          <>
            <Button variant="danger" size="sm" onClick={() => { onDelete?.(client.id); setConfirmDelete(false) }}>Potwierdź</Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Anuluj</Button>
          </>
        )}
      </div>
    </div>
  )
}

export function ClientsPage() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const { data, isLoading } = useClients()
  const deleteClient = useDeleteClient()
  const canCreate = useCan('clients.create')
  const canDelete = useCan('clients.delete')

  return (
    <div>
      <div className="toolbar">
        <PageHeader title="Kontrahenci" subtitle="Pełne dane firmowe, NIP, adres, kontakt i szybka edycja." />
        <div className="toolbar__actions">{canCreate ? <PlanLimitGuard resource="clients"><Button onClick={() => { setSelected(null); setOpen(true) }}>Dodaj kontrahenta</Button></PlanLimitGuard> : null}</div>
      </div>
      <Card>
        {isLoading ? <Spinner /> : null}
        {!isLoading && !data?.length ? (
          <EmptyState
            title="Brak kontrahentów"
            description="Dodaj swojego pierwszego klienta lub inwestora. Kontrahenci trafią do kosztorysów, umów i faktur."
            icon={Users}
            action={
              canCreate ? (
                <Button onClick={() => { setSelected(null); setOpen(true) }}>Dodaj kontrahenta</Button>
              ) : undefined
            }
          />
        ) : null}
        {data?.length ? (
          <>
            {/* Desktop table — hidden on phone */}
            <div className="clients-desktop-table">
              <Table data={data} columns={[
                { key: 'name', header: 'Nazwa' },
                { key: 'nip', header: 'NIP', render: (row) => row.nip || '—' },
                { key: 'contact_person', header: 'Kontakt', render: (row) => row.contact_person || '—' },
                { key: 'phone', header: 'Telefon' },
                { key: 'address', header: 'Adres', render: (row) => `${row.postal_code || ''} ${row.city || ''}, ${row.address || ''}`.trim() || '—' },
                { key: 'actions', header: 'Akcje', render: (row) => <div className="actions-row"><Button variant="ghost" onClick={() => { setSelected(row); setOpen(true) }}>Edytuj</Button>{canDelete ? (deleteConfirmId === row.id ? (<><Button variant="danger" onClick={() => { deleteClient.mutate(row.id); setDeleteConfirmId(null) }} loading={deleteClient.isPending}>Potwierdź</Button><Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Anuluj</Button></>) : (<Button variant="danger" onClick={() => setDeleteConfirmId(row.id)}>Usuń</Button>)) : null}</div> },
              ]} />
            </div>
            {/* Mobile card list — shown on phone only */}
            <div className="clients-mobile-list">
              {data.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onEdit={(c) => { setSelected(c); setOpen(true) }}
                  onDelete={(id) => deleteClient.mutate(id)}
                  canDelete={canDelete}
                />
              ))}
            </div>
          </>
        ) : null}
      </Card>
      {canCreate ? <ClientModal open={open} onClose={() => setOpen(false)} initialClient={selected} /> : null}
    </div>
  )
}
