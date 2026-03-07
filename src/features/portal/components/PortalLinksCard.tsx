import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCreatePortalToken, useDeactivatePortalToken, usePortalTokens } from '@/features/portal/hooks/usePortalData'
import type { Estimate } from '@/entities/estimate/model'
import { STATUS_META } from '@/shared/lib/constants'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Input } from '@/shared/ui/Input/Input'
import { useToast } from '@/shared/hooks/useToast'

export function PortalLinksCard({ estimate }: { estimate: Estimate }) {
  const { user } = useAuth()
  const toast = useToast()
  const companyId = user?.companyId ?? ''
  const tokens = usePortalTokens(companyId)
  const createToken = useCreatePortalToken(companyId)
  const deactivateToken = useDeactivatePortalToken(companyId)
  const [clientName, setClientName] = useState('')

  const estimateTokens = useMemo(() => (tokens.data ?? []).filter((item) => item.estimate_id === estimate.id), [tokens.data, estimate.id])
  const statusMeta = STATUS_META[estimate.status]

  return (
    <Card>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div>
          <h3>Portal klienta</h3>
          <p className="field__label">{estimate.number} · {estimate.name}</p>
        </div>
        <Badge variant={(statusMeta?.tone as any) ?? 'default'}>{statusMeta?.label ?? estimate.status}</Badge>
      </div>

      <p>Portal służy do wysłania konkretnego kosztorysu klientowi, zebrania akceptacji i uporządkowania komentarzy do jednej sprawy.</p>

      <div className="actions-row" style={{ marginTop: 12, marginBottom: 12, gap: 8 }}>
        <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Nazwa klienta do portalu" />
        <Button
          disabled={!user}
          loading={createToken.isPending}
          onClick={async () => {
            try {
              const created = await createToken.mutateAsync({
                estimateId: estimate.id,
                userId: user?.id ?? '',
                clientName: clientName || 'Klient',
              })
              const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${created.url}` : created.url
              await navigator.clipboard?.writeText(fullUrl)
              toast.success('Link portalu wygenerowany', 'Adres został skopiowany do schowka.')
              setClientName('')
            } catch (err) {
              toast.error('Błąd generowania linku', err instanceof Error ? err.message : String(err))
            }
          }}
        >
          Generuj link
        </Button>
        {/* Nowy przycisk wysyłania e-mailem */}
        <Button
          variant="secondary"
          disabled={!user || !estimateTokens.length}
          onClick={() => {
            const token = estimateTokens[0]
            const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${token.url}` : token.url
            const subject = encodeURIComponent(`Dostęp do kosztorysu: ${estimate.number} – ${estimate.name}`)
            const body = encodeURIComponent(`Dzień dobry,%0D%0A%0D%0Aotrzymujesz dostęp do kosztorysu w portalu klienta:%0D%0A${fullUrl}%0D%0A%0D%0APozdrawiam,%0D%0A${user?.fullName || ''}`)
            window.location.href = `mailto:?subject=${subject}&body=${body}`
          }}
        >
          Wyślij link e-mailem
        </Button>
      </div>

      {!estimateTokens.length ? <p className="field__label">Brak aktywnych linków dla tego kosztorysu.</p> : null}
      <div style={{ display: 'grid', gap: 10 }}>
        {estimateTokens.map((item) => {
          const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${item.url}` : item.url
          return (
            <div key={item.id} className="card" style={{ padding: 12 }}>
              <div className="toolbar" style={{ marginBottom: 8 }}>
                <div>
                  <strong>{item.client_name}</strong>
                  <div className="field__label">Wygasa: {new Date(item.expires_at).toLocaleDateString('pl-PL')}</div>
                </div>
                <Badge variant={item.active ? 'success' : 'danger'}>{item.active ? 'aktywny' : 'wyłączony'}</Badge>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{fullUrl}</code>
                <div className="actions-row">
                  <Button variant="secondary" onClick={async () => { await navigator.clipboard?.writeText(fullUrl); toast.info('Skopiowano link portalu') }}>Kopiuj link</Button>
                  <a href={fullUrl} target="_blank" rel="noreferrer"><Button variant="secondary" icon={<ExternalLink size={16} />}>Otwórz link</Button></a>
                  {item.active ? (
                    <Button variant="ghost" loading={deactivateToken.isPending && deactivateToken.variables === item.id} onClick={() => deactivateToken.mutate(item.id)}>
                      Dezaktywuj
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
