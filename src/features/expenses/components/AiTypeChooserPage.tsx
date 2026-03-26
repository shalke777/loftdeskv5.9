// =============================================================================
// AiTypeChooserPage — Unified AI analysis type selector
// =============================================================================
// Entry from dashboard "AI Analiza" tile.
// User picks between 3 AI engine types before uploading anything.
// Replaces the ambiguous direct jump to /room-analysis.

import { useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'

interface AiMode {
  emoji: string
  accent: string
  title: string
  subtitle: string
  description: string
  usedFor: string[]
  notFor: string[]
  href: string
  cta: string
}

const AI_MODES: AiMode[] = [
  {
    emoji: '🧾',
    accent: '#60A5FA',
    title: 'Dokument kosztowy',
    subtitle: 'Faktura · Paragon · Nota',
    description: 'AI odczytuje dane z dokumentu finansowego — numer, sprzedawcę, kwoty, termin płatności.',
    usedFor: [
      'Faktura VAT od dostawcy',
      'Paragon fiskalny',
      'Nota kosztowa',
      'Skan lub zdjęcie faktury',
    ],
    notFor: ['Zdjęcia pomieszczeń ani budowy', 'Projekty architektoniczne'],
    href: '/expenses',
    cta: 'Skanuj dokument',
  },
  {
    emoji: '📸',
    accent: '#77BA8A',
    title: 'Zdjęcia pomieszczenia',
    subtitle: 'Łazienka · Kuchnia · Salon · Budowa',
    description:
      'AI analizuje stan pomieszczenia lub etap remontu — rozpoznaje materiały, generuje zakres prac i draft wyceny.',
    usedFor: [
      'Zdjęcia z różnych kątów (1–10 sztuk)',
      'Stan przed remontem, w trakcie lub po',
      'Etap prac na budowie',
    ],
    notFor: ['Projekty architektoniczne PDF', 'Faktury i dokumenty finansowe'],
    href: '/room-analysis',
    cta: 'Analizuj pomieszczenie',
  },
  {
    emoji: '📐',
    accent: '#C084FC',
    title: 'Projekt / wizualizacja',
    subtitle: 'PDF · Rzut · Render wnętrza',
    description:
      'AI czyta projekt lub wizualizację — wyodrębnia pomieszczenia, materiały wykończenia, zakres prac i draft wyceny.',
    usedFor: [
      'PDF rzutu architektonicznego',
      'Wizualizacja lub render wnętrza',
      'Specyfikacja techniczna materiałów',
    ],
    notFor: ['Zdjęcia pomieszczenia', 'Faktury i paragony'],
    href: '/project-analysis',
    cta: 'Analizuj projekt',
  },
]

export function AiTypeChooserPage() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title="AI — wybierz typ analizy"
        subtitle="Wskaż, co chcesz przetworzyć, a AI dobierze właściwy silnik."
      />

      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
          padding: '4px 16px 48px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {AI_MODES.map((mode) => (
          <div
            key={mode.href}
            style={{
              borderRadius: 10,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Accent header */}
            <div
              style={{
                height: 4,
                background: mode.accent,
              }}
            />

            {/* Body */}
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

              {/* Used for */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Wrzucaj
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {mode.usedFor.map((item) => (
                    <li key={item} style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#77BA8A', flexShrink: 0, marginTop: 1 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Not for */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Nie wrzucaj
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {mode.notFor.map((item) => (
                    <li key={item} style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#E57373', flexShrink: 0, marginTop: 1 }}>✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '0 18px 16px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate({ to: mode.href as any })}
                style={{
                  width: '100%',
                  padding: '9px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  background: mode.accent,
                  borderColor: mode.accent,
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
