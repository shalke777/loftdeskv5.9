import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { AuthScreen } from '@/features/auth/components/AuthScreen'
import { supabase } from '@/shared/lib/supabase'
import { netlifyFn } from '@/shared/lib/functions'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'

type Details = { client_name: string; allow_write: boolean; redirect_url?: string }
export async function mcpOwnerRequest(body: Record<string, unknown>) {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) throw new Error('Zaloguj się do konta właściciela LoftDesk.')
  const response = await fetch(netlifyFn('mcp-consent'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Nie udało się sprawdzić połączenia.')
  return result
}
export function McpConsentPage() {
  const { user, loading } = useAuth()
  const [authorizationId] = useState(() => new URLSearchParams(window.location.search).get('authorization_id'))
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setBusy(true)
    try {
      if (!authorizationId) throw new Error('Brakuje żądania połączenia. Rozpocznij dodawanie LoftDesk w ChatGPT.')
      setDetails(await mcpOwnerRequest({ action: 'details', authorization_id: authorizationId }))
      setError('')
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }, [authorizationId])
  useEffect(() => { if (user) void load() }, [user, load])
  async function decide(action: 'approve' | 'deny') {
    setBusy(true)
    try {
      if (details?.redirect_url) {
        if (action === 'deny') { setDetails(null); setError('Powrót anulowany. Dostęp można odłączyć w ustawieniach LoftDesk.'); return }
        window.location.assign(details.redirect_url)
      } else {
        const result = await mcpOwnerRequest({ action, authorization_id: authorizationId })
        window.location.assign(result.redirect_url)
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  if (loading) return <p role="status">Sprawdzanie sesji…</p>
  if (!user) return <AuthScreen />
  return <main style={{ maxWidth: 620, margin: '48px auto', padding: 20 }}><Card>
    <h1>Połącz LoftDesk z ChatGPT</h1>
    {details && <>
      <p>Połączenie: <strong>{details.client_name}</strong></p>
      <p>Asystent uzyska dostęp do klientów, projektów, dokumentów, notatek i wiadomości zaimportowanych do LoftDesk.</p>
      {details.allow_write ? <p>Może też przygotowywać szkice ofert i wiadomości, zapisywać notatki oraz pobierać pocztę z połączonego Gmaila.</p> : <p>To połączenie pozwala wyłącznie odczytywać dane.</p>}
      <p>Dostęp dotyczy Twojej firmy. Możesz go odłączyć w ustawieniach LoftDesk.</p>
      {details.redirect_url && <p>Zgoda została już zapisana wcześniej. Kontynuuj, aby wrócić do ChatGPT.</p>}
      <div className="actions-row"><Button loading={busy} onClick={() => void decide('approve')}>{details.redirect_url ? 'Wróć do ChatGPT' : 'Zezwól na dostęp'}</Button><Button variant="secondary" disabled={busy} onClick={() => void decide('deny')}>Anuluj</Button></div>
    </>}
    {error && <p role="alert">{error}</p>}
    {!details && <Button loading={busy} onClick={() => void load()}>Sprawdź połączenie ponownie</Button>}
  </Card></main>
}
