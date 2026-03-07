import { Button } from '@/shared/ui/Button/Button'
import { Modal } from '@/shared/ui/Modal/Modal'

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

export function ProjectInvoiceModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Generuj fakturę z projektu">
      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
        <h3 style={{ marginBottom: 8 }}>Funkcja w budowie</h3>
        <p style={{ color: '#718096', fontSize: 14, marginBottom: 24 }}>
          Zaawansowane generowanie faktur z projektu (VAT, transze) jest w trakcie implementacji. Wkrótce dostępne.
        </p>
        <Button onClick={onClose}>Zamknij</Button>
      </div>
    </Modal>
  )
}
