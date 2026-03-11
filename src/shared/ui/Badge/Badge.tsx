import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'

export function Badge({ children, variant = 'default', style }: { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger'; style?: CSSProperties }) {
  return <span className={clsx('badge', `badge--${variant}`)} style={style}>{children}</span>
}
