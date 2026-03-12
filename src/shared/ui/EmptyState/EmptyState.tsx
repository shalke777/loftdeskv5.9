import type { ReactNode, CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description: string
  icon?: LucideIcon
  action?: ReactNode
  style?: CSSProperties
}

export function EmptyState({ title, description, icon: Icon, action, style }: EmptyStateProps) {
  return (
    <div className="empty-state" style={style}>
      {Icon && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Icon size={36} strokeWidth={1.25} color="var(--color-text-tertiary, #94a3b8)" />
        </div>
      )}
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}
