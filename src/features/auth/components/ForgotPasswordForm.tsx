import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { useToast } from '@/shared/hooks/useToast'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('adam@budowlanka.pl')
  const toast = useToast()

  return (
    <Card className="auth-card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Odzyskiwanie dostępu</h1>
          <p>W wersji demo pokazujemy gotowy przepływ pod integrację z Supabase Auth.</p>
        </div>
      </div>
      <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="actions-row">
        <Button variant="secondary" onClick={() => toast.info('Reset hasła', `Do ${email} zostałby wysłany link resetujący.`)}>
          Wyślij link resetujący
        </Button>
      </div>
    </Card>
  )
}
