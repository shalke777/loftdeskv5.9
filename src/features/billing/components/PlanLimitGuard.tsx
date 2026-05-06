// =============================================================================
// PlanLimitGuard — inline upgrade prompt when near/at a resource limit
// =============================================================================
// Usage:
//   <PlanLimitGuard resource="projects">
//     <Button onClick={createProject}>Nowy projekt</Button>
//   </PlanLimitGuard>
//
// When limit is exceeded or near, wraps children in a disabled state and
// shows an upgrade tooltip/banner. When unlimited, renders children unchanged.
// =============================================================================

import { ReactNode, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { TrendingUp, Zap } from 'lucide-react'
import { usePlanLimits, LimitStatus } from '@/features/billing/hooks/usePlanLimits'
import { useBillingSummary } from '@/features/billing/hooks/useBilling'

type Resource = 'clients' | 'projects' | 'estimates' | 'invoices' | 'contracts'

const RESOURCE_LABELS: Record<Resource, string> = {
  clients:   'klientów',
  projects:  'projektów',
  estimates: 'kosztorysów',
  invoices:  'faktur',
  contracts: 'umów',
}

interface Props {
  resource: Resource
  children: ReactNode
  /** Show inline banner below children instead of blocking them */
  mode?: 'block' | 'banner'
}

export function PlanLimitGuard({ resource, children, mode = 'block' }: Props) {
  const { data } = usePlanLimits()
  const { data: summary } = useBillingSummary()
  const navigate = useNavigate()

  const status = data?.[resource]

  useEffect(() => {
    const companyId = summary?.companyId ?? 'unknown'
    const plan      = summary?.currentPlan ?? 'unknown'
    const used      = status?.used ?? '?'
    const limit     = status?.limit ?? '?'
    const exceeded  = status?.exceeded ?? false
    const nearLimit = status?.nearLimit ?? false
    const canCreate = !exceeded
    console.log(
      `[PLAN GUARD] resource=${resource} companyId=${companyId} plan=${plan} ` +
      `used=${used} limit=${limit} exceeded=${exceeded} nearLimit=${nearLimit} canCreate=${canCreate}`
    )
  })

  if (!data || !status) {
    console.log(`[PLAN GUARD] resource=${resource} — no data yet, rendering children (pass-through)`)
    return <>{children}</>
  }

  // INVARIANT: non-free plans always have unlimited resources.
  // If the plan is anything other than 'free', never block — regardless of
  // what usePlanLimits computed. This is the last-resort safety net.
  if (data.plan !== 'free') {
    console.log(`[PLAN GUARD] resource=${resource} plan=${data.plan} — non-free plan, always allowing access`)
    return <>{children}</>
  }

  if (!status.nearLimit && !status.exceeded) {
    console.log(`[PLAN GUARD] resource=${resource} — within limits, rendering children unblocked`)
    return <>{children}</>
  }

  if (mode === 'banner') {
    console.log(`[PLAN GUARD] resource=${resource} — near/exceeded, showing banner (children still visible)`)
    return (
      <>
        {children}
        <UpgradeBannerInline resource={resource} status={status} onUpgrade={() => navigate({ to: '/billing' })} />
      </>
    )
  }

  // block mode: disable children when exceeded
  console.log(`[PLAN GUARD] resource=${resource} — exceeded=${status.exceeded}, ${status.exceeded ? 'BLOCKING creation' : 'showing warning'}`)
  return (
    <div style={{ position: 'relative' }}>
      {status.exceeded ? (
        <div style={{ opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>{children}</div>
      ) : (
        children
      )}
      <UpgradeBannerInline resource={resource} status={status} onUpgrade={() => navigate({ to: '/billing' })} />
    </div>
  )
}

function UpgradeBannerInline({
  resource,
  status,
  onUpgrade,
}: {
  resource: Resource
  status: LimitStatus
  onUpgrade: () => void
}) {
  const isExceeded = status.exceeded
  const label = RESOURCE_LABELS[resource]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
        padding: '10px 14px',
        background: isExceeded ? 'rgba(239,68,68,0.12)' : 'rgba(212,150,10,0.12)',
        border: `1px solid ${isExceeded ? 'rgba(239,68,68,0.30)' : 'rgba(212,150,10,0.30)'}`,
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      {isExceeded ? (
        <TrendingUp size={15} color="var(--color-error)" style={{ flexShrink: 0 }} />
      ) : (
        <Zap size={15} color="var(--color-accent)" style={{ flexShrink: 0 }} />
      )}
      <span style={{ flex: 1, color: isExceeded ? 'var(--color-error)' : 'var(--color-accent)' }}>
        {isExceeded
          ? `Osiągnięto limit ${label} (${status.used}/${status.limit}). Ulepsz plan, aby dodać więcej.`
          : `Zbliżasz się do limitu ${label} (${status.used}/${status.limit}).`}
      </span>
      <button
        onClick={onUpgrade}
        style={{
          background: isExceeded ? 'var(--color-error)' : 'var(--color-accent)',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '5px 12px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Ulepsz plan
      </button>
    </div>
  )
}
