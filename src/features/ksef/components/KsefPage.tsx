import { useState, useEffect } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Select } from '@/shared/ui/Select/Select'
import { useNavigate } from '@tanstack/react-router'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { formatCurrency } from '@/shared/lib/formatters'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { useKsefSession } from '@/features/ksef/hooks/useKsefSession'
import { useKsefQueue } from '@/features/ksef/hooks/useKsefQueue'
import { useKsefReceive } from '@/features/ksef/hooks/useKsefReceive'
import { useKsefHistory } from '@/features/ksef/hooks/useKsefHistory'
import { useKsefUpo } from '@/features/ksef/hooks/useKsefUpo'

export function KsefPage() {
  const navigate = useNavigate()
  const { profile } = useSettings()
  const enabled = useFeatureAccess('ksef')

  const { session, loading: sessionLoading, error: sessionError, init: initSession, close: closeSession, initDemo } = useKsefSession()
  const { pending, processing, lastResult, processQueue } = useKsefQueue()
  const { docs, loading: receiving, error: receiveError, newCount, receive } = useKsefReceive()
  const { history, refresh: refreshHistory, clear: clearHistory } = useKsefHistory()
  const upo = useKsefUpo()

  const [nipInput, setNipInput] = useState<string>('')
  const [tokenInput, setTokenInput] = useState<string>('')
  const [envInput, setEnvInput] = useState<'demo' | 'test' | 'prod'>('demo')

  // Pre-fill inputs once profile loads (profile is undefined on first render)
  useEffect(() => {
    if (!profile) return
    const p = profile as Record<string, unknown>
    if (!nipInput) setNipInput((p.ksef_nip as string) || (p.nip as string) || '')
    if (!tokenInput) setTokenInput((p.ksef_token as string) || '')
    setEnvInput(((p.ksef_env as string) === 'prod' ? 'prod' : (p.ksef_env as string) === 'test' ? 'test' : 'demo') as 'demo' | 'test' | 'prod')
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) {
    return (
      <AccessNotice
        title="KSeF w planie Pro/Business"
        description="Integracja z Krajowym Systemem e-Faktur wymaga planu Pro lub Business."
        actionLabel="Przejdź do billing"
        onAction={() => navigate({ to: '/billing' })}
      />
    )
  }

  async function handleInitSession(e: React.FormEvent) {
    e.preventDefault()
    if (!nipInput || !tokenInput) return
    try {
      await initSession(nipInput.trim(), tokenInput.trim(), envInput)
    } catch { /* error shown via sessionError */ }
  }

  function handleInitDemoSession() {
    initDemo(nipInput || '0000000000', envInput)
  }

  async function handleProcessQueue() {
    if (!session) return
    await processQueue(session, session.isDemo)
    refreshHistory()
  }

  async function handleReceive() {
    if (!session) return
    await receive(session.sessionToken, session.env, session.isDemo)
    refreshHistory()
  }

  function handleShowUpo(ksefRef: string, invoiceNumber: string) {
    if (!session) return
    upo.fetchAndShow(ksefRef, invoiceNumber, session.sessionToken, session.env, session.isDemo)
  }

  function ksefStatusBadge(s: string | null) {
    if (s === 'ksef_sent') return <Badge variant="success">wysłano</Badge>
    if (s === 'ksef_error') return <Badge variant="danger">błąd</Badge>
    return <Badge variant="warning">oczekuje</Badge>
  }

  return (
    <div>
      <PageHeader title="KSeF" subtitle="Krajowy System e-Faktur · FA(2) · MF API" />
      <div className="grid-2">

        {/* ── SESJA ─────────────────────────────────────── */}
        <Card>
          <h3 style={{ marginBottom: 16 }}>Sesja KSeF</h3>
          {session ? (
            <div>
              {/* Status banner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: session.isDemo ? '#fffbeb' : '#f0fdf4', border: `1px solid ${session.isDemo ? '#fbbf24' : '#86efac'}`, borderRadius: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 22 }}>{session.isDemo ? '🔵' : '🟢'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {session.isDemo ? 'Tryb demo — dane nie są wysyłane do MF' : 'Sesja aktywna'}
                  </div>
                  <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>
                    Uruchomiona: {new Date(session.startedAt).toLocaleString('pl-PL')}
                  </div>
                </div>
                <Badge variant={session.env === 'prod' ? 'danger' : session.env === 'demo' ? 'info' : 'warning'}>
                  {session.env === 'prod' ? 'PRODUKCJA' : session.env === 'demo' ? 'DEMO' : 'TEST'}
                </Badge>
              </div>

              {/* Session details */}
              <div style={{ borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 16 }}>
                {[
                  { label: 'NIP', value: <strong>{session.nip}</strong> },
                  { label: 'Serwer', value: session.env === 'prod' ? 'ksef.mf.gov.pl' : session.env === 'test' ? 'ksef-test.mf.gov.pl' : 'ksef-demo.mf.gov.pl' },
                  { label: 'Ref. sesji', value: <code style={{ fontSize: 11, color: '#64748b', background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>{session.referenceNumber || session.sessionRef}</code> },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                    <div style={{ padding: '10px 14px', fontSize: 12, color: '#718096', fontWeight: 500, background: '#f8fafc' }}>{row.label}</div>
                    <div style={{ padding: '10px 14px', fontSize: 13 }}>{row.value}</div>
                  </div>
                ))}
              </div>

              <Button variant="secondary" onClick={closeSession} loading={sessionLoading}>Zakończ sesję</Button>
            </div>
          ) : (
            <form onSubmit={handleInitSession}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Input
                  label="NIP firmy"
                  value={nipInput}
                  onChange={(e) => setNipInput(e.target.value)}
                  placeholder="1234567890"
                  maxLength={10}
                />
                <Input
                  label="Token autoryzacyjny KSeF"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Token z panelu podatnika / PUE MF"
                />
                <Select
                  label="Środowisko"
                  value={envInput}
                  onChange={(e) => setEnvInput(e.target.value as 'demo' | 'test' | 'prod')}
                  options={[
                    { value: 'demo', label: 'Demo (ksef-demo.mf.gov.pl)' },
                    { value: 'test', label: 'Testowe (ksef-test.mf.gov.pl)' },
                    { value: 'prod', label: 'Produkcyjne (ksef.mf.gov.pl)' },
                  ]}
                />
              </div>
              {sessionError && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fc8181', borderRadius: 8, fontSize: 13, color: '#c0392b' }}>
                  <strong>Błąd:</strong> {sessionError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Button type="submit" loading={sessionLoading} disabled={!nipInput || !tokenInput}>
                  Inicjuj sesję
                </Button>
                <Button type="button" variant="ghost" onClick={handleInitDemoSession}>
                  Tryb demo
                </Button>
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#718096', lineHeight: 1.6 }}>
                💡 NIP i token uzupełnisz w <strong>Ustawienia → Dane wykonawcy → KSeF</strong>.<br />
                Tryb demo działa bez połączenia z MF.
              </div>
            </form>
          )}
        </Card>

        {/* ── KOLEJKA ───────────────────────────────────── */}
        <Card>
          <div className="toolbar">
            <h3>Kolejka wysyłek ({pending.length})</h3>
            {session && pending.length > 0 && (
              <Button onClick={handleProcessQueue} loading={processing} disabled={processing}>
                {processing ? 'Wysyłanie…' : 'Wyślij kolejkę'}
              </Button>
            )}
          </div>
          {!session && (
            <p style={{ color: '#888', fontSize: 14 }}>Wymagana aktywna sesja KSeF.</p>
          )}
          {pending.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>
              Brak faktur oczekujących na wysyłkę.<br />
              <span style={{ fontSize: 12 }}>Użyj „Wyślij do KSeF" w szczegółach faktury.</span>
            </p>
          ) : (
            <table className="table" style={{ fontSize: 13, width: '100%' }}>
              <thead>
                <tr><th>Numer</th><th>Brutto</th><th>Status</th></tr>
              </thead>
              <tbody>
                {pending.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.number}</td>
                    <td className="num">{formatCurrency(inv.total_gross)}</td>
                    <td>{ksefStatusBadge(inv.ksef_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {lastResult && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: lastResult.errors > 0 ? '#fff5f5' : '#f0fff4', borderRadius: 8, fontSize: 13 }}>
              <strong>Wynik:</strong> {lastResult.sent} wysłanych, {lastResult.errors} błędów z {lastResult.total}
              {lastResult.items.filter((i) => i.status === 'sent' && i.ksefRef).map((i) => (
                <div key={i.invoice.id} style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1, fontSize: 12 }}>{i.invoice.number}</span>
                  <Button
                    variant="ghost"
                    onClick={() => handleShowUpo(i.ksefRef!, i.invoice.number)}
                    loading={upo.loading}
                  >
                    UPO
                  </Button>
                </div>
              ))}
              {lastResult.items.filter((i) => i.status === 'error').map((i) => (
                <div key={i.invoice.id} style={{ color: '#c0392b', marginTop: 4 }}>
                  {i.invoice.number}: {i.error}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── ODBIÓR ───────────────────────────────────── */}
        <Card>
          <div className="toolbar">
            <h3>Odbiór dokumentów ({docs.length})</h3>
            {session && (
              <Button variant="secondary" onClick={handleReceive} loading={receiving}>
                Odbierz z KSeF
              </Button>
            )}
          </div>
          {!session && <p style={{ color: '#888', fontSize: 14 }}>Wymagana aktywna sesja KSeF.</p>}
          {receiveError && <p style={{ color: '#c0392b', fontSize: 13 }}>Błąd: {receiveError}</p>}
          {newCount !== null && newCount >= 0 && (
            <p style={{ fontSize: 13, color: '#27ae60', marginBottom: 8 }}>
              Pobrano {newCount} nowych dokumentów.
            </p>
          )}
          {docs.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>
              Brak odebranych dokumentów. Kliknij „Odbierz z KSeF" aby pobrać ostatnie 30 dni.
            </p>
          ) : (
            <table className="table" style={{ fontSize: 12, width: '100%' }}>
              <thead>
                <tr><th>Nr ref. KSeF</th><th>Nr faktury</th><th>NIP wystawcy</th><th>Data</th></tr>
              </thead>
              <tbody>
                {docs.slice(0, 30).map((doc) => (
                  <tr key={doc.ksefRef}>
                    <td><code style={{ fontSize: 11 }}>{doc.ksefRef.slice(0, 22)}…</code></td>
                    <td>{doc.invoiceNumber}</td>
                    <td>{doc.issuerNip}</td>
                    <td>{doc.issueDate ? doc.issueDate.slice(0, 10) : '—'}</td>
                  </tr>
                ))}
                {docs.length > 30 && (
                  <tr><td colSpan={4} style={{ color: '#888', textAlign: 'center', fontSize: 12 }}>… i {docs.length - 30} więcej</td></tr>
                )}
              </tbody>
            </table>
          )}
        </Card>

        {/* ── HISTORIA ─────────────────────────────────── */}
        <Card>
          <div className="toolbar">
            <h3>Historia operacji ({history.length})</h3>
            {history.length > 0 && (
              <Button variant="ghost" onClick={clearHistory}>Wyczyść</Button>
            )}
          </div>
          {history.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>Brak zarejestrowanych operacji KSeF.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {history.slice(0, 60).map((entry) => (
                <li key={entry.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#aaa', fontSize: 11, minWidth: 130 }}>
                    {new Date(entry.timestamp).toLocaleString('pl-PL')}
                  </span>
                  <Badge variant={entry.status === 'success' ? 'success' : 'danger'}>{entry.action}</Badge>
                  <span style={{ flex: 1 }}>{entry.invoiceNumber}</span>
                  {entry.ksefRef && (
                    <code style={{ fontSize: 11, color: '#888' }}>{entry.ksefRef.slice(0, 18)}…</code>
                  )}
                  {entry.ksefRef && entry.status === 'success' && session && (
                    <Button
                      variant="ghost"
                      onClick={() => handleShowUpo(entry.ksefRef!, entry.invoiceNumber)}
                      loading={upo.loading}
                    >
                      UPO
                    </Button>
                  )}
                  {entry.error && <span style={{ color: '#c0392b', fontSize: 12 }}>{entry.error}</span>}
                </li>
              ))}
              {history.length > 60 && (
                <li style={{ color: '#888', fontSize: 12, padding: '4px 0' }}>… i {history.length - 60} więcej</li>
              )}
            </ul>
          )}
        </Card>

      </div>

      {upo.open && upo.upoHtml && (
        <DocumentPreviewModal
          open={upo.open}
          onClose={upo.close}
          title="UPO · Urzędowe Poświadczenie Odbioru"
          tabs={[{ key: 'upo', label: 'UPO', type: 'html', content: upo.upoHtml }]}
        />
      )}
      {upo.error && (
        <p style={{ position: 'fixed', bottom: 24, right: 24, background: '#fff5f5', border: '1px solid #fc8181', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#c0392b', zIndex: 9999 }}>
          Błąd UPO: {upo.error}
        </p>
      )}
    </div>
  )
}


