import { ReactNode } from 'react'
import clsx from 'clsx'

interface Props {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'md' | 'lg' | 'xl' | 'full'
  className?: string
}

export function Modal({ title, open, onClose, children, size = 'lg', className }: Props) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={clsx('modal', `modal--${size}`, className)} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3>{title}</h3>
          <button className="modal__close" onClick={onClose} aria-label="Zamknij">×</button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
