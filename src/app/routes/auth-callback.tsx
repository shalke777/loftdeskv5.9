import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { translateError } from '@/shared/lib/errorMessages'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useToast } from '@/shared/hooks/useToast'

// ── Formularz ustawienia nowego hasła (po kliknięciu linku recovery) ──────────
function SetNewPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const toast = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('Za krótkie hasło', 'Hasło musi mieć minimum 8 znaków.'); return }
    if (password !== confirm) { toast.error('Hasła się różnią', 'Wpisz dwa razy to samo hasło.'); return }
    if (!supabase) return
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { toast.error('Błąd', error.message); return }
    setDone(true)
    window.setTimeout(() => window.location.assign('/dashboard'), 2000)
  }

  if (done) {
    return (
      <Card style={{ maxWidth: 400, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ marginBottom: 8 }}>Hasło zmienione</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>Za chwilę zostaniesz przekierowany do aplikacji…</p>
      </Card>
    )
  }

  return (
    <Card style={{ maxWidth: 400, padding: '36px 32px' }}>
      <h2 style={{ marginBottom: 6, fontSize: 22 }}>Nowe hasło</h2>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        Wpisz nowe hasło do swojego konta LoftDesk.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <Input
          label="Nowe hasło"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="minimum 8 znaków"
          required
        />
        <Input
          label="Powtórz hasło"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••"
          required
        />
        <Button type="submit" loading={loading} disabled={!password || !confirm}>
          Ustaw nowe hasło
        </Button>
      </form>
    </Card>
  )
}

