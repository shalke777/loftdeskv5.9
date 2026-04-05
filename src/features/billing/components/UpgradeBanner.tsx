// =============================================================================
// UpgradeBanner — subscription status banner shown at top of app / dashboard
//
// Shows:
//   - Demo mode: thin yellow "Tryb demo" pill
//   - Trialing (< 7 days left): countdown + upgrade CTA
//   - past_due / unpaid: payment failed warning
//   - canceled / free with expired trial: upgrade CTA
//   - active paid plan: hidden
// =============================================================================

import { AlertTriangle, Clock, X, Zap } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useBillingSummary } from '@/features/billing/hooks/useBilling'
import { isDemoMode } from '@/shared/lib/supabase'

const TRIAL_WARN_DAYS = 7

interface Props {
  onDismiss?: () => void
}

export function UpgradeBanner({ onDismiss }: Props) {
  const { data, isLoading } = useBillingSummary()
  const navigate = useNavigate()

  if (isLoading || !data) return null

  const { currentPlan: plan, subscriptionStatus: status, trialEndsAt } = data

  // Demo mode: thin informational pill only
  if (isDemoMode) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(212,150,10,0.15)', borderBottom: '1px solid rgba(212,150,10,0.30)', fontSize: 12 }}>
        <Zap size={13} color="var(--color-accent)" />
        <span style={{ color: 'var(--color-accent)', flex: 1 }}>
          <strong>Tryb demo</strong> React dane sa przykladowe i nie sa zapisywane na serwerze.
        </span>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
            <X size={13} color="var(--color-accent)" />
          </button>
        )}
      </div>
    )
  }

  // Active paid plan — no banner needed
  if (plan !== 'free' && status === 'active') return null

  // Trial countdown — show when <= TRIAL_WARN_DAYS remain
  if (status === 'trialing' && trialEndsAt) {
    const msLeft   = new Date(trialEndsAt).getTime() - Date.now()
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000))

    if (daysLeft > TRIAL_WARN_DAYS) return null  // plenty of time, stay quiet

    const isUrgent = daysLeft <= 2
    const bg     = isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(212,150,10,0.12)'
    const border = isUrgent ? 'rgba(239,68,68,0.30)' : 'rgba(212,150,10,0.30)'
    const color  = isUrgent ? 'var(--color-error)' : 'var(--color-accent)'
    const btnBg  = isUrgent ? 'var(--color-error)' : 'var(--color-accent)'

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: bg, borderBottom: `1px solid ${border}`, fontSize: 13, flexWrap: 'wrap' }}>
        <Clock size={15} color={btnBg} style={{ flexShrink: 0 }} />
        <span style={{ color, flex: 1 }}>
          {daysLeft === 0
            ? <><strong>Trial wygasa dzisiaj</strong> React aktywuj subskrypcje, aby zachowac dostep do funkcji premium.</>
            : <><strong>{daysLeft} {daysLeft === 1 ? 'dzien' : 'dni'} trialu pozostalo.</strong> Aktywuj plan przed wygasniecem.</>
          }
        </span>
        <button
          onClick={() => navigate({ to: '/billing' })}
          style={{ background: btnBg, color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
        >
          Aktywuj plan
        </button>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
            <X size={14} color={color} />
          </button>
        )}
      </div>
    )
  }

  // Payment failed / unpaid
  if (status === 'past_due' || status === 'unpaid') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.30)', fontSize: 13, flexWrap: 'wrap' }}>
        <AlertTriangle size={15} color="var(--color-error)" style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--color-error)', flex: 1 }}>
          <strong>Platnosc nie powiodla sie.</strong> Zaktualizuj metode platnosci, aby uniknac przerwy w dostepie.
        </span>
        <button
          onClick={() => navigate({ to: '/billing' })}
          style={{ background: 'var(--color-error)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
        >
          Napraw platnosc
        </button>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
            <X size={14} color="var(--color-error)" />
          </button>
        )}
      </div>
    )
  }

  // Free plan (canceled, none, or expired trial) — generic upgrade CTA
  if (plan === 'free') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'linear-gradient(90deg, rgba(212,150,10,0.12) 0%, rgba(212,150,10,0.12) 100%)', borderBottom: '1px solid rgba(212,150,10,0.30)', fontSize: 13, flexWrap: 'wrap' }}>
        <Zap size={15} color="var(--color-accent)" style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--color-accent)', flex: 1 }}>
          Korzystasz z planu <strong>Free</strong> React niektore funkcje sa ograniczone.
        </span>
        <button
          onClick={() => navigate({ to: '/billing' })}
          style={{ background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
        >
          Ulepsz plan
        </button>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
            <X size={14} color="var(--color-accent)" />
          </button>
        )}
      </div>
    )
  }

  return null
}
