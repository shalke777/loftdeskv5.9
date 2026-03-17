// =============================================================================
// ClientSelectWithCreate
// Drops into any form in place of a plain <Select label="Klient">.
// Shows a dropdown of existing clients + a "+" button that opens ClientModal.
// After the new client is saved, it is auto-selected in the current form.
// =============================================================================
import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Select } from '@/shared/ui/Select/Select'
import { ClientModal } from '@/features/clients/components/ClientModal'
import { useClients } from '@/features/clients/hooks/useClients'
import type { Client } from '@/entities/client/model'

interface Props {
  value: string
  onChange: (clientId: string) => void
  placeholder?: string
  label?: string
}

export function ClientSelectWithCreate({
  value,
  onChange,
  placeholder = 'Bez przypisania',
  label = 'Kontrahent',
}: Props) {
  const { data: clients = [] } = useClients()
  const [modalOpen, setModalOpen] = useState(false)

  const options = useMemo(
    () => clients.map((c: Client) => ({ value: c.id, label: c.name })),
    [clients],
  )

  function handleCreated(client: Client) {
    // ClientModal calls onCreated before onClose, so onChange while modal is still mounted
    onChange(client.id)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Select
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={options}
          placeholder={placeholder}
        />
      </div>
      <button
        type="button"
        title="Nowy kontrahent"
        onClick={() => setModalOpen(true)}
        style={{
          flexShrink: 0,
          height: 42,
          width: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-soft)',
          color: 'var(--color-brand)',
          cursor: 'pointer',
          transition: 'background .15s',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand-light)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-soft)')}
      >
        <UserPlus size={16} />
      </button>

      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
