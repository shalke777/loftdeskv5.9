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

import { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { TrendingUp, Zap } from 'lucide-react'
import { usePlanLimits, LimitStatus } from '@/features/billing/hooks/usePlanLimits'

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
  const navigate = useNavigate()

  if (!data) return <>{children}</>

  const status = data[resource]
  if (!status.nearLimit && !status.exceeded) return <>{children}</>

  if (mode === 'banner') {
    return (
      <>
        {children}
        <UpgradeBannerInline resource={resource} status={status} onUpgrade={() => navigate({ to: '/billing' })} />
      </>
    )
  }

  // block mode: disable children when exceeded
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
        background: isExceeded ? '#fef2f2' : '#fffbeb',
        border: `1px solid ${isExceeded ? '#fca5a5' : '#fcd34d'}`,
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      {isExceeded ? (
        <TrendingUp size={15} color="#dc2626" style={{ flexShrink: 0 }} />
      ) : (
        <Zap size={15} color="#d97706" style={{ flexShrink: 0 }} />
      )}
      <span style={{ flex: 1, color: isExceeded ? '#991b1b' : '#92400e' }}>
        {isExceeded
          ? `Osiągnięto limit ${label} (${status.used}/${status.limit}). Ulepsz plan, aby dodać więcej.`
          : `Zbliżasz się do limitu ${label} (${status.used}/${status.limit}).`}
      </span>
      <button
        onClick={onUpgrade}
        style={{
          background: isExceeded ? '#dc2626' : '#d97706',
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
