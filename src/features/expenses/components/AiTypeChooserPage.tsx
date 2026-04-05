// =============================================================================
// AiTypeChooserPage — Project-first AI analysis type selector
// =============================================================================
// Step 1: Select project (mandatory — AI runs in project context).
// Step 2: Pick analysis type — navigates to sub-page with ?projectId=X.

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { ProjectPickerCard } from '@/shared/ui/ProjectPickerCard/ProjectPickerCard'
import { useProjects } from '@/features/projects/hooks/useProjects'

interface AiMode {
  emoji: string
  accent: string
  title: string
  subtitle: string
  description: string
  href: string
  cta: string
}

const AI_MODES: AiMode[] = [
  {
    emoji: '🧾',
    accent: '#3E8C58',
    title: 'Dokument kosztowy',
    subtitle: 'Faktura · Paragon · Nota',
    description: 'AI odczytuje dane z dokumentu finansowego — numer, sprzedawcę, kwoty, termin płatności.',
    href: '/expenses',
    cta: 'Skanuj dokument',
  },
  {
    emoji: '📸',
    accent: '#1A5C32',
    title: 'Zdjęcia pomieszczenia',
    subtitle: 'Łazienka · Kuchnia · Salon · Budowa',
    description: 'AI analizuje stan pomieszczenia — rozpoznaje materiały, generuje zakres prac i draft wyceny.',
    href: '/room-analysis',
    cta: 'Analizuj pomieszczenie',
  },
  {
    emoji: '📐',
    accent: '#C084FC',
    title: 'Projekt / wizualizacja',
    subtitle: 'PDF · Rzut · Render wnętrza',
    description: 'AI czyta projekt — wyodrębnia pomieszczenia, materiały wykończenia, zakres prac i draft wyceny.',
    href: '/project-analysis',
    cta: 'Analizuj projekt',
  },
]

export function AiTypeChooserPage() {
  const navigate = useNavigate()
  const { data: projects = [], isLoading: projectsLoading } = useProjects()
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [step, setStep] = useState<'project' | 'type'>('project')

  // ── Step 1: Project picker (mandatory) ────────────────────────────────────
  if (step === 'project') {
    return (
      <div>
        <PageHeader
          title="AI — wybierz projekt"
          subtitle="Analiza AI działa w kontekście projektu. Wybierz projekt, dla którego chcesz uruchomić AI."
        />
        <ProjectPickerCard
          projects={projects}
          loading={projectsLoading}
          selectedId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onNext={() => setStep('type')}
          nextLabel="Dalej — wybierz typ analizy"
          onBack={() => navigate({ to: '/dashboard' as any })}
          backLabel="← Tablica"
        />
      </div>
    )
  }

  // ── Step 2: Type selection (project already chosen) ───────────────────────
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  return (
    <div>
      <PageHeader
        title="AI — wybierz typ analizy"
        subtitle="Wskaż, co chcesz przetworzyć, a AI dobierze właściwy silnik."
      />

      {/* Project context badge */}
      {selectedProject && (
        <div style={{ maxWidth: 860, margin: '0 auto 12px', padding: '0 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 8,
            background: 'var(--color-primary-soft, rgba(37,99,235,0.06))',
            border: '1px solid var(--color-primary, #2563EB)',
            fontSize: 13,
          }}>
            <span>📂</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {selectedProject.number} · {selectedProject.name}
            </span>
            <button
              type="button"
              onClick={() => setStep('project')}
              style={{
                marginLeft: 'auto', fontSize: 12, color: 'var(--color-primary, #2563EB)',
                background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Zmień projekt
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: 860, margin: '0 auto', padding: '4px 16px 48px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16,
        }}
      >
        {AI_MODES.map((mode) => (
          <div
            key={mode.href}
            style={{
              borderRadius: 10, background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ height: 4, background: mode.accent }} />

            <div style={{ padding: '18px 18px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>{mode.emoji}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>
                    {mode.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                    {mode.subtitle}
                  </p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                {mode.description}
              </p>
            </div>

            <div style={{ padding: '0 18px 16px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate({
                  to: mode.href as any,
                  search: { projectId: selectedProjectId } as any,
                })}
                style={{
                  width: '100%', padding: '9px 0', fontSize: 13, fontWeight: 600,
                  background: mode.accent, borderColor: mode.accent,
                }}
              >
                {mode.cta} →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
