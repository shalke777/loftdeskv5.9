import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { mcpOwnerRequest } from './McpConsentPage'
type Client = { client_id: string; display_name: string; enabled: boolean; allow_write: boolean }
export function PrivateMcpCard() {
  const [clients, setClients] = useState<Client[]>([])
  const [resource, setResource] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    try { const result = await mcpOwnerRequest({ action: 'list' }); setClients(result.clients); setResource(result.resource); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  async function revoke(clientId: string) {
    setBusy(true)
    try { await mcpOwnerRequest({ action: 'revoke', client_id: clientId }); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  return <Card><h3>ChatGPT — połączenie MCP</h3>
    {resource && <p>Adres serwera: <code style={{ overflowWrap: 'anywhere' }}>{resource}</code></p>}
    <p>Dodaj ten serwer jako prywatne połączenie w ChatGPT i wybierz logowanie OAuth. Następnie zaloguj się do LoftDesk i zatwierdź dostęp.</p>
    {clients.map(client => <div key={client.client_id}><p><strong>{client.display_name}</strong>: {client.enabled ? (client.allow_write ? 'odczyt i przygotowywanie szkiców' : 'tylko odczyt') : 'dostęp wyłączony'}</p>{client.enabled && <Button variant="secondary" loading={busy} onClick={() => void revoke(client.client_id)}>Odłącz dostęp</Button>}</div>)}
    {!clients.length && !error && <p>Serwer wymaga zarejestrowania prywatnego klienta OAuth przez administratora.</p>}
    {error && <p role="alert">{error}</p>}
  </Card>
}
