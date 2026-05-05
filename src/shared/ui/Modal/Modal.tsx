import { ReactNode, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'md' | 'lg' | 'xl' | 'full'
  className?: string
}

const BACKDROP_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const MODAL_SPRING = { type: 'spring' as const, stiffness: 400, damping: 25 }

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          variants={BACKDROP_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={clsx('modal', `modal--${size}`, className)}
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.85, opacity: 0, y: 60, filter: 'blur(12px)', transformPerspective: 1200 }}
            animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)', transformPerspective: 1200 }}
            exit={{ scale: 0.9, opacity: 0, y: 30, filter: 'blur(8px)', transformPerspective: 1200 }}
            transition={MODAL_SPRING}
          >
            <div className="modal__header">
              <h3>{title}</h3>
              <button className="modal__close" onClick={onClose} aria-label="Zamknij">×</button>
            </div>
            <div className="modal__body" ref={bodyRef}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
