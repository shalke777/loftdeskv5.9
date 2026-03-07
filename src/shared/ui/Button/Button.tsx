import { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
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
    <button
      className={clsx('btn', `btn--${variant}`, `btn--${size}`, className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {icon ? <span className="btn__icon">{icon}</span> : null}
      <span>{loading ? 'Ładowanie...' : children}</span>
    </button>
  )
}
