import { useMemo, useState } from 'react'
import { ExternalLink, Share2 } from 'lucide-react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCreatePortalToken, useDeactivatePortalToken, usePortalTokens } from '@/features/portal/hooks/usePortalData'
import type { Estimate } from '@/entities/estimate/model'
import { STATUS_META } from '@/shared/lib/constants'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Input } from '@/shared/ui/Input/Input'
import { useToast } from '@/shared/hooks/useToast'

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Fallback for mobile browsers without clipboard API
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

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
              setClientName('')
              // Copy silently — never let clipboard failure mask the success
              try { await copyText(fullUrl) } catch { /* clipboard unavailable — shows URL in list */ }
              toast.success('Link portalu wygenerowany', 'Adres skopiowany do schowka (jeśli dostępny).')
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
                  <Button variant="secondary" onClick={async () => { try { await copyText(fullUrl) } catch { /* ignore */ } toast.info('Skopiowano link portalu') }}>Kopiuj link</Button>
                  {typeof navigator !== 'undefined' && 'share' in navigator ? (
                    <Button variant="secondary" icon={<Share2 size={16} />} onClick={() => navigator.share({ title: `Kosztorys ${estimate.number}`, url: fullUrl }).catch(() => {})}>
                      Wyślij
                    </Button>
                  ) : null}
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
