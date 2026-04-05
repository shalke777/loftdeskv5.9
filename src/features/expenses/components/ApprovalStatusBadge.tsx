import type { ApprovalStatus } from '@/features/expenses/api/cost-approvals.api'

interface Props {
  status:    ApprovalStatus
  /** Show full label text (default: true) */
  showLabel?: boolean
  style?:    React.CSSProperties
}

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; icon: string; color: string; bg: string }> = {
  pending_client: { label: 'Oczekuje na klienta', icon: '⏳', color: '#B8742A', bg: 'rgba(212,150,10,0.15)' },
  accepted:       { label: 'Zaakceptowany',        icon: '✅', color: '#1A5C32', bg: 'rgba(26,92,50,0.18)' },
  rejected:       { label: 'Odrzucony',            icon: '❌', color: '#A83228', bg: 'rgba(239,68,68,0.12)' },
  questioned:     { label: 'Klient ma pytanie',    icon: '❓', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  cancelled:      { label: 'Anulowany',            icon: '🚫', color: 'var(--color-text-secondary)', bg: 'rgba(160,170,180,0.10)' },
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
