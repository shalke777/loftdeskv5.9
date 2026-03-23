// =============================================================================
// WelcomeBanner — shown when account is new / has no operational data
// =============================================================================

import { ArrowRight, BookOpen, Play, Users } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { isDemoMode } from '@/shared/lib/supabase'

interface Props {
  companyName?: string
  onDismiss?: () => void
}

export function WelcomeBanner({ companyName, onDismiss }: Props) {
  const navigate = useNavigate()

  const firstSteps = [
    { icon: Users, label: 'Dodaj klienta', href: '/clients' },
    { icon: BookOpen, label: 'Stwórz kosztorys', href: '/estimates' },
    { icon: Play, label: 'Uruchom projekt', href: '/projects' },
  ]

  return (
    <Card
      style={{
        background: 'linear-gradient(135deg, #1a0a10 0%, #4a1020 100%)',
        color: 'white',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative circle */}
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
          WITAJ W LOFTDESK
        </p>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 8, lineHeight: 1.3 }}>
          {companyName ? `Cześć, ${companyName}!` : 'Pierwsze logowanie'}
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 20, maxWidth: 480 }}>
          LoftDesk łączy kosztorysy, umowy, faktury, portal klienta i realizację —
          wszystko w jednym systemie. Zacznij od trzech prostych kroków:
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {firstSteps.map((step) => {
            const Icon = step.icon
            return (
              <button
                key={step.href}
                onClick={() => navigate({ to: step.href as any })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)')
                }
              >
                <Icon size={15} />
                {step.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            onClick={() => navigate({ to: '/onboarding' })}
            icon={<ArrowRight size={15} />}
            style={{ background: 'white', color: '#77BA8A', fontWeight: 700 }}
          >
            Otwórz przewodnik uruchomienia
          </Button>
          {isDemoMode && (
            <span
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.5)',
                padding: '4px 10px',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 999,
              }}
            >
              Tryb demo
            </span>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'rgba(255,255,255,0.5)',
                padding: '4px 8px',
                marginLeft: 'auto',
              }}
            >
              Zamknij
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
