// =============================================================================
// OnboardingChecklist — compact progress widget for the dashboard
// =============================================================================

import { CheckCircle2, ChevronRight, Circle, Rocket } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { useOnboardingProgress } from '@/features/onboarding/hooks/useOnboardingProgress'

export function OnboardingChecklist() {
  const { data: progress, isLoading } = useOnboardingProgress()
  const navigate = useNavigate()

  if (isLoading || !progress || progress.isComplete) return null

  const nextStep = progress.steps.find((s) => !s.done)

  return (
    <Card style={{ marginBottom: 16, borderLeft: '4px solid var(--color-brand, #1A5C32)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: progress */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Rocket size={16} color="var(--color-brand, #1A5C32)" />
            <strong style={{ fontSize: 14 }}>Pierwsze kroki</strong>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-brand, #1A5C32)',
              }}
            >
              {progress.done}/{progress.total}
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: 'var(--color-border-light, #f1f5f9)',
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: `${progress.progress}%`,
                height: '100%',
                background: 'var(--color-brand, #1A5C32)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          {/* Steps */}
          <div style={{ display: 'grid', gap: 6 }}>
            {progress.steps.map((step) => (
              <button
                key={step.key}
                onClick={() => navigate({ to: step.href as any })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'none',
                  border: 'none',
                  cursor: step.done ? 'default' : 'pointer',
                  padding: '4px 0',
                  textAlign: 'left',
                  borderRadius: 6,
                  opacity: step.done ? 0.6 : 1,
                  width: '100%',
                }}
              >
                {step.done ? (
                  <CheckCircle2 size={16} color="var(--color-success, #1A5C32)" style={{ flexShrink: 0 }} />
                ) : (
                  <Circle size={16} color="var(--color-text-tertiary, #6E6A60)" style={{ flexShrink: 0 }} />
                )}
                <span
                  style={{
                    fontSize: 13,
                    color: step.done
                      ? 'var(--color-text-muted, #6b7280)'
                      : 'var(--color-text, #111827)',
                    textDecoration: step.done ? 'line-through' : 'none',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {step.label}
                </span>
                {!step.done && (
                  <ChevronRight
                    size={14}
                    color="var(--color-text-tertiary, #94a3b8)"
                    style={{ flexShrink: 0 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right: next action CTA */}
        {nextStep && (
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
              minWidth: 140,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted, #6b7280)',
                margin: 0,
                textAlign: 'right',
              }}
            >
              Następny krok
            </p>
            <Button
              size="sm"
              onClick={() => navigate({ to: nextStep.href as any })}
              icon={<ChevronRight size={14} />}
            >
              {nextStep.cta}
            </Button>
            <button
              onClick={() => navigate({ to: '/onboarding' })}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--color-text-muted, #6b7280)',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Zobacz cały checklist
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}
