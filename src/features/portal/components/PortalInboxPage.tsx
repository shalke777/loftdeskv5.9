// =============================================================================
// FAZA 3 — Legacy portal inbox wycofany
// =============================================================================
// Portal tokenowy (client_tokens) został wycofany w ramach migracji Fazy 2/3.
// Nowy portal klienta działa przez zaproszenia emailowe → magic link → /client/project/:id
// Zarządzanie dostępem klienta odbywa się przez ProjectPortalCTA w widoku projektu.
// =============================================================================
import { Mail } from 'lucide-react'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Card } from '@/shared/ui/Card/Card'

export function PortalInboxPage() {
  return (
    <div className="portal-page">
      <PageHeader
        title="Portale klientów"
        subtitle="Zarządzanie legacy linkami portalu"
      />
      <Card>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <Mail size={40} style={{ margin: '0 auto 16px', display: 'block', color: 'var(--color-brand)' }} />
          <h3 style={{ marginBottom: 8 }}>Portal tokenowy wycofany</h3>
          <p style={{ color: '#6b7280', maxWidth: 480, margin: '0 auto 16px' }}>
            Linki tokenowe portalu zostały zastąpione zaproszeniami emailowymi.
            Klienci otrzymują dostęp przez magic link i logują się do dedykowanego portalu pod adresem <strong>/client/project/…</strong>
          </p>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>
            Zarządzanie dostępem klienta: otwórz projekt → sekcja „Portal klienta".
          </p>
        </div>
      </Card>
    </div>
  )
}