export function AuthCallbackRoutePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [hasSession, setHasSession] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isRecovery, setIsRecovery] = useState(false)
  const isClientMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('mode') === 'client'

  useEffect(() => {
    if (!supabase) {
      window.location.assign('/login')
      return
    }

    let handled = false
    const succeed = (session: boolean) => {
      if (handled) return
      handled = true
      // Clients should go straight to their project — no intermediate screen.
      if (isClientMode && session) {
        const projectId = params.get('project_id')
        window.location.replace(projectId ? `/client/project/${projectId}` : '/client/dashboard')
        return
      }
      // emailRedirectTo may be stripped by Supabase → mode=client lost.
      // Detect client sessions via RPC; if RPC fails (e.g. migration 054 not yet applied),
      // fall back to direct auth_user_id lookup in client_accounts.
      if (session && supabase) {
        void (async () => {
          try {
            // Fast path: RPC (works when migration 054 is applied)
            const { data: rpcData, error: rpcError } = await supabase!.rpc('resolve_my_client_account').maybeSingle()
            if (!rpcError && rpcData) {
              window.location.replace('/client/dashboard')
              return
            }
            // Fallback: direct auth_user_id lookup (works as long as client-identify.ts set auth_user_id)
            const { data: { user: authedUser } } = await supabase!.auth.getUser()
            if (authedUser) {
              const { data: clientRow } = await supabase!
                .from('client_accounts')
                .select('id')
                .eq('auth_user_id', authedUser.id)
                .limit(1)
                .maybeSingle()
              if (clientRow) {
                window.location.replace('/client/dashboard')
                return
              }
            }
          } catch {
            // ignore — fall through to contractor screen
          }
          setHasSession(true)
          setStatus('success')
        })()
        return
      }
      setHasSession(session)
      setStatus('success')
    }
    const fail = (msg: string) => {
      if (handled) return
      handled = true
      setErrorMsg(msg)
      setStatus('error')
    }

    const params = new URLSearchParams(window.location.search)

    const urlError = params.get('error_description') || params.get('error')
    if (urlError) {
      fail(translateError(urlError))
      return
    }

    async function resolve() {
      const sb = supabase!
      const code = params.get('code')

      if (code) {
        // Exchange code for session first — then check result
        const { error, data: exchangeData } = await sb.auth.exchangeCodeForSession(code)

        if (!error) {
          // Check if this is a password recovery session
          const event = (exchangeData as any)?.session?.user?.aud === 'authenticated'
            ? null : null // can't tell from data alone — use onAuthStateChange below
          void (async () => {
            // Supabase emits PASSWORD_RECOVERY event when the session type is recovery
            // We listen for one event only after successful exchange
            let resolved = false
            const { data: { subscription: postSub } } = sb.auth.onAuthStateChange((ev, session) => {
              if (resolved) return
              resolved = true
              postSub.unsubscribe()
              if (ev === 'PASSWORD_RECOVERY') {
                if (!handled) { handled = true; setIsRecovery(true); setStatus('success') }
              } else {
                succeed(!!session)
              }
            })
            // Fallback: if onAuthStateChange doesn't fire within 1s, use the session from exchangeCodeForSession
            window.setTimeout(() => {
              if (!resolved) {
                resolved = true
                postSub.unsubscribe()
                if (!handled) succeed(!!(exchangeData as any)?.session)
              }
            }, 1000)
          })()
          return
        }

        // Exchange failed — maybe session already exists (link clicked twice)
        const { data: retry } = await sb.auth.getSession()
        if (retry.session) { succeed(true) } else { fail(translateError(error, 'Link wygasł lub jest nieprawidłowy.')) }
        return
      }

      await new Promise((r) => window.setTimeout(r, 800))
      const { data, error } = await sb.auth.getSession()
      if (error) { fail(translateError(error)); return }
      if (data.session) { succeed(true); return }

      const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          subscription.unsubscribe()
          if (!handled) { handled = true; setIsRecovery(true); setStatus('success') }
          return
        }
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          subscription.unsubscribe()
          succeed(true)
        }
      })

      window.setTimeout(() => {
        subscription.unsubscribe()
        if (!handled) succeed(false)
      }, 5000)
    }

    void resolve()
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      {status === 'loading' && (
        <Card style={{ maxWidth: 440, textAlign: 'center', padding: 40 }}>
          <Spinner />
          <p style={{ marginTop: 16, color: '#A7ABB3' }}>Weryfikacja e-maila...</p>
        </Card>
      )}

      {status === 'success' && isRecovery && <SetNewPasswordForm />}

      {status === 'success' && !isRecovery && (
        <Card style={{ maxWidth: 500, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Witaj w LoftDesk!</h1>
          <p style={{ fontSize: 16, color: '#A7ABB3', marginBottom: 24, lineHeight: 1.6 }}>
            Twoje konto zostało pomyślnie potwierdzone.<br />
            Wszystko gotowe — możesz zacząć korzystać z aplikacji.
          </p>

          <div style={{
            background: 'rgba(119,186,138,0.12)',
            border: '1px solid #bbf7d0',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 28,
            textAlign: 'left',
          }}>
            <p style={{ fontWeight: 600, marginBottom: 10, color: '#77BA8A' }}>Co możesz teraz zrobić:</p>
            {isClientMode ? (
              <ul style={{ margin: 0, paddingLeft: 20, color: '#77BA8A', lineHeight: 1.8, fontSize: 14 }}>
                <li>Przeglądaj dokumenty swoich projektów</li>
                <li>Odpowiadaj na akceptacje kosztorysów</li>
                <li>Przesyłaj wiadomości do wykonawcy</li>
                <li>Uzupełnij swój profil</li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, color: '#77BA8A', lineHeight: 1.8, fontSize: 14 }}>
                <li>Uzupełnij dane firmy w ustawieniach</li>
                <li>Dodaj pierwszego klienta i kosztorys</li>
                <li>Wystaw pierwszą fakturę</li>
                <li>Zaproś członków zespołu</li>
              </ul>
            )}
          </div>

          <Button
            onClick={() => window.location.assign(hasSession ? (isClientMode ? '/client/dashboard' : '/dashboard') : '/login')}
            style={{ width: '100%', fontSize: 16, padding: '12px 0' }}
          >
            {hasSession ? (isClientMode ? 'Przejdź do swoich projektów' : 'Przejdź do aplikacji') : 'Zaloguj się'}
          </Button>

          {!hasSession && (
            <p style={{ marginTop: 12, fontSize: 13, color: '#8A8F98' }}>
              Konto potwierdzone — zaloguj się, aby rozpocząć pracę.
            </p>
          )}
        </Card>
      )}

      {status === 'error' && (
        <Card style={{ maxWidth: 440, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12, color: '#EF6B6B' }}>&#10007;</div>
          <h2 style={{ marginBottom: 8, color: '#EF6B6B' }}>Błąd weryfikacji</h2>
          <p style={{ marginBottom: 20, color: '#A7ABB3' }}>{errorMsg}</p>
          <Button variant="secondary" onClick={() => window.location.assign('/login')}>
            Przejdź do logowania
          </Button>
        </Card>
      )}
    </div>
  )
}
