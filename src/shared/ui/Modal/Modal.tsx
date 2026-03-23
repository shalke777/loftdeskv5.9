import { ReactNode, useEffect, useRef } from 'react'
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
  const bodyRef = useRef<HTMLDivElement>(null)

  // On mobile, scroll focused inputs into view within the modal body
  useEffect(() => {
    if (!open) return
    const body = bodyRef.current
    if (!body) return
    function handleFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        // Small delay so virtual keyboard has time to resize viewport
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 300)
      }
    }
    body.addEventListener('focusin', handleFocusIn)
    return () => body.removeEventListener('focusin', handleFocusIn)
  }, [open])

  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={clsx('modal', `modal--${size}`, className)} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3>{title}</h3>
          <button className="modal__close" onClick={onClose} aria-label="Zamknij">×</button>
        </div>
        <div className="modal__body" ref={bodyRef}>{children}</div>
      </div>
    </div>
  )
}
