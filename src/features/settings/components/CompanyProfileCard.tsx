import { useEffect, useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { Select } from '@/shared/ui/Select/Select'
import { useSettings, useUpdateCompanyProfile } from '@/features/settings/hooks/useSettings'
import { useCan } from '@/features/auth/hooks/usePermissions'

export function CompanyProfileCard() {
  const { profile } = useSettings()
  const updateProfile = useUpdateCompanyProfile()
  const canEdit = useCan('settings.updateCompany')

  const [companyName, setCompanyName] = useState('')
  const [nip, setNip] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [iban, setIban] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [ksefEnv, setKsefEnv] = useState<'test' | 'prod'>('test')
  const [ksefNip, setKsefNip] = useState('')
  const [ksefToken, setKsefToken] = useState('')

  useEffect(() => {
    if (!profile) return
    const p = profile as any
    setCompanyName(p.company_name || p.name || p.company || '')
    setNip(p.nip || p.ksef_nip || '')
    setAddress(p.address || '')
    setPostalCode(p.postal_code || '')
    setCity(p.city || '')
    setIban(p.iban || '')
    setPhone(p.phone || '')
    setEmail(p.email || '')
    setKsefEnv((p.ksef_env || 'test') as 'test' | 'prod')
    setKsefNip(p.ksef_nip || p.nip || '')
    setKsefToken(p.ksef_token || '')
  }, [profile])

  function handleSave() {
    updateProfile.mutate({
      company_name: companyName,
      nip,
      address,
      postal_code: postalCode,
      city,
      iban,
      phone,
      email,
      ksef_env: ksefEnv,
      ksef_nip: ksefNip || nip,
      ksef_token: ksefToken,
    })
  }

  return (
    <Card>
      <h3 style={{ marginBottom: 16 }}>Dane wykonawcy</h3>

      <div style={{ marginBottom: 12 }}>
        <p className="field__label" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>PODSTAWOWE</p>
        <div className="grid-2">
          <Input label="Nazwa firmy / wykonawcy" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!canEdit} />
          <Input label="NIP" value={nip} onChange={(e) => setNip(e.target.value)} placeholder="0000000000" disabled={!canEdit} />
          <Input label="Adres (ulica i numer)" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ul. Przykładowa 1/2" disabled={!canEdit} />
          <div className="grid-2" style={{ gap: 8 }}>
            <Input label="Kod pocztowy" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="00-000" disabled={!canEdit} />
            <Input label="Miasto" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Warszawa" disabled={!canEdit} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <p className="field__label" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>KONTAKT I KONTO</p>
        <div className="grid-2">
          <Input label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+48 000 000 000" disabled={!canEdit} />
          <Input label="E-mail firmy" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="firma@example.com" disabled={!canEdit} />
          <Input label="Numer konta IBAN" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="PL00 0000 0000 0000 0000 0000 0000" disabled={!canEdit} style={{ gridColumn: 'span 2' }} />
        </div>
      </div>

      <div style={{ marginBottom: 4 }}>
        <p className="field__label" style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>KSeF</p>
        <div className="grid-2">
          <Select label="Środowisko KSeF" value={ksefEnv} onChange={(e) => setKsefEnv((e.target.value || 'test') as 'test' | 'prod')} options={[{ value: 'test', label: 'Testowe (ksef-test.mf.gov.pl)' }, { value: 'prod', label: 'Produkcyjne (ksef.mf.gov.pl)' }]} disabled={!canEdit} />
          <Input label="NIP do KSeF (jeśli inny niż wyżej)" value={ksefNip} onChange={(e) => setKsefNip(e.target.value)} placeholder="domyślnie z NIP firmy" disabled={!canEdit} />
          <Input label="Token KSeF" value={ksefToken} onChange={(e) => setKsefToken(e.target.value)} placeholder="Token z panelu podatnika / PUE MF" disabled={!canEdit} style={{ gridColumn: 'span 2' }} />
        </div>
      </div>

      <div className="actions-row" style={{ marginTop: 16 }}>
        <Button loading={updateProfile.isPending} disabled={!canEdit} onClick={handleSave}>
          Zapisz dane wykonawcy
        </Button>
      </div>
    </Card>
  )
}

