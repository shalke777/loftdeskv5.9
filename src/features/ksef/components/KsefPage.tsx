import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/shared/hooks/useToast'
import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Select } from '@/shared/ui/Select/Select'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useNavigate } from '@tanstack/react-router'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { formatCurrency } from '@/shared/lib/formatters'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { useKsefSession } from '@/features/ksef/hooks/useKsefSession'
import { useKsefQueue, type QueueItemResult } from '@/features/ksef/hooks/useKsefQueue'
import { useKsefReceive } from '@/features/ksef/hooks/useKsefReceive'
import { useKsefHistory } from '@/features/ksef/hooks/useKsefHistory'
import { useKsefUpo } from '@/features/ksef/hooks/useKsefUpo'
import { type KsefEnv } from '@/services/ksef/ksef.service'

// ── Status Badge Component ─────────────────────────────────
function KsefStatusBadge({ status, isMock }: { status: string | null; isMock?: boolean }) {
  const configs: Record<string, { variant: 'success' | 'danger' | 'warning' | 'default'; label: string; icon: string }> = {
    ksef_sent:    { variant: 'success', label: 'Wysłano',   icon: '✅' },
    ksef_pending: { variant: 'warning', label: 'Oczekuje',  icon: '⏳' },
    ksef_error:   { variant: 'danger',  label: 'Błąd',      icon: '❌' },
    ksef_queued:  { variant: 'default', label: 'W kolejce',  icon: '📋' },
  }
  const cfg = configs[status ?? ''] ?? configs.ksef_pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Badge variant={cfg.variant}>{`${cfg.icon} ${cfg.label}`}</Badge>
      {isMock && <span style={{ fontSize: 10, color: 'var(--color-accent)', fontWeight: 700 }}>[MOCK]</span>}
    </span>
  )
}

// ── Send Modal Component ─────────────────────────────────
type SendModalStep = 'confirm' | 'sending' | 'success' | 'error'

interface SendModalProps {
  open: boolean
  onClose: () => void
  pendingCount: number
  isDemo: boolean
  processing: boolean
  onSend: () => Promise<void>
  result: { sent: number; errors: number; total: number; items: QueueItemResult[] } | null
  onShowUpo: (ksefRef: string, invoiceNumber: string) => void
}

