import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { isDemoMode } from '@/shared/lib/supabase'
import { PendingInvitesNotice } from '@/features/auth/components/PendingInvitesNotice'
import { getPendingInviteToken, clearPendingInviteToken } from '@/shared/lib/inviteIntent'
import { settingsApi } from '@/features/settings/api/settings.api'
import {
  SignupConsentCheckboxes,
  defaultSignupConsents,
  signupConsentsValid,
  type ConsentValues,
} from '@/features/legal/components/LegalConsentCheckboxes'

type SignupKey = 'regulamin' | 'prywatnosc' | 'b2b' | 'dpa' | 'komunikacja'

export function RegisterForm() {
  const { registerDemoCompany } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [nip, setNip] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [consents, setConsents] = useState<ConsentValues<SignupKey>>(defaultSignupConsents())

  const handleConsentChange = (key: SignupKey, val: boolean) =>
    setConsents((prev) => ({ ...prev, [key]: val }))

  const finalizeInviteIfNeeded = async () => {
    const token = getPendingInviteToken()
    if (!token) return '/dashboard'
    await settingsApi.acceptInvitation(token, email)
    clearPendingInviteToken()
    toast.success('Zaproszenie zaakceptowane', 'Nowe konto zostało przypięte do zaproszonej firmy.')
    return '/settings'
  }

  return (
    <Card className="auth-card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Załóż konto firmowe</h1>
          <p>Tworzysz nową firmę w układzie company-first. Po starcie możesz od razu wejść do dashboardu i uzupełnić ustawienia firmy.</p>
        </div>
      </div>
      <div className="grid-2">
        <Input label="Nazwa firmy" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        <Input label="Imię i nazwisko właściciela" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="NIP" value={nip} onChange={(e) => setNip(e.target.value)} placeholder="opcjonalnie" />
      </div>
      <div style={{ marginTop: 16 }}>
        <Input label="Hasło" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <PendingInvitesNotice email={email} />

      <SignupConsentCheckboxes values={consents} onChange={handleConsentChange} />

      <div className="actions-row">
        <Button
          loading={loading}
          disabled={!signupConsentsValid(consents)}
          onClick={async () => {
            if (!signupConsentsValid(consents)) {
              toast.error('Wymagane zgody', 'Zaznacz wszystkie obowiązkowe pola, aby założyć konto.')
              return
            }
            try {
              setLoading(true)
              await authApi.register({ email, password, companyName, fullName, nip })
              if (isDemoMode) {
                registerDemoCompany({ email, companyName, fullName, password, nip })
                const target = await finalizeInviteIfNeeded()
                toast.success('Workspace utworzony', `Firma ${companyName} została zainicjowana w demo.`)
                window.location.assign(target)
              } else {
                toast.success('Konto utworzone', 'Potwierdź maila i zaloguj się do LoftDesk.')
                window.location.assign('/login')
              }
            } catch (error) {
              toast.error('Nie udało się utworzyć konta', translateError(error, 'Spróbuj ponownie.'))
            } finally {
              setLoading(false)
            }
          }}
        >
          Załóż konto
        </Button>
      </div>
    </Card>
  )
}
