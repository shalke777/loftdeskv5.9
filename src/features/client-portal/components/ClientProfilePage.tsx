// =============================================================================
// ClientProfilePage — profil klienta w portalu (v6.0)
// =============================================================================

import { useState, useEffect } from 'react'
import { useClientAccount, useClientUpdateAccount } from '@/features/client-portal/hooks/useClientPortal'

export function ClientProfilePage() {
  const { data: account, isLoading } = useClientAccount()
  const updateAccount = useClientUpdateAccount()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone]       = useState('')
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    if (account) {
      setFullName(account.full_name ?? '')
      setPhone(account.phone ?? '')
    }
  }, [account])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await updateAccount.mutateAsync({ full_name: fullName, phone })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (isLoading) {
    return <div className="client-page-loading">Ładowanie profilu...</div>
  }

  return (
    <div className="client-profile">
      <h2 className="client-section-title">Twój profil</h2>

      <form className="client-profile__form" onSubmit={handleSubmit}>
        <div className="client-profile__field">
          <label className="client-profile__label" htmlFor="profile-email">
            Adres email
          </label>
          <input
            id="profile-email"
            className="client-profile__input client-profile__input--readonly"
            type="email"
            value={account?.email ?? ''}
            disabled
            readOnly
          />
          <span className="client-profile__hint">Email jest używany do logowania i nie może być zmieniony.</span>
        </div>

        <div className="client-profile__field">
          <label className="client-profile__label" htmlFor="profile-name">
            Imię i nazwisko
          </label>
          <input
            id="profile-name"
            className="client-profile__input"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Twoje imię i nazwisko"
            maxLength={120}
          />
        </div>

        <div className="client-profile__field">
          <label className="client-profile__label" htmlFor="profile-phone">
            Telefon
          </label>
          <input
            id="profile-phone"
            className="client-profile__input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+48 000 000 000"
            maxLength={30}
          />
        </div>

        <div className="client-profile__actions">
          <button
            type="submit"
            className="client-profile__save"
            disabled={updateAccount.isPending}
          >
            {updateAccount.isPending ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
          {saved && (
            <span className="client-profile__saved">✓ Zapisano</span>
          )}
          {updateAccount.isError && (
            <span className="client-profile__error">Błąd zapisu. Spróbuj ponownie.</span>
          )}
        </div>
      </form>
    </div>
  )
}
