// =============================================================================
// AccountDangerZone — Settings → Strefa zagrożenia
// =============================================================================
// Houses two GDPR-mandated self-service flows:
//   1) Eksport danych  (RODO art. 20)  → /.netlify/functions/data-export
//   2) Usunięcie konta (RODO art. 17)  → /.netlify/functions/account-delete
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Modal } from '@/shared/ui/Modal/Modal'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { supabase } from '@/shared/lib/supabase'

type ExportJob = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'expired'
  file_size: number | null
  requested_at: string
  completed_at: string | null
  expires_at: string | null
  download_count: number | null
}

type DeletionRequest = {
  id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'failed'
  scheduled_purge_at: string
  requested_at: string
  confirmed_at: string | null
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function api(path: string, body: unknown): Promise<Response> {
  const token = await getAccessToken()
  return fetch(`/.netlify/functions/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

export function AccountDangerZone() {
  const { user, signOut } = useAuth()
  const toast = useToast()

  const [exports, setExports] = useState<ExportJob[]>([])
  const [activeRequest, setActiveRequest] = useState<DeletionRequest | null>(null)
  const [showExportInfo, setShowExportInfo] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  // Delete confirmation state machine
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [emailConfirm, setEmailConfirm] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !user) return
    try {
      const { data: jobs } = await supabase.from('data_export_jobs')
        .select('id, status, file_size, requested_at, completed_at, expires_at, download_count')
        .order('requested_at', { ascending: false })
        .limit(10)
      setExports((jobs ?? []) as ExportJob[])

      const { data: req } = await supabase.from('account_deletion_requests')
        .select('id, status, scheduled_purge_at, requested_at, confirmed_at')
        .in('status', ['pending', 'confirmed'])
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setActiveRequest((req as DeletionRequest | null) ?? null)
    } catch (e) {
      console.warn('[danger-zone] load failed:', (e as Error).message)
    }
  }, [user])

  useEffect(() => { void load() }, [load])

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    setBusy(true)
    try {
      const r = await api('data-export', { action: 'request' })
      const j = (await r.json()) as { ok?: boolean; job_id?: string; error?: string }
      if (!r.ok || !j.ok) {
        toast.error(`Eksport nieudany: ${j.error ?? r.statusText}`)
        return
      }
      toast.success('Eksport rozpoczęty. Otrzymasz e-mail po jego zakończeniu.')
      setShowExportInfo(false)
      await load()
    } finally { setBusy(false) }
  }

  async function handleDownload(jobId: string) {
    setBusy(true)
    try {
      const r = await api('data-export', { action: 'download', job_id: jobId })
      const j = (await r.json()) as { ok?: boolean; url?: string; error?: string }
      if (!r.ok || !j.ok || !j.url) {
        toast.error(`Pobieranie nieudane: ${j.error ?? r.statusText}`)
        return
      }
      window.open(j.url, '_blank', 'noopener,noreferrer')
      await load()
    } finally { setBusy(false) }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function resetDeleteFlow() {
    setStep(1); setEmailConfirm(''); setPasswordConfirm(''); setReason('')
  }

  async function handleConfirmDelete() {
    if (!supabase || !user?.email) return
    setBusy(true)
    try {
      // Reauthenticate by signing in again — verifies password without rotating session.
      const { error: signinErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordConfirm,
      })
      if (signinErr) {
        toast.error('Nieprawidłowe hasło.')
        return
      }

      // Open the request
      const r1 = await api('account-delete', { action: 'request', reason })
      const j1 = (await r1.json()) as { ok?: boolean; request_id?: string; error?: string; message?: string }
      if (!r1.ok || !j1.ok) {
        toast.error(j1.message ?? j1.error ?? 'Nie udało się złożyć wniosku.')
        return
      }

      // Confirm immediately (the user just re-authenticated)
      const r2 = await api('account-delete', { action: 'confirm' })
      const j2 = (await r2.json()) as { ok?: boolean; error?: string }
      if (!r2.ok || !j2.ok) {
        toast.error(`Nie udało się potwierdzić: ${j2.error ?? r2.statusText}`)
        return
      }

      toast.success('Wniosek o usunięcie konta złożony. Konto zostanie usunięte za 30 dni.')
      setShowDelete(false)
      resetDeleteFlow()
      await load()
    } finally { setBusy(false) }
  }

  async function handleCancelDeletion() {
    setBusy(true)
    try {
      const r = await api('account-delete', { action: 'cancel' })
      const j = (await r.json()) as { ok?: boolean; error?: string }
      if (!r.ok || !j.ok) {
        toast.error(`Nie udało się anulować: ${j.error ?? r.statusText}`)
        return
      }
      toast.success('Wniosek o usunięcie konta został anulowany.')
      await load()
    } finally { setBusy(false) }
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <Card id="danger-zone" style={{ borderColor: 'var(--color-danger, #dc2626)' }}>
      <h3 style={{ color: 'var(--color-danger, #dc2626)' }}>Strefa zagrożenia</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Operacje w tej sekcji są nieodwracalne lub mają długoterminowe konsekwencje. Działaj uważnie.
      </p>

      {/* ── Pending deletion banner ─────────────────────────────────────── */}
      {activeRequest && (
        <div style={{
          padding: 12, marginBottom: 16, border: '1px solid #f59e0b',
          background: 'rgba(245,158,11,0.08)', borderRadius: 8, fontSize: 13,
        }}>
          <strong>Konto zaplanowane do usunięcia.</strong>
          <div style={{ marginTop: 4 }}>
            Status: {activeRequest.status === 'confirmed' ? 'potwierdzony' : 'oczekujący'} ·
            Zostanie usunięte: <strong>{new Date(activeRequest.scheduled_purge_at).toLocaleString('pl-PL')}</strong>
          </div>
          <div style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={handleCancelDeletion} disabled={busy}>
              Anuluj usunięcie
            </Button>
          </div>
        </div>
      )}

      {/* ── Export ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <strong>Eksport moich danych (RODO art. 20)</strong>
        <p className="muted" style={{ fontSize: 13 }}>
          Pobierz wszystkie swoje dane (profil, projekty, faktury, kontrakty, wiadomości) w formie pliku ZIP z plikami JSON.
        </p>
        <div className="actions-row">
          <Button variant="secondary" disabled={busy} onClick={() => setShowExportInfo(true)}>
            Eksportuj moje dane
          </Button>
        </div>

        {exports.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <div className="muted" style={{ marginBottom: 6 }}>Poprzednie eksporty:</div>
            <ul style={{ display: 'grid', gap: 6, listStyle: 'none', padding: 0 }}>
              {exports.map((j) => (
                <li key={j.id} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    {new Date(j.requested_at).toLocaleString('pl-PL')} ·{' '}
                    <strong>{j.status}</strong>
                    {j.file_size ? ` · ${(j.file_size / 1024).toFixed(0)} KB` : ''}
                  </span>
                  {j.status === 'completed' && (
                    <Button variant="ghost" disabled={busy} onClick={() => handleDownload(j.id)}>Pobierz</Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Delete ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gap: 8, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
        <strong style={{ color: 'var(--color-danger, #dc2626)' }}>Usuń konto (RODO art. 17)</strong>
        <p className="muted" style={{ fontSize: 13 }}>
          Po potwierdzeniu konto zostanie usunięte za 30 dni (okres ochronny — możesz anulować wniosek).
          Faktury, umowy i dane KSeF zostaną zanonimizowane, ale zachowane przez 5+1 lat zgodnie z ustawą o rachunkowości (art. 74).
        </p>
        <div className="actions-row">
          <Button
            variant="ghost"
            style={{ color: 'var(--color-danger, #dc2626)', borderColor: 'var(--color-danger, #dc2626)' }}
            disabled={busy || !!activeRequest}
            onClick={() => { resetDeleteFlow(); setShowDelete(true) }}
          >
            Usuń moje konto
          </Button>
        </div>
      </div>

      {/* ── Export info modal ───────────────────────────────────────────── */}
      <Modal title="Eksport danych (RODO art. 20)" open={showExportInfo} onClose={() => setShowExportInfo(false)} size="md">
        <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
          <p>Wygenerujemy paczkę ZIP zawierającą:</p>
          <ul>
            <li>Profil użytkownika i przynależność do firmy</li>
            <li>Projekty, wyceny, faktury, umowy, koszty</li>
            <li>Wątki i wiadomości z portalu klienta</li>
            <li>Akcje audytowe wykonywane na Twoim koncie</li>
            <li>Manifest (wersja schematu, data, podstawa prawna)</li>
          </ul>
          <p className="muted">
            Generacja może potrwać do 15 minut. Po zakończeniu otrzymasz e-mail z linkiem.
            Plik dostępny przez 7 dni.
          </p>
          <div className="actions-row">
            <Button variant="ghost" onClick={() => setShowExportInfo(false)}>Anuluj</Button>
            <Button onClick={handleExport} disabled={busy}>Rozpocznij eksport</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirmation modal ───────────────────────────────────── */}
      <Modal title="Usuń konto" open={showDelete} onClose={() => { setShowDelete(false); resetDeleteFlow() }} size="md">
        {step === 1 && (
          <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
            <p><strong>Co zostanie usunięte:</strong> profil, dane operacyjne, ustawienia, urządzenia push, notatki głosowe, zdjęcia profilu, wątki w portalu klienta.</p>
            <p><strong>Co zostanie zachowane (anonimowo) przez 5+1 lat:</strong> faktury, umowy, opłacone koszty i dane KSeF — wymóg ustawy o rachunkowości art. 74.</p>
            <p>Po potwierdzeniu konto wchodzi w 30-dniowy okres ochronny — możesz anulować wniosek w tym czasie.</p>
            <label style={{ display: 'grid', gap: 4 }}>
              Powód (opcjonalnie, pomaga nam się rozwijać):
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </label>
            <div className="actions-row">
              <Button variant="ghost" onClick={() => { setShowDelete(false); resetDeleteFlow() }}>Anuluj</Button>
              <Button onClick={() => setStep(2)}>Dalej</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
            <p>Aby kontynuować, wpisz swój adres e-mail: <strong>{user?.email ?? '—'}</strong></p>
            <input
              type="email"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              placeholder="Twój e-mail"
              autoComplete="off"
            />
            <div className="actions-row">
              <Button variant="ghost" onClick={() => setStep(1)}>Wstecz</Button>
              <Button onClick={() => setStep(3)} disabled={emailConfirm.trim().toLowerCase() !== (user?.email ?? '').toLowerCase()}>
                Dalej
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
            <p>Ostatnia weryfikacja — podaj hasło, aby potwierdzić tożsamość.</p>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Hasło"
              autoComplete="current-password"
            />
            <p className="muted" style={{ fontSize: 12 }}>
              Zostaniesz wylogowany ze wszystkich urządzeń. Konto zostanie ostatecznie usunięte za 30 dni.
            </p>
            <div className="actions-row">
              <Button variant="ghost" onClick={() => setStep(2)}>Wstecz</Button>
              <Button
                onClick={async () => { await handleConfirmDelete(); await signOut().catch(() => undefined) }}
                disabled={busy || !passwordConfirm}
                style={{ background: 'var(--color-danger, #dc2626)' }}
              >
                Usuń konto
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
