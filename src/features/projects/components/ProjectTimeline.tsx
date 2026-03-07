import type { Project } from '@/entities/project/model'

export function ProjectTimeline({ project }: { project: Project }) {
  const steps = [
    { label: 'Oferta', active: ['offer', 'active', 'done'].includes(project.status) },
    { label: 'Realizacja', active: ['active', 'done'].includes(project.status) },
    { label: 'Zamknięcie', active: project.status === 'done' },
  ]

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      <strong>Oś projektu</strong>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {steps.map((step) => (
          <div key={step.label} style={{ padding: '8px 12px', borderRadius: 999, background: step.active ? 'var(--color-brand-light)' : 'var(--color-border-light)', border: '1px solid var(--color-border)' }}>
            {step.label}
          </div>
        ))}
      </div>
    </div>
  )
}
