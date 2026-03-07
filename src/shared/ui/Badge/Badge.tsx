import clsx from 'clsx'

export function Badge({ children, variant = 'default' }: { children: string; variant?: 'default' | 'success' | 'warning' | 'danger' }) {
  return <span className={clsx('badge', `badge--${variant}`)}>{children}</span>
}
