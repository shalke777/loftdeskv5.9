
import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { isDemoMode, hasSupabaseConfig } from '@/shared/lib/supabase'
import { getFrontendEnvStatus } from '@/shared/lib/env'
import { useAuth } from '@/features/auth/hooks/useAuth'

export function AuthBridgeCard() {
  const { user } = useAuth()
  const env = getFrontendEnvStatus()

  return (
    <Card>
      <h3>Auth / Supabase bridge</h3>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        <div className="list-row">
          <div>
            <strong>Tryb danych</strong>
            <div className="muted">Aplikacja może działać w trybie demo albo Supabase-first.</div>
          </div>
          <Badge variant={isDemoMode ? 'warning' : 'success'}>{isDemoMode ? 'demo' : 'supabase-first'}</Badge>
        </div>
        <div className="list-row">
          <div>
            <strong>ENV Supabase</strong>
            <div className="muted">Sprawdzenie URL i anon key po stronie frontu.</div>
          </div>
          <Badge variant={hasSupabaseConfig ? 'success' : 'danger'}>{hasSupabaseConfig ? 'ok' : 'brak'}</Badge>
        </div>
        <div>
          <p className="field__label">company_id: {user?.companyId ?? '—'}</p>
          <p className="field__label">rola: {user?.role ?? '—'}</p>
          <p className="field__label">VITE_PUBLIC_BASE_URL: {env.publicBaseUrl ?? 'nie ustawiono'}</p>
        </div>
      </div>
    </Card>
  )
}