function KsefSendModal({ open, onClose, pendingCount, isDemo, processing, onSend, result, onShowUpo }: SendModalProps) {
  const [step, setStep] = useState<SendModalStep>('confirm')

  useEffect(() => {
    if (open) setStep('confirm')
  }, [open])

  useEffect(() => {
    if (processing) setStep('sending')
    else if (result) {
      if (result.total === 0) setStep('success')
      else setStep(result.errors > 0 && result.sent === 0 ? 'error' : 'success')
    }
  }, [processing, result])

  if (!open) return null

  const handleSend = async () => {
    setStep('sending')
    try {
      await onSend()
    } catch {
      if (!result) setStep('error')
    }
  }

  return (
    <Modal open={open} onClose={step === 'sending' ? () => {} : onClose} title="Wysyłka faktur do KSeF">
      {step === 'confirm' && (
        <div>
          {isDemo && (
            <div style={{ padding: '14px 16px', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.30)', borderRadius: 8, marginBottom: 16 }}>
              <strong>🔵 Tryb demo</strong>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                Dane nie będą wysłane do Ministerstwa Finansów — symulacja lokalna.
              </p>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 15 }}>
              <strong>{pendingCount}</strong> {pendingCount === 1 ? 'faktura oczekuje' : pendingCount <= 4 ? 'faktury oczekują' : 'faktur oczekuje'} na wysyłkę do KSeF.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button onClick={handleSend}>
              {pendingCount === 1 ? 'Wyślij fakturę' : pendingCount <= 4 ? `Wyślij ${pendingCount} faktury` : `Wyślij ${pendingCount} faktur`}
            </Button>
            <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          </div>
        </div>
      )}

      {step === 'sending' && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Spinner />
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>
            Wysyłam faktury do KSeF…<br />
            <span style={{ fontSize: 12 }}>Nie zamykaj okna.</span>
          </p>
        </div>
      )}

      {step === 'success' && result && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 48 }}>✅</span>
            <h3 style={{ marginTop: 8 }}>Wysyłka zakończona</h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
              {result.sent} wysłanych, {result.errors} błędów z {result.total}
            </p>
          </div>

          {result.items.filter((i) => i.status === 'sent' && i.ksefRef).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8 }}>Wysłane faktury:</h4>
              {result.items.filter((i) => i.status === 'sent').map((i) => (
                <div key={i.invoice.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '8px 12px', background: 'rgba(26,92,50,0.12)', borderRadius: 8 }}>
                  <KsefStatusBadge status="ksef_sent" isMock={i.ksefRef?.startsWith('MOCK-') || i.ksefRef?.startsWith('DEMO-')} />
                  <span style={{ flex: 1, fontSize: 13 }}>{i.invoice.number}</span>
                  <code style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{i.ksefRef?.slice(0, 22)}…</code>
                  {i.ksefRef && (
                    <Button variant="ghost" onClick={() => onShowUpo(i.ksefRef!, i.invoice.number ?? '')}>UPO</Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {result.items.filter((i) => i.status === 'error').length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--color-error)' }}>Błędy:</h4>
              {result.items.filter((i) => i.status === 'error').map((i) => (
                <div key={i.invoice.id} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.12)', borderRadius: 8, marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>{i.invoice.number}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-error)' }}>{i.error}</p>
                </div>
              ))}
            </div>
          )}

          <Button onClick={onClose}>Zamknij</Button>
        </div>
      )}

      {step === 'error' && result && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 48 }}>❌</span>
            <h3 style={{ marginTop: 8 }}>Błąd wysyłki</h3>
          </div>
          {result.items.filter((i) => i.status === 'error').map((i) => (
            <div key={i.invoice.id} style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.12)', borderRadius: 8, marginBottom: 8 }}>
              <strong>{i.invoice.number}</strong>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-error)' }}>{i.error}</p>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <Button variant="secondary" onClick={onClose}>Zamknij</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Main KSeF Page ─────────────────────────────────────────
export function KsefPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useSettings()
  const enabled = useFeatureAccess('ksef')

  const { session, loading: sessionLoading, error: sessionError, init: initSession, close: closeSession, initDemo } = useKsefSession()
  const { pending, processing, lastResult, processQueue } = useKsefQueue()
  const { docs, loading: receiving, error: receiveError, newCount, receive } = useKsefReceive()
  const { history, refresh: refreshHistory, clear: clearHistory } = useKsefHistory()
  const upo = useKsefUpo()

  const [nipInput, setNipInput] = useState<string>('')
  const [tokenInput, setTokenInput] = useState<string>('')
  const [envInput, setEnvInput] = useState<KsefEnv>('demo')
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'queue' | 'received' | 'history'>('queue')

  // Show UPO errors as toasts — avoids fixed-position overlay that overlaps content
  useEffect(() => {
    if (upo.error) toast.error('Błąd UPO', upo.error)
  }, [upo.error]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile) return
    const p = profile as Record<string, unknown>
    if (!nipInput) setNipInput((p.ksef_nip as string) || (p.nip as string) || '')
    if (!tokenInput) setTokenInput((p.ksef_token as string) || '')
    setEnvInput(((p.ksef_env as string) === 'prod' ? 'prod' : (p.ksef_env as string) === 'test' ? 'test' : 'demo') as KsefEnv)
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

  const handleProcessQueue = useCallback(async () => {
    if (!session) return
    try {
      await processQueue(session, session.isDemo)
    } catch { /* errors handled inside processQueue */ }
    refreshHistory()
  }, [session, processQueue, refreshHistory])

  async function handleReceive() {
    if (!session) return
    await receive(session.sessionToken, session.env, session.isDemo)
    refreshHistory()
  }

  function handleShowUpo(ksefRef: string, invoiceNumber: string) {
    if (!session) return
    upo.fetchAndShow(ksefRef, invoiceNumber, session.sessionToken, session.env, session.isDemo, session.referenceNumber || session.sessionRef)
  }

  const tabStyle = (tab: string) => ({
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: activeTab === tab ? 700 : 400,
    borderBottom: activeTab === tab ? '2px solid var(--color-primary, var(--color-brand))' : '2px solid transparent',
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid' as const,
    borderBottomColor: activeTab === tab ? 'var(--color-primary, var(--color-brand))' : 'transparent',
    cursor: 'pointer' as const,
    color: activeTab === tab ? 'var(--color-primary, var(--color-brand))' : 'var(--color-text-muted)',
  })

  return (
    <div>
      <PageHeader title="KSeF" subtitle="Wysyłka i odbiór faktur przez Krajowy System e-Faktur (Ministerstwo Finansów)." />

      <div className="grid-2">
        {/* ── SESJA ─────────────────────────────────────── */}
        <Card>
          <h3 style={{ marginBottom: 16 }}>Sesja KSeF</h3>
          {session ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: session.isDemo ? 'rgba(212,150,10,0.12)' : 'rgba(26,92,50,0.12)', border: `1px solid ${session.isDemo ? 'rgba(212,150,10,0.30)' : 'rgba(26,92,50,0.30)'}`, borderRadius: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 22 }}>{session.isDemo ? '🔵' : '🟢'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {session.isDemo ? 'Tryb demo — dane nie są wysyłane do MF' : 'Sesja aktywna'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Uruchomiona: {new Date(session.startedAt).toLocaleString('pl-PL')}
                  </div>
                </div>
                <Badge variant={session.env === 'prod' ? 'danger' : 'warning'}>
                  {session.env === 'prod' ? 'PRODUKCJA' : session.env === 'demo' ? 'DEMO' : 'TEST'}
                </Badge>
              </div>

              <div style={{ borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: 16 }}>
                {[
                  { label: 'NIP', value: <strong>{session.nip}</strong> },
                  { label: 'Serwer', value: session.env === 'prod' ? 'api.ksef.mf.gov.pl' : session.env === 'test' ? 'api-test.ksef.mf.gov.pl' : 'api-demo.ksef.mf.gov.pl' },
                  { label: 'Ref. sesji', value: <code style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-border)', padding: '2px 6px', borderRadius: 4 }}>{session.referenceNumber || session.sessionRef}</code> },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, background: 'var(--color-surface-soft)' }}>{row.label}</div>
                    <div style={{ padding: '10px 14px', fontSize: 13 }}>{row.value}</div>
                  </div>
                ))}
              </div>

              <Button variant="secondary" onClick={closeSession} loading={sessionLoading}>Zakończ sesję</Button>
            </div>
          ) : (
            <form onSubmit={handleInitSession}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Input label="NIP firmy" value={nipInput} onChange={(e) => setNipInput(e.target.value)} placeholder="1234567890" maxLength={10} />
                <Input label="Token autoryzacyjny KSeF" type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Token z panelu podatnika / PUE MF" />
                <Select
                  label="Środowisko"
                  value={envInput}
                  onChange={(e) => setEnvInput(e.target.value as KsefEnv)}
                  options={[
                    { value: 'demo', label: 'Demo (api-demo.ksef.mf.gov.pl)' },
                    { value: 'test', label: 'Testowe (api-test.ksef.mf.gov.pl)' },
                    { value: 'prod', label: 'Produkcyjne (api.ksef.mf.gov.pl)' },
                  ]}
                />
              </div>
              {sessionError && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 8, fontSize: 13, color: 'var(--color-error)' }}>
                  <strong>Błąd:</strong> {sessionError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Button type="submit" loading={sessionLoading} disabled={!nipInput || !tokenInput}>Inicjuj sesję</Button>
                <Button type="button" variant="ghost" onClick={handleInitDemoSession}>Tryb demo</Button>
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-surface-soft)', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                💡 NIP i token uzupełnisz w <strong>Ustawienia → Dane wykonawcy → KSeF</strong>.<br />
                Tryb demo działa bez połączenia z MF.
              </div>
            </form>
          )}
        </Card>

        {/* ── SZYBKIE AKCJE ──────────────────────────────── */}
        <Card>
          <h3 style={{ marginBottom: 16 }}>Szybkie akcje</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button
              disabled={!session || pending.length === 0}
              onClick={() => setSendModalOpen(true)}
              loading={processing}
            >
              📤 Wyślij do KSeF ({pending.length})
            </Button>
            <Button variant="secondary" disabled={!session} onClick={handleReceive} loading={receiving}>
              📥 Odbierz dokumenty z KSeF
            </Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/invoices' })}>
              📋 Lista faktur
            </Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/settings' })}>
              ⚙️ Ustawienia KSeF
            </Button>
          </div>

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--color-surface-soft)', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
            W razie braku połączenia z KSeF system pracuje w trybie lokalnym.
          </div>
        </Card>
      </div>

      {/* ── TABS: Queue / Received / History ──────────────── */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 0 }}>
          <button style={tabStyle('queue')} onClick={() => setActiveTab('queue')}>
            Kolejka ({pending.length})
          </button>
          <button style={tabStyle('received')} onClick={() => setActiveTab('received')}>
            Odebrane ({docs.length})
          </button>
          <button style={tabStyle('history')} onClick={() => setActiveTab('history')}>
            Historia ({history.length})
          </button>
        </div>

        <Card>
          {/* ── QUEUE TAB ──────────────────────────────── */}
          {activeTab === 'queue' && (
            <div>
              {!session && <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Zaloguj się do KSeF powyżej, aby zarządzać kolejką wysyłki.</p>}
              {pending.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                  Kolejka jest pusta.<br />
                  <span style={{ fontSize: 12 }}>Otwórz dowolną fakturę i użyj akcji „Wyślij do KSeF”, aby dodać ją do kolejki.</span>
                </p>
              ) : (
                <div>
                  <table className="table" style={{ fontSize: 13, width: '100%' }}>
                    <thead>
                      <tr><th>Numer</th><th>Kwota brutto</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {pending.map((inv) => (
                        <tr key={inv.id}>
                          <td>{inv.number}</td>
                          <td className="num">{formatCurrency(inv.total_gross)}</td>
                          <td><KsefStatusBadge status={inv.ksef_status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <Button onClick={() => setSendModalOpen(true)} disabled={!session || processing} loading={processing}>
                      {pending.length === 1 ? 'Wyślij fakturę' : pending.length <= 4 ? `Wyślij ${pending.length} faktury` : `Wyślij ${pending.length} faktur`}
                    </Button>
                  </div>
                </div>
              )}

              {lastResult && !sendModalOpen && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: lastResult.errors > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(26,92,50,0.12)', borderRadius: 8, fontSize: 13, border: `1px solid ${lastResult.errors > 0 ? 'rgba(239,68,68,0.30)' : 'rgba(26,92,50,0.30)'}` }}>
                  <strong>Ostatni wynik:</strong> {lastResult.sent} wysłanych, {lastResult.errors} błędów z {lastResult.total}
                  {lastResult.items.filter((i) => i.status === 'sent' && i.ksefRef).map((i) => (
                    <div key={i.invoice.id} style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <KsefStatusBadge status="ksef_sent" isMock={i.ksefRef?.startsWith('MOCK-') || i.ksefRef?.startsWith('DEMO-')} />
                      <span style={{ flex: 1, fontSize: 12 }}>{i.invoice.number}</span>
                      <code style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{i.ksefRef?.slice(0, 22)}…</code>
                      <Button variant="ghost" onClick={() => handleShowUpo(i.ksefRef!, i.invoice.number ?? '')} loading={upo.loading}>UPO</Button>
                    </div>
                  ))}
                  {lastResult.items.filter((i) => i.status === 'error').map((i) => (
                    <div key={i.invoice.id} style={{ color: 'var(--color-error)', marginTop: 4, fontSize: 12 }}>
                      ❌ {i.invoice.number}: {i.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── RECEIVED TAB ───────────────────────────── */}
          {activeTab === 'received' && (
            <div>
              {!session && <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Zaloguj się do KSeF powyżej, aby odbierać dokumenty.</p>}
              {receiveError && (
                <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 8, fontSize: 13, color: 'var(--color-error)' }}>
                  <strong>Błąd odbioru:</strong> {receiveError}
                </div>
              )}
              {newCount !== null && newCount >= 0 && (
                <p style={{ fontSize: 13, color: 'var(--color-brand)', marginBottom: 8 }}>Pobrano {newCount} nowych dokumentów.</p>
              )}
              {docs.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                  Nie odebrano jeszcze żadnych dokumentów. Kliknij „Odbierz” powyżej, aby pobrać faktury z KSeF.
                </p>
              ) : (
                <table className="table" style={{ fontSize: 12, width: '100%' }}>
                  <thead>
                    <tr><th>Nr ref. KSeF</th><th>Nr faktury</th><th>NIP wystawcy</th><th>Data</th><th>Kwota</th></tr>
                  </thead>
                  <tbody>
                    {docs.slice(0, 30).map((doc) => (
                      <tr key={doc.ksefRef}>
                        <td>
                          <code style={{ fontSize: 11 }}>{doc.ksefRef.slice(0, 22)}…</code>
                          {doc.ksefRef.startsWith('MOCK-') && <span style={{ fontSize: 10, color: 'var(--color-accent)', marginLeft: 4 }}>[MOCK]</span>}
                        </td>
                        <td>{doc.invoiceNumber}</td>
                        <td>{doc.issuerNip}</td>
                        <td>{doc.issueDate ? doc.issueDate.slice(0, 10) : '—'}</td>
                        <td className="num">{doc.grossAmount ? formatCurrency(doc.grossAmount) : '—'}</td>
                      </tr>
                    ))}
                    {docs.length > 30 && (
                      <tr><td colSpan={5} style={{ color: 'var(--color-text-muted)', textAlign: 'center', fontSize: 12 }}>… i {docs.length - 30} więcej</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ────────────────────────────── */}
          {activeTab === 'history' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{history.length} operacji</span>
                {history.length > 0 && <Button variant="ghost" onClick={clearHistory}>Wyczyść</Button>}
              </div>
              {history.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Historia jest pusta — pojawi się tutaj po pierwszej wysyłce lub odbiorze.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {history.slice(0, 60).map((entry) => (
                    <li key={entry.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-surface-soft)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 11, minWidth: 130 }}>
                        {new Date(entry.timestamp).toLocaleString('pl-PL')}
                      </span>
                      <Badge variant={entry.status === 'success' ? 'success' : 'danger'}>{entry.action}</Badge>
                      <span style={{ flex: 1 }}>{entry.invoiceNumber}</span>
                      {entry.ksefRef && (
                        <code style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {entry.ksefRef.slice(0, 18)}…
                          {(entry.ksefRef.startsWith('MOCK-') || entry.ksefRef.startsWith('DEMO-')) && (
                            <span style={{ color: 'var(--color-accent)', marginLeft: 4 }}>[MOCK]</span>
                          )}
                        </code>
                      )}
                      {entry.ksefRef && entry.status === 'success' && session && (
                        <Button variant="ghost" onClick={() => handleShowUpo(entry.ksefRef!, entry.invoiceNumber)} loading={upo.loading}>UPO</Button>
                      )}
                      {entry.error && <span style={{ color: 'var(--color-error)', fontSize: 12 }}>{entry.error}</span>}
                    </li>
                  ))}
                  {history.length > 60 && (
                    <li style={{ color: 'var(--color-text-muted)', fontSize: 12, padding: '4px 0' }}>… i {history.length - 60} więcej</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── MODALS ─────────────────────────────────────── */}
      <KsefSendModal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        pendingCount={pending.length}
        isDemo={session?.isDemo ?? false}
        processing={processing}
        onSend={handleProcessQueue}
        result={lastResult}
        onShowUpo={handleShowUpo}
      />

      {upo.open && upo.upoHtml && (
        <DocumentPreviewModal
          open={upo.open}
          onClose={upo.close}
          title="UPO · Urzędowe Poświadczenie Odbioru"
          tabs={[{ key: 'upo', label: 'UPO', type: 'html', content: upo.upoHtml }]}
        />
      )}
      {/* upo.error is shown via toast (useEffect above) */}
    </div>
  )
}


