// =============================================================================
// OnboardingChecklist — compact progress widget for the dashboard
// =============================================================================

import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, Rocket } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { useOnboardingProgress } from '@/features/onboarding/hooks/useOnboardingProgress'
import { useLocalStorage } from '@/shared/hooks/useLocalStorage'

export function OnboardingChecklist() {
  const { data: progress, isLoading } = useOnboardingProgress()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useLocalStorage('loftdesk-onboarding-collapsed', true)

  if (isLoading || !progress || progress.isComplete) return null

  const nextStep = progress.steps.find((s) => !s.done)

  return (
    <Card style={{ marginBottom: 16, borderLeft: '4px solid var(--color-brand)' }}>
      {/* Header — always visible, click to toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <Rocket size={16} color="var(--color-brand)" />
        <strong style={{ fontSize: 14 }}>Pierwsze kroki</strong>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)' }}>
          {progress.done}/{progress.total}
        </span>
        {/* Progress bar — inline mini */}
        <div style={{ flex: 1, maxWidth: 120, height: 4, borderRadius: 999, background: 'var(--color-border-light)', overflow: 'hidden', marginLeft: 8 }}>
          <div style={{ width: `${progress.progress}%`, height: '100%', background: 'var(--color-brand)', transition: 'width 0.4s ease' }} />
        </div>
        {collapsed
          ? <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }} />
          : <ChevronUp size={16} style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }} />}
      </button>

      {/* Expandable content */}
      {!collapsed && (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {progress.steps.map((step) => (
                <button
                  key={step.key}
                  onClick={() => navigate({ to: step.href as any })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'none', border: 'none',
                    cursor: step.done ? 'default' : 'pointer',
                    padding: '4px 0', textAlign: 'left', borderRadius: 6,
                    opacity: step.done ? 0.6 : 1, width: '100%',
                  }}
                >
                  {step.done
                    ? <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
                    : <Circle size={16} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />}
                  <span style={{
                    fontSize: 13,
                    color: step.done ? 'var(--color-text-muted)' : 'var(--color-text)',
                    textDecoration: step.done ? 'line-through' : 'none',
                    flex: 1, minWidth: 0,
                  }}>
                    {step.label}
                  </span>
                  {!step.done && <ChevronRight size={14} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </div>

          {nextStep && (
            <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 140 }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, textAlign: 'right' }}>Następny krok</p>
              <Button size="sm" onClick={() => navigate({ to: nextStep.href as any })} icon={<ChevronRight size={14} />}>
                {nextStep.cta}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
