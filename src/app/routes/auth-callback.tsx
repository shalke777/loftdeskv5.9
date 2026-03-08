import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { translateError } from '@/shared/lib/errorMessages'
import { Card } from '@/shared/ui/Card/Card'
import { Spinner } from '@/shared/ui/Spinner/Spinner'

export function AuthCallbackRoutePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) {
      window.location.assign('/login')
      return
    }

    // Supabase redirects with hash fragment (#access_token=...&refresh_token=...)
    // The JS client auto-detects this and fires onAuthStateChange.
    // We listen for that event instead of calling getSession() immediately.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setStatus('success')
        setMessage('E-mail potwierdzony. Przekierowanie do aplikacji...')
        window.setTimeout(() => window.location.assign('/dashboard'), 1500)
      }
      if (event === 'SIGNED_OUT') {
        setStatus('error')
        setMessage('Nie udało się potwierdzić sesji. Spróbuj zalogować się ręcznie.')
      }
    })

    // Fallback: if no event fires within 5s, try getSession manually
    const timeout = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase!.auth.getSession()
        if (error) {
          setStatus('error')
          setMessage(translateError(error))
          return
        }
        if (data.session) {
          setStatus('success')
          setMessage('E-mail potwierdzony. Przekierowanie do aplikacji...')
          window.setTimeout(() => window.location.assign('/dashboard'), 1500)
        } else {
          // No session and no event — redirect to login
          setStatus('success')
          setMessage('Konto potwierdzone. Przekierowanie do logowania...')
          window.setTimeout(() => window.location.assign('/login'), 1500)
        }
      } catch (err) {
        setStatus('error')
        setMessage(translateError(err, 'Nieznany błąd'))
      }
    }, 4000)

    return () => {
      subscription.unsubscribe()
      window.clearTimeout(timeout)
    }
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
        {status === 'loading' && (
          <>
            <Spinner />
            <p style={{ marginTop: 16 }}>Weryfikacja e-maila...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
            <h2 style={{ marginBottom: 8 }}>Witaj w LoftDesk!</h2>
            <p style={{ marginBottom: 8 }}>Twoje konto zostało pomyślnie potwierdzone.</p>
            <p>{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12, color: '#dc2626' }}>&#10007;</div>
            <h2 style={{ marginBottom: 8, color: '#dc2626' }}>Błąd weryfikacji</h2>
            <p>{message}</p>
            <a href="/login" style={{ display: 'inline-block', marginTop: 16, color: '#1A5C32' }}>
              Przejdź do logowania
            </a>
          </>
        )}
      </Card>
    </div>
  )
}
