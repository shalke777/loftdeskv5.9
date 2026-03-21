import { Fragment } from 'react'
import type { Project } from '@/entities/project/model'

const STEPS: { key: string; label: string }[] = [
  { key: 'offer',  label: 'Oferta'      },
  { key: 'active', label: 'Realizacja'  },
  { key: 'done',   label: 'Zakończony' },
]

const STATUS_ORDER: Record<Project['status'], number> = { offer: 0, active: 1, done: 2, cancelled: -1 }

export function ProjectTimeline({ project }: { project: Project }) {
  if (project.status === 'cancelled') {
    return (
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <strong style={{ fontSize: 13 }}>Etap projektu</strong>
        <span style={{ fontSize: 13, color: 'var(--color-error, #dc2626)', fontWeight: 600 }}>⛔ Anulowany</span>
      </div>
    )
  }

  const currentIdx = STATUS_ORDER[project.status]

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      <strong style={{ fontSize: 13 }}>Etap projektu</strong>
      <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
        {STEPS.map((step, i) => {
          const isPast    = currentIdx > i
          const isCurrent = currentIdx === i
          const isFuture  = currentIdx < i
          return (
            <Fragment key={step.key}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                    background: isFuture ? 'var(--color-border-light, #e2e8f0)' : 'var(--color-brand, #7a2230)',
                    color: isFuture ? 'var(--color-text-muted, #94a3b8)' : '#fff',
                    border: isCurrent ? '2px solid var(--color-brand, #7a2230)' : '2px solid transparent',
                    boxShadow: isCurrent ? '0 0 0 3px rgba(122,34,48,.18)' : 'none',
                  }}
                >
                  {isPast ? '✓' : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 500,
                    color: isFuture
                      ? 'var(--color-text-muted, #94a3b8)'
                      : isCurrent
                        ? 'var(--color-brand, #7a2230)'
                        : 'var(--color-text-secondary, #6b7280)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.label}
                  {isCurrent && (
                    <span style={{ display: 'block', fontSize: 9, fontWeight: 400, color: 'var(--color-text-muted)' }}>◄ teraz</span>
                  )}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: currentIdx > i
                      ? 'var(--color-brand, #7a2230)'
                      : 'var(--color-border-light, #e2e8f0)',
                    marginBottom: 20,
                    minWidth: 16,
                  }}
                />
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
