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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#fef3c7', borderBottom: '1px solid #fcd34d', fontSize: 12 }}>
        <Zap size={13} color="#d97706" />
        <span style={{ color: '#92400e', flex: 1 }}>
          <strong>Tryb demo</strong> React dane sa przykladowe i nie sa zapisywane na serwerze.
        </span>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
            <X size={13} color="#92400e" />
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
    const bg     = isUrgent ? '#fef2f2' : '#fffbeb'
    const border = isUrgent ? '#fca5a5' : '#fcd34d'
    const color  = isUrgent ? '#991b1b' : '#92400e'
    const btnBg  = isUrgent ? '#dc2626' : '#d97706'

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: '#fef2f2', borderBottom: '1px solid #fca5a5', fontSize: 13, flexWrap: 'wrap' }}>
        <AlertTriangle size={15} color="#dc2626" style={{ flexShrink: 0 }} />
        <span style={{ color: '#991b1b', flex: 1 }}>
          <strong>Platnosc nie powiodla sie.</strong> Zaktualizuj metode platnosci, aby uniknac przerwy w dostepie.
        </span>
        <button
          onClick={() => navigate({ to: '/billing' })}
          style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
        >
          Napraw platnosc
        </button>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
            <X size={14} color="#991b1b" />
          </button>
        )}
      </div>
    )
  }

  // Free plan (canceled, none, or expired trial) — generic upgrade CTA
  if (plan === 'free') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'linear-gradient(90deg, #fefce8 0%, #fff7ed 100%)', borderBottom: '1px solid #fcd34d', fontSize: 13, flexWrap: 'wrap' }}>
        <Zap size={15} color="#d97706" style={{ flexShrink: 0 }} />
        <span style={{ color: '#92400e', flex: 1 }}>
          Korzystasz z planu <strong>Free</strong> React niektore funkcje sa ograniczone.
        </span>
        <button
          onClick={() => navigate({ to: '/billing' })}
          style={{ background: '#d97706', color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
        >
          Ulepsz plan
        </button>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>
            <X size={14} color="#92400e" />
          </button>
        )}
      </div>
    )
  }

  return null
}
