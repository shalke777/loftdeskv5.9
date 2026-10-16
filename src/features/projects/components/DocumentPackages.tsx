import { useEffect, useRef, useState } from 'react'
import { supabase, isDemoMode } from '@/shared/lib/supabase'
import { netlifyFn } from '@/shared/lib/functions'
import { Button } from '@/shared/ui/Button/Button'

type Package = { id: string; name: string; created_at: string; documents: { number: string; filename: string }[] }
async function request(body: Record<string, unknown>) {
  if (!supabase || isDemoMode) throw new Error('Pakiety PDF są dostępne po zalogowaniu do konta firmowego.')
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Brak aktywnej sesji.')
  const response = await fetch(netlifyFn('document-packages'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Nie udało się wykonać operacji.')
  return result
}

export function DocumentPackages({ projectId }: { projectId: string }) {
  const [packages, setPackages] = useState<Package[]>([])
  const [selected, setSelected] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  // Retained after a network error: retrying cannot send a duplicate email.
  const sendKey = useRef<{ intent: string; key: string } | null>(null)
  useEffect(() => {
    let active = true
    setPackages([]); setSelected(''); setNotice(''); sendKey.current = null
    if (!isDemoMode) request({ action: 'list', project_id: projectId }).then(r => {
      if (active) { setPackages(r.packages); setSelected(r.packages[0]?.id || '') }
    }).catch(e => { if (active) setNotice(e.message) })
    return () => { active = false }
  }, [projectId])
  async function prepare() {
    setBusy(true); setNotice('Przygotowywanie PDF-ów…')
    try {
      const p = await request({ action: 'prepare', project_id: projectId }) as Package
      setPackages(previous => [p, ...previous.filter(x => x.id !== p.id)]); setSelected(p.id)
      setNotice('Pakiet PDF zapisany. Możesz go wysłać tutaj lub poleceniem w czacie.')
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Nie udało się przygotować pakietu.') }
    finally { setBusy(false) }
  }
  async function send() {
    const intent = `${selected}/${email.trim().toLowerCase()}`
    if (sendKey.current?.intent !== intent) sendKey.current = { intent, key: crypto.randomUUID() }
    const key = sendKey.current!.key
    setBusy(true); setNotice('Wysyłanie…')
    try {
      const result = await request({ action: 'send', project_id: projectId, package_id: selected, to: email.trim(), idempotency_key: key })
      setNotice(result.status === 'sent' && result.provider_id ? `Pakiet przekazany do wysyłki na ${result.to}.` : result.error || 'Wysyłka trwa lub wymaga sprawdzenia. Nie wysyłaj ponownie inną metodą.')
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Nie udało się potwierdzić wysyłki.') }
    finally { setBusy(false) }
  }
  const current = packages.find(p => p.id === selected)
  return <section aria-label="Pakiety PDF" style={{ margin: '16px 0', padding: 16, border: '1px solid var(--color-border)', borderRadius: 10 }}>
    <h4 style={{ margin: '0 0 8px' }}>Pakiety PDF</h4>
    <p style={{ fontSize: 13 }}>Zapisz aktualną wycenę i umowę jako komplet załączników do wysyłki. Wysyłka nie zmienia statusu dokumentów.</p>
    <Button size="sm" variant="secondary" disabled={busy || isDemoMode} onClick={prepare}>Przygotuj aktualny pakiet</Button>
    {packages.length > 0 && <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      <label>Pakiet<select aria-label="Zapisany pakiet PDF" value={selected} disabled={busy} onChange={e => setSelected(e.target.value)} style={{ display: 'block', width: '100%' }}>
        {packages.map(p => <option key={p.id} value={p.id}>{new Date(p.created_at).toLocaleString('pl-PL')} — {p.documents.map(d => d.number).join(', ')}</option>)}
      </select></label>
      <ul>{current?.documents.map(d => <li key={d.filename}>{d.filename}</li>)}</ul>
      <label>Adres odbiorcy<input type="email" aria-label="Odbiorca pakietu PDF" value={email} disabled={busy} onChange={e => setEmail(e.target.value)} placeholder="Adres e-mail" style={{ display: 'block', width: '100%' }} /></label>
      <Button size="sm" disabled={busy || !selected || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={send}>Wyślij pakiet PDF</Button>
    </div>}
    {notice && <p role="status" style={{ fontSize: 13 }}>{notice}</p>}
  </section>
}
