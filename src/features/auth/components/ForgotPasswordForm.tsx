import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { useToast } from '@/shared/hooks/useToast'
import { supabase } from '@/shared/lib/supabase'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  return (
    <Card className="auth-card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Odzyskiwanie dostępu</h1>
          <p>Podaj adres e-mail powiązany z kontem, a wyślemy link do zmiany hasła.</p>
        </div>
      </div>
      <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="twoj@email.pl" />
      <div className="actions-row">
        <Button
          variant="secondary"
          loading={loading}
          onClick={async () => {
            if (!email) { toast.error('Podaj e-mail'); return }
            setLoading(true)
            try {
              if (supabase) {
                const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` })
                if (error) throw error
              }
              toast.success('Link wysłany', `Sprawdź skrzynkę ${email} — znajdziesz tam link do resetu hasła.`)
            } catch (err) {
              toast.error('Błąd', err instanceof Error ? err.message : 'Spróbuj ponownie.')
            } finally {
              setLoading(false)
            }
          }}
        >
          Wyślij link resetujący
        </Button>
      </div>
    </Card>
  )
}
