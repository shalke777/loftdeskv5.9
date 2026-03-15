import { useMemo, useState } from 'react'
import { Users, Pencil, Trash2, Search, Plus } from 'lucide-react'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState'
import { Button } from '@/shared/ui/Button/Button'
import { useClients, useDeleteClient } from '@/features/clients/hooks/useClients'
import { ClientModal } from '@/features/clients/components/ClientModal'
import { useCan } from '@/features/auth/hooks/usePermissions'
import type { Client } from '@/entities/client/model'

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function ClientsPage() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const { data, isLoading } = useClients()
  const deleteClient = useDeleteClient()
  const canCreate = useCan('clients.create')
  const canDelete = useCan('clients.delete')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data ?? []
    return (data ?? []).filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.nip ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q),
    )
  }, [data, search])

  function openEdit(client: Client) {
    setSelected(client)
    setOpen(true)
  }

  function openNew() {
    setSelected(null)
    setOpen(true)
  }

  return (
    <div>
      <div className="toolbar">
        <PageHeader
          title="Kontrahenci"
          subtitle={data?.length ? `${data.length} ${data.length === 1 ? 'kontrahent' : data.length < 5 ? 'kontrahenci' : 'kontrahentów'}` : 'Pełne dane firmowe, NIP, adres, kontakt.'}
        />
        <div className="toolbar__actions">
          {canCreate ? (
            <Button onClick={openNew}>
              <Plus size={14} style={{ marginRight: 6 }} />
              Dodaj kontrahenta
            </Button>
          ) : null}
        </div>
      </div>

      {/* Search bar */}
      {(data?.length ?? 0) > 0 && (
        <div className="clients-search-wrap">
          <Search size={14} className="clients-search-icon" />
          <input
            className="input clients-search-input"
            placeholder="Szukaj po nazwie, NIP, email, mieście…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner />
        </div>
      ) : !data?.length ? (
        <EmptyState
          title="Brak kontrahentów"
          description="Dodaj swojego pierwszego klienta lub inwestora. Trafią do kosztorysów, umów i faktur."
          icon={Users}
          action={canCreate ? <Button onClick={openNew}>Dodaj kontrahenta</Button> : undefined}
        />
      ) : filtered.length === 0 ? (
        <div className="clients-no-results">Brak wyników dla „{search}"</div>
      ) : (
        <div className="proj-list clients-list">
          {filtered.map(client => {
            const address = [client.postal_code, client.city].filter(Boolean).join(' ')
            const addressFull = [address, client.address].filter(Boolean).join(', ')

            return (
              <div key={client.id} className="proj-row clients-row">
                <div className="clients-row__inner">
                  {/* Avatar */}
                  <div className="clients-row__avatar" aria-hidden>
                    {initials(client.name)}
                  </div>

                  {/* Primary: name + NIP */}
                  <div className="clients-row__primary">
                    <span className="clients-row__name">{client.name}</span>
                    {client.nip && (
                      <span className="clients-row__nip">NIP {client.nip}</span>
                    )}
                  </div>

                  {/* Secondary: contact person */}
                  {client.contact_person && (
                    <div className="clients-row__cell clients-row__cell--contact">
                      <span className="clients-row__label">Kontakt</span>
                      <span className="clients-row__value">{client.contact_person}</span>
                    </div>
                  )}

                  {/* Email + phone */}
                  <div className="clients-row__cell clients-row__cell--comms">
                    {client.email && <span className="clients-row__value">{client.email}</span>}
                    {client.phone && <span className="clients-row__value clients-row__phone">{client.phone}</span>}
                  </div>

                  {/* Address */}
                  {addressFull && (
                    <div className="clients-row__cell clients-row__cell--addr">
                      <span className="clients-row__value clients-row__value--muted">{addressFull}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="clients-row__actions">
                    <button
                      className="clients-row__action-btn"
                      onClick={() => openEdit(client)}
                      title="Edytuj"
                    >
                      <Pencil size={14} />
                    </button>
                    {canDelete && (
                      <button
                        className="clients-row__action-btn clients-row__action-btn--danger"
                        onClick={() => deleteClient.mutate(client.id)}
                        title="Usuń"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {canCreate ? (
        <ClientModal open={open} onClose={() => setOpen(false)} initialClient={selected} />
      ) : null}
    </div>
  )
}

