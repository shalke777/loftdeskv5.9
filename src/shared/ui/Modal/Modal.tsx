import { ReactNode, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'

const BACKDROP_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const MODAL_INITIAL = { opacity: 0, scale: 0.98 }
const MODAL_ANIMATE = { opacity: 1, scale: 1 }
const MODAL_EXIT    = { opacity: 0, scale: 0.98 }
const MODAL_TRANSITION = { duration: 0.15 }

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          variants={BACKDROP_VARIANTS}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className={clsx('modal', `modal--${size}`, className)}
            onClick={(e) => e.stopPropagation()}
            initial={MODAL_INITIAL}
            animate={MODAL_ANIMATE}
            exit={MODAL_EXIT}
            transition={MODAL_TRANSITION}
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
