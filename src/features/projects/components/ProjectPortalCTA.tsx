// =============================================================================
// ProjectPortalCTA — Operator zarządza portalem klienta dla projektu
// =============================================================================
// Użycie: wstawić w ProjectDetail lub podobny komponent
//
// Stany:
//   - loading
//   - no_token    → CTA „Uruchom portal klienta"
//   - has_token   → link + „Kopiuj link" + „Unieważnij"
//   - generating  → spinner podczas generowania
//   - copied      → chwilowe potwierdzenie skopiowania

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import {
  createProjectPortalToken,
  listProjectPortalTokens,
  revokeProjectPortalToken,
} from '@/features/portal/api/portal-project.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/shared/lib/supabase'

function buildPortalUrl(rawToken: string) {
  return `${window.location.origin}/portal/${rawToken}`
}

interface Props {
  projectId:    string
  projectName?: string
}

export function ProjectPortalCTA({ projectId, projectName }: Props) {
  const companyId    = useCompanyId()
  const { user }     = useAuth()
  const queryClient  = useQueryClient()
  const [newRawToken, setNewRawToken] = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)

  // Pobierz aktywne tokeny dla projektu
  const { data: tokens, isLoading } = useQuery({
    queryKey: ['portal-tokens', projectId],
    queryFn:  () => listProjectPortalTokens(projectId),
    staleTime: 30_000,
  })

  // Aktywny token (jeśli jest)
  const activeToken = tokens?.find(t => t.active && !t.revoked_at && (!t.expires_at || new Date(t.expires_at) > new Date()))

  // Generowanie nowego tokenu
  const generate = useMutation({
    mutationFn: () =>
      createProjectPortalToken({
        company_id:  companyId,
        project_id:  projectId,
        client_name: undefined,
      }),
    onSuccess: (result) => {
      if (result) {
        setNewRawToken(result.raw_token)
        queryClient.invalidateQueries({ queryKey: ['portal-tokens', projectId] })
      }
    },
  })

  // Unieważnienie tokenu
  const revoke = useMutation({
    mutationFn: async (tokenId: string) => {
      if (!supabase) return false
      const { data } = await supabase.auth.getSession()
      const jwt = data.session?.access_token
      if (!jwt) return false
      return revokeProjectPortalToken(tokenId, jwt)
    },
    onSuccess: () => {
      setNewRawToken(null)
      queryClient.invalidateQueries({ queryKey: ['portal-tokens', projectId] })
    },
  })

  function copyLink(rawToken: string) {
    const url = buildPortalUrl(rawToken)
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (isLoading) return <Spinner />

  // ── Nowo wygenerowany token — pokaż RAW TOKEN (jedyna szansa) ────────────
  if (newRawToken) {
    const url = buildPortalUrl(newRawToken)
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Portal klienta gotowy</h3>
          <Badge variant="success">Aktywny</Badge>
        </div>
        <div
          style={{
            background:   '#f0fdf4',
            border:       '1px solid #86efac',
            borderRadius: 8,
            padding:      '12px 16px',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginBottom: 6 }}>
            ⚠️ Skopiuj link TERAZ — nie będzie widoczny po odświeżeniu strony
          </div>
          <div
            style={{
              fontFamily:   'monospace',
              fontSize:     12,
              color:        '#166534',
              wordBreak:    'break-all',
              userSelect:   'all',
            }}
          >
            {url}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={() => copyLink(newRawToken)}>
            {copied ? '✓ Skopiowano!' : 'Kopiuj link'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              window.open(url, '_blank', 'noopener')
            }}
          >
            Podgląd portalu ↗
          </Button>
          <Button variant="ghost" onClick={() => setNewRawToken(null)}>
            Zamknij
          </Button>
        </div>
      </Card>
    )
  }

  // ── Aktywny token istnieje ───────────────────────────────────────────────
  if (activeToken) {
    // Nie mamy raw token (jest zahashowany w DB) — link nie jest dostępny po odświeżeniu.
    // Można go wysłać do klienta przez przycisk email (TODO Etap 3) lub wygenerować nowy.
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Portal klienta</h3>
            <p style={{ fontSize: 13, color: '#718096', marginTop: 4 }}>
              {activeToken.client_name ? `Dostęp dla: ${activeToken.client_name}` : 'Link dostępu aktywny'}
            </p>
          </div>
          <Badge variant="success">Aktywny</Badge>
        </div>

        {activeToken.expires_at && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
            Wygasa: {new Date(activeToken.expires_at).toLocaleString('pl-PL')}
          </p>
        )}

        <div
          style={{
            background:   '#fef9c3',
            border:       '1px solid #fde047',
            borderRadius: 6,
            padding:      '10px 12px',
            fontSize:     12,
            color:        '#713f12',
            marginBottom: 12,
          }}
        >
          Link do portalu nie jest wyświetlany ponownie ze względów bezpieczeństwa.
          Jeśli klient potrzebuje nowego linku — wygeneruj nowy (stary zostanie unieważniony).
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Generowanie…' : 'Generuj nowy link'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => revoke.mutate(activeToken.id)}
            disabled={revoke.isPending}
          >
            {revoke.isPending ? 'Unieważnianie…' : 'Unieważnij dostęp'}
          </Button>
        </div>
      </Card>
    )
  }

  // ── Brak aktywnego tokenu ────────────────────────────────────────────────
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Portal klienta</h3>
          <p style={{ fontSize: 13, color: '#718096', marginTop: 4 }}>
            Udostępnij projekt klientowi przez bezpieczny link
          </p>
        </div>
        <Badge variant="default">Nieaktywny</Badge>
      </div>

      <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6, marginBottom: 16 }}>
        Klient otrzyma dostęp do aktualizacji projektu, wiadomości, dokumentów i listy kosztów do akceptacji.
        Nie zobaczy kosztów wewnętrznych, marży ani notatek firmowych.
      </p>

      <Button
        onClick={() => generate.mutate()}
        disabled={generate.isPending}
      >
        {generate.isPending ? 'Generowanie linku…' : '🔗 Uruchom portal klienta'}
      </Button>
    </Card>
  )
}
