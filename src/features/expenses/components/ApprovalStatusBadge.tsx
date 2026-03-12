import type { ApprovalStatus } from '@/features/expenses/api/cost-approvals.api'

interface Props {
  status:    ApprovalStatus
  /** Show full label text (default: true) */
  showLabel?: boolean
  style?:    React.CSSProperties
}

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; icon: string; color: string; bg: string }> = {
  pending_client: { label: 'Oczekuje na klienta', icon: '⏳', color: '#92400e', bg: '#fef3c7' },
  accepted:       { label: 'Zaakceptowany',        icon: '✅', color: '#065f46', bg: '#d1fae5' },
  rejected:       { label: 'Odrzucony',            icon: '❌', color: '#991b1b', bg: '#fee2e2' },
  questioned:     { label: 'Klient ma pytanie',    icon: '❓', color: '#1e3a8a', bg: '#dbeafe' },
  cancelled:      { label: 'Anulowany',            icon: '🚫', color: '#6b7280', bg: '#f3f4f6' },
}

export function ApprovalStatusBadge({ status, showLabel = true, style }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.cancelled

  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           4,
        padding:       showLabel ? '3px 10px' : '3px 6px',
        borderRadius:  99,
        fontSize:      12,
        fontWeight:    600,
        letterSpacing: 0.1,
        color:         cfg.color,
        background:    cfg.bg,
        whiteSpace:    'nowrap',
        ...style,
      }}
    >
      <span style={{ fontSize: 10, lineHeight: 1 }}>{cfg.icon}</span>
      {showLabel && cfg.label}
    </span>
  )
}
