import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { Card } from '@/shared/ui/Card/Card'
import { Spinner } from '@/shared/ui/Spinner/Spinner'

export function AuthCallbackRoutePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function handleCallback() {
      if (!supabase) {
        window.location.assign('/login')
        return
      }
      try {
        const { error } = await supabase.auth.getSession()
        if (error) {
          setStatus('error')
          setMessage(error.message)
          return
        }
        setStatus('success')
        setMessage('E-mail potwierdzony. Przekierowanie do aplikacji...')
        window.setTimeout(() => window.location.assign('/dashboard'), 1500)
      } catch (err) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Nieznany blad')
      }
    }
    void handleCallback()
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
            <h2 style={{ marginBottom: 8 }}>E-mail potwierdzony</h2>
            <p>{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12, color: '#dc2626' }}>&#10007;</div>
            <h2 style={{ marginBottom: 8, color: '#dc2626' }}>Blad weryfikacji</h2>
            <p>{message}</p>
            <a href="/login" style={{ display: 'inline-block', marginTop: 16, color: '#1A5C32' }}>
              Przejdz do logowania
            </a>
          </>
        )}
      </Card>
    </div>
  )
}
