import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { supabase } from '@/shared/lib/supabase'
import { netlifyFn } from '@/shared/lib/functions'

type Job = { id: string; kind: string; status: string; last_error: string | null; result: Record<string, unknown> | null }
type Status = { gmail: { account_email: string; last_sync_at: string | null } | null; ksef: {env:string;refresh_expires_at:string|null;last_error:string|null}|null; assistantConfigured: boolean; jobs: Job[] }
const kinds: Record<string,string> = { 'estimate.draft':'Przygotowanie oferty', 'note.add':'Zapis notatki', 'gmail.sync':'Pobieranie poczty', 'gmail.draft':'Szkic wiadomości' }
const labels: Record<string,string> = { queued:'W kolejce', running:'W trakcie', done:'Gotowe', failed:'Błąd', unknown:'Wymaga sprawdzenia wyniku' }
export function PrivateIntegrationsCard() {
  const [data,setData]=useState<Status|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const request=useCallback(async(action:string)=>{
    const session=await supabase?.auth.getSession()
    const token=session?.data.session?.access_token
    if(!token)throw new Error('Zaloguj się ponownie.')
    const response=await fetch(netlifyFn('private-integrations'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action})})
    const result=await response.json()
    if(!response.ok)throw new Error(result.error||'Nie udało się połączyć.')
    return result
  },[])
  const refresh=useCallback(async()=>{try{setData(await request('status'));setError('')}catch(e){setError(e instanceof Error?e.message:String(e))}},[request])
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer)},[refresh])
  async function run(action:string){setBusy(true);try{const result=await request(action);if(result.url){if(!result.url.startsWith('https://accounts.google.com/'))throw new Error('Nieprawidłowy adres logowania');window.location.assign(result.url)}else await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  return <Card>
    <h3>Asystent i Gmail</h3>
    <p>{data?.gmail ? `Połączone konto: ${data.gmail.account_email}` : 'Gmail nie jest połączony.'}</p>
    <p>{data?.assistantConfigured ? 'Połączenie asystenta jest skonfigurowane.' : 'Połączenie asystenta wymaga konfiguracji.'}</p>
    <p>{data?.ksef ? `KSeF (${data.ksef.env}): ${data.ksef.last_error || 'dostęp do synchronizacji zapisany'}` : 'Synchronizacja KSeF w tle wymaga zalogowania po konfiguracji serwera.'}</p>
    <div className="actions-row">
      <Button loading={busy} onClick={()=>void run('connect_gmail')}>Połącz Gmail</Button>
      <Button variant="secondary" disabled={!data?.gmail} loading={busy} onClick={()=>void run('sync_gmail')}>Pobierz wiadomości</Button>
      <Button variant="ghost" onClick={()=>void refresh()}>Odśwież</Button>
    </div>
    {error&&<p role="alert" style={{color:'var(--color-error)'}}>{error}</p>}
    {data?.gmail?.last_sync_at&&<p className="field__label">Ostatnia synchronizacja: {new Date(data.gmail.last_sync_at).toLocaleString('pl-PL')}</p>}
    <p className="field__label">Wiadomości z Favore i Oferteo są pomijane. Przygotowanie szkicu maila nie wysyła go do odbiorcy.</p>
    {data?.jobs?.length ? <table className="table"><thead><tr><th>Operacja</th><th>Status</th><th>Szczegóły</th></tr></thead><tbody>{data.jobs.map(job=><tr key={job.id}><td>{kinds[job.kind]||'Zadanie'}</td><td>{labels[job.status]||job.status}</td><td>{job.last_error||job.result?.number as string||''}</td></tr>)}</tbody></table> : <p>Brak operacji w kolejce.</p>}
  </Card>
}
