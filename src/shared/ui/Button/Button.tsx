import { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import { BTN_HOVER, BTN_TAP, BTN_TRANSITION } from '@/shared/motion/tokens'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// Omit HTML drag/animation props that conflict with Framer Motion's own handlers
interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragEnter' | 'onDragLeave' | 'onDragOver' | 'onDrop' | 'onAnimationStart'
> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  ...props
}: Props) {
  return (
    <motion.button
      className={clsx('btn', `btn--${variant}`, `btn--${size}`, className)}
      disabled={loading || props.disabled}
      whileHover={!loading && !props.disabled ? BTN_HOVER : undefined}
      whileTap={!loading && !props.disabled ? BTN_TAP : undefined}
      transition={BTN_TRANSITION}
      {...props}
    >
      {icon ? <span className="btn__icon">{icon}</span> : null}
      <span>{loading ? 'Ładowanie...' : children}</span>
    </motion.button>
  )
}
