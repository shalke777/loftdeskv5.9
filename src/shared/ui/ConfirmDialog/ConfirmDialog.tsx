import { Modal } from '@/shared/ui/Modal/Modal'
import { Button } from '@/shared/ui/Button/Button'

interface Props {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, description, onConfirm, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p>{description}</p>
      <div className="actions-row">
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        <Button variant="danger" onClick={onConfirm}>Potwierdź</Button>
      </div>
    </Modal>
  )
}
