import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { translateError } from '@/shared/lib/errorMessages'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'

export function AuthCallbackRoutePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [hasSession, setHasSession] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!supabase) {
      window.location.assign('/login')
      return
    }

    let handled = false
    const succeed = (session: boolean) => {
      if (handled) return
      handled = true
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
        await new Promise((r) => window.setTimeout(r, 600))
        const { data: existing } = await sb.auth.getSession()
        if (existing.session) { succeed(true); return }
        const { error } = await sb.auth.exchangeCodeForSession(code)
        if (error) {
          const { data: retry } = await sb.auth.getSession()
          if (retry.session) { succeed(true) } else { fail(translateError(error, 'Link wygasł lub jest nieprawidłowy.')) }
        } else { succeed(true) }
        return
      }

      await new Promise((r) => window.setTimeout(r, 800))
      const { data, error } = await sb.auth.getSession()
      if (error) { fail(translateError(error)); return }
      if (data.session) { succeed(true); return }

      const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
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
          <p style={{ marginTop: 16, color: '#64748b' }}>Weryfikacja e-maila...</p>
        </Card>
      )}

      {status === 'success' && (
        <Card style={{ maxWidth: 500, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Witaj w LoftDesk!</h1>
          <p style={{ fontSize: 16, color: '#475569', marginBottom: 24, lineHeight: 1.6 }}>
            Twoje konto zostało pomyślnie potwierdzone.<br />
            Wszystko gotowe — możesz zacząć korzystać z aplikacji.
          </p>

          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 28,
            textAlign: 'left',
          }}>
            <p style={{ fontWeight: 600, marginBottom: 10, color: '#166534' }}>Co możesz teraz zrobić:</p>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#15803d', lineHeight: 1.8, fontSize: 14 }}>
              <li>Uzupełnij dane firmy w ustawieniach</li>
              <li>Dodaj pierwszego klienta i kosztorys</li>
              <li>Wystaw pierwszą fakturę</li>
              <li>Zaproś członków zespołu</li>
            </ul>
          </div>

          <Button
            onClick={() => window.location.assign(hasSession ? '/dashboard' : '/login')}
            style={{ width: '100%', fontSize: 16, padding: '12px 0' }}
          >
            {hasSession ? 'Przejdź do aplikacji' : 'Zaloguj się'}
          </Button>

          {!hasSession && (
            <p style={{ marginTop: 12, fontSize: 13, color: '#94a3b8' }}>
              Konto potwierdzone — zaloguj się, aby rozpocząć pracę.
            </p>
          )}
        </Card>
      )}

      {status === 'error' && (
        <Card style={{ maxWidth: 440, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12, color: '#dc2626' }}>&#10007;</div>
          <h2 style={{ marginBottom: 8, color: '#dc2626' }}>Błąd weryfikacji</h2>
          <p style={{ marginBottom: 20, color: '#64748b' }}>{errorMsg}</p>
          <Button variant="secondary" onClick={() => window.location.assign('/login')}>
            Przejdź do logowania
          </Button>
        </Card>
      )}
    </div>
  )
}
