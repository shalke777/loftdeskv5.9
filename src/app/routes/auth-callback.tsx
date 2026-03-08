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

    let handled = false
    const succeed = (msg: string, target = '/dashboard') => {
      if (handled) return
      handled = true
      setStatus('success')
      setMessage(msg)
      window.setTimeout(() => window.location.assign(target), 1500)
    }
    const fail = (msg: string) => {
      if (handled) return
      handled = true
      setStatus('error')
      setMessage(msg)
    }

    const params = new URLSearchParams(window.location.search)

    // 1. URL error params (Supabase can redirect with ?error=)
    const urlError = params.get('error_description') || params.get('error')
    if (urlError) {
      fail(translateError(urlError))
      return
    }

    async function resolve() {
      const sb = supabase!
      const code = params.get('code')

      // 2. PKCE code exchange (Supabase v2 email verification redirects with ?code=)
      if (code) {
        // Give detectSessionInUrl a moment to process it first
        await new Promise((r) => window.setTimeout(r, 600))
        const { data: existing } = await sb.auth.getSession()
        if (existing.session) {
          succeed('E-mail potwierdzony. Przekierowanie do aplikacji...')
          return
        }
        // detectSessionInUrl didn't handle it — exchange manually
        const { error } = await sb.auth.exchangeCodeForSession(code)
        if (error) {
          // Code may be invalid/expired — check if session exists anyway
          const { data: retry } = await sb.auth.getSession()
          if (retry.session) {
            succeed('E-mail potwierdzony. Przekierowanie do aplikacji...')
          } else {
            fail(translateError(error, 'Link wygasł lub jest nieprawidłowy. Spróbuj zalogować się ręcznie.'))
          }
        } else {
          succeed('E-mail potwierdzony. Przekierowanie do aplikacji...')
        }
        return
      }

      // 3. Hash fragment flow (#access_token=...) — detectSessionInUrl handles this
      //    Wait for processing, then check session
      await new Promise((r) => window.setTimeout(r, 800))
      const { data, error } = await sb.auth.getSession()
      if (error) {
        fail(translateError(error))
        return
      }
      if (data.session) {
        succeed('E-mail potwierdzony. Przekierowanie do aplikacji...')
        return
      }

      // 4. Still no session — listen for auth state change (backup)
      const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          subscription.unsubscribe()
          succeed('E-mail potwierdzony. Przekierowanie do aplikacji...')
        }
      })

      // 5. Final fallback after 5 more seconds
      window.setTimeout(() => {
        subscription.unsubscribe()
        if (!handled) {
          // Account was confirmed but session isn't available (e.g. different device)
          succeed('Konto potwierdzone. Możesz się teraz zalogować.', '/login')
        }
      }, 5000)
    }

    void resolve()
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
            <p style={{ marginBottom: 16 }}>{message}</p>
            <a href="/login" style={{ display: 'inline-block', marginTop: 8, color: '#1A5C32', fontWeight: 600 }}>
              Przejdź do logowania
            </a>
          </>
        )}
      </Card>
    </div>
  )
}
