import { LegalDocPage } from '@/features/legal/components/LegalDocPage'
import { type LegalDocKey } from '@/features/legal/lib/docContent'

const ROUTE_KEY_MAP: Record<string, LegalDocKey> = {
  'regulamin': 'regulamin',
  'polityka-prywatnosci': 'polityka-prywatnosci',
  'polityka-cookies': 'polityka-cookies',
  'dpa': 'dpa',
  'subprocesorzy': 'subprocesorzy',
  'zasady-platnosci': 'zasady-platnosci',
  'reklamacje': 'reklamacje',
  'aup': 'aup',
}

/**
 * Rendered at /legal/:doc
 * Uses window.location to extract the doc segment (compatible with both
 * TanStack Router and a static catch-all route strategy).
 */
export function LegalDocRoutePage() {
  const segment = window.location.pathname.split('/legal/')[1]?.split('/')[0] ?? ''
  const docKey = ROUTE_KEY_MAP[segment]

  if (!docKey) {
    return (
      <div className="legal-page">
        <div className="legal-page__header">
          <h1 className="legal-page__title">Dokument niedostępny</h1>
          <p>Sprawdź adres URL lub wróć do{' '}
            <a href="/dashboard">dashboardu</a>.
          </p>
        </div>
      </div>
    )
  }

  return <LegalDocPage docKey={docKey} showBack />
}

// Index list of all available legal documents
export function LegalIndexRoutePage() {
  const docs: Array<{ key: LegalDocKey; label: string; path: string }> = [
    { key: 'regulamin', label: 'Regulamin świadczenia usług', path: '/legal/regulamin' },
    { key: 'polityka-prywatnosci', label: 'Polityka prywatności', path: '/legal/polityka-prywatnosci' },
    { key: 'dpa', label: 'Umowa powierzenia danych (DPA)', path: '/legal/dpa' },
    { key: 'polityka-cookies', label: 'Polityka cookies', path: '/legal/polityka-cookies' },
    { key: 'subprocesorzy', label: 'Polityka subprocesorów', path: '/legal/subprocesorzy' },
    { key: 'zasady-platnosci', label: 'Zasady płatności i subskrypcji', path: '/legal/zasady-platnosci' },
    { key: 'reklamacje', label: 'Procedura reklamacyjna', path: '/legal/reklamacje' },
    { key: 'aup', label: 'Zasady Akceptowalnego Użytkowania (AUP)', path: '/legal/aup' },
  ]

  return (
    <div className="legal-page">
      <div className="legal-page__header">
        <h1 className="legal-page__title">Dokumenty prawne LoftDesk</h1>
        <p className="legal-page__meta">
          loftbau, Piotr Szalecki · NIP: 8732958793 · szalecki.p@gmail.com
        </p>
      </div>

      <div className="legal-index__list">
        {docs.map((doc) => (
          <a key={doc.key} href={doc.path} className="legal-index__item">
            <span>{doc.label}</span>
            <span className="legal-index__arrow">→</span>
          </a>
        ))}
      </div>
    </div>
  )
}
