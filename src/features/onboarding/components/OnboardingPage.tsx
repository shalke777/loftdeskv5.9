import { Link } from '@tanstack/react-router'
import { CheckCircle2, Circle, ShieldCheck, Users, Wallet, ArrowRight, FolderKanban } from 'lucide-react'
import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useOnboardingProgress } from '@/features/onboarding/hooks/useOnboardingProgress'
import { PLAN_DEFS } from '@/shared/lib/constants'

const quickLinks = [
  { to: '/settings',  label: 'Profil firmy',    icon: ShieldCheck  },
  { to: '/clients',   label: 'Dodaj klienta',    icon: Users        },
  { to: '/projects',  label: 'Nowy projekt',     icon: FolderKanban },
  { to: '/billing',   label: 'Plan i limity',    icon: Wallet       },
] as const

export function OnboardingPage() {
  const { user } = useAuth()
  const { data: progress, isLoading } = useOnboardingProgress()

  if (isLoading) return null

  if (!user || !progress) {
    return (
      <div>
        <PageHeader title="Pierwsze kroki" subtitle="Brak aktywnej firmy do skonfigurowania." />
      </div>
    )
  }

  const planDef = PLAN_DEFS[user.plan as keyof typeof PLAN_DEFS] ?? PLAN_DEFS.free

  return (
    <div>
      <PageHeader
        title="Pierwsze kroki"
        subtitle="Skonfiguruj workspace i zacznij korzystac z LoftDesk."
      />

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div>
              <h3 style={{ marginBottom: 2 }}>{user.companyName ?? 'Twoja firma'}</h3>
              <p className="field__label">Postep konfiguracji workspace</p>
            </div>
            <Badge
              variant={
                progress.progress >= 80 ? 'success' : progress.progress >= 40 ? 'warning' : 'default'
              }
            >
              {progress.progress}%
            </Badge>
          </div>
          <div style={{ background: 'var(--color-border-light, #f1f5f9)', borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 12 }}>
            <div
              style={{
                width: `${progress.progress}%`,
                height: '100%',
                background: progress.progress >= 80 ? 'var(--color-success, #77BA8A)' : 'var(--color-brand, #77BA8A)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Wykonano <strong>{progress.done}</strong> z <strong>{progress.total}</strong> krokow.
          </p>
          <p style={{ fontSize: 13 }}>
            Plan: <strong style={{ color: planDef.color }}>{planDef.name}</strong>
          </p>
          {progress.isComplete && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(119,186,138,0.15)', border: '1px solid rgba(119,186,138,0.30)', borderRadius: 8, fontSize: 13, color: '#77BA8A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} />
              <strong>Workspace gotowy!</strong>&nbsp;Masz skonfigurowane wszystkie podstawowe funkcje.
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ marginBottom: 12 }}>Szybkie akcje</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {quickLinks.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      background: 'var(--color-surface-secondary, #f8fafc)',
                      border: '1px solid var(--color-border-light, #e5e7eb)',
                      borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                      fontSize: 13, fontWeight: 500, color: 'var(--color-text)',
                    }}
                  >
                    <Icon size={15} color="var(--color-brand, #77BA8A)" />
                    {item.label}
                    <ArrowRight size={13} color="var(--color-text-tertiary)" style={{ marginLeft: 'auto' }} />
                  </button>
                </Link>
              )
            })}
          </div>
          <div style={{ marginTop: 12 }}>
            <Link to="/dashboard">
              <Button variant="ghost" style={{ width: '100%' }}>Wroc do dashboardu</Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <h3 style={{ marginBottom: 16 }}>Checklist uruchomienia</h3>
        <div style={{ display: 'grid', gap: 2 }}>
          {progress.steps.map((step) => (
            <Link key={step.key} to={step.href as any} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-border-light, #f1f5f9)',
                  opacity: step.done ? 0.6 : 1,
                }}
              >
                {step.done ? (
                  <CheckCircle2 size={20} color="var(--color-success, #77BA8A)" style={{ flexShrink: 0, marginTop: 1 }} />
                ) : (
                  <Circle size={20} color="var(--color-text-tertiary, #94a3b8)" style={{ flexShrink: 0, marginTop: 1 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, textDecoration: step.done ? 'line-through' : 'none', color: step.done ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                    {step.label}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted, #6b7280)' }}>
                    {step.description}
                  </p>
                </div>
                {!step.done && (
                  <Badge variant="default" style={{ flexShrink: 0 }}>{step.cta}</Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
