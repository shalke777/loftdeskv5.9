// =============================================================================
// UpgradeBanner — trial / plan status banner shown at top of app or dashboard
// =============================================================================

import { X, Zap } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useBillingSummary } from '@/features/billing/hooks/useBilling'
import { isDemoMode } from '@/shared/lib/supabase'
import { PLAN_DEFS } from '@/shared/lib/constants'

/** Number of days trial remaining before banner appears */
const TRIAL_WARN_DAYS = 7

interface Props {
  onDismiss?: () => void
}

export function UpgradeBanner({ onDismiss }: Props) {
  const { data, isLoading } = useBillingSummary()
  const navigate = useNavigate()

  if (isLoading || !data) return null

  const plan = data.currentPlan
  const planDef = PLAN_DEFS[plan as keyof typeof PLAN_DEFS]

  // Show only for free plan — Pro/Business/Admin don't need upgrade nudge
  if (plan !== 'free') return null

  // Demo mode: show thin "demo" pill, not a pushy banner
  if (isDemoMode) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          background: '#fef3c7',
          borderBottom: '1px solid #fcd34d',
          fontSize: 12,
        }}
      >
        <Zap size={13} color="#d97706" />
        <span style={{ color: '#92400e', flex: 1 }}>
          <strong>Tryb demo</strong> — dane są przykładowe i nie są zapisywane na serwerze.
        </span>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
            <X size={13} color="#92400e" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        background: 'linear-gradient(90deg, #fefce8 0%, #fff7ed 100%)',
        borderBottom: '1px solid #fcd34d',
        fontSize: 13,
        flexWrap: 'wrap',
      }}
    >
      <Zap size={15} color="#d97706" style={{ flexShrink: 0 }} />
      <span style={{ color: '#92400e', flex: 1 }}>
        Używasz planu <strong>{planDef?.name ?? plan}</strong> — niektóre funkcje są ograniczone.
      </span>
      <button
        onClick={() => navigate({ to: '/billing' })}
        style={{
          background: '#d97706',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '5px 14px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Ulepsz plan
      </button>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
        >
          <X size={14} color="#92400e" />
        </button>
      )}
    </div>
  )
}
