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
  const [companyName, setCompanyName] = useState('')
  const [ksefEnv, setKsefEnv] = useState<'test' | 'prod'>('test')
  const [ksefNip, setKsefNip] = useState('')
  const [ksefToken, setKsefToken] = useState('')
  const canEdit = useCan('settings.updateCompany')

  useEffect(() => {
    if (!profile) return
    setCompanyName((profile as any).company_name || (profile as any).company || '')
    setKsefEnv(((profile as any).ksef_env || 'test') as 'test' | 'prod')
    setKsefNip((profile as any).ksef_nip || '')
    setKsefToken((profile as any).ksef_token || '')
  }, [profile])

  return (
    <Card>
      <h3>Profil firmy</h3>
      <div className="grid-2">
        <Input label="Nazwa firmy" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!canEdit} />
        <Select label="Środowisko KSeF" value={ksefEnv} onChange={(e) => setKsefEnv((e.target.value || 'test') as 'test' | 'prod')} options={[{ value: 'test', label: 'Test' }, { value: 'prod', label: 'Produkcja' }]} disabled={!canEdit} />
        <Input label="NIP" value={ksefNip} onChange={(e) => setKsefNip(e.target.value)} disabled={!canEdit} />
        <Input label="Token KSeF" value={ksefToken} onChange={(e) => setKsefToken(e.target.value)} disabled={!canEdit} />
      </div>
      <div className="actions-row">
        <Button loading={updateProfile.isPending} disabled={!canEdit} onClick={() => updateProfile.mutate({ company_name: companyName, ksef_env: ksefEnv, ksef_nip: ksefNip, ksef_token: ksefToken })}>Zapisz profil firmy</Button>
      </div>
    </Card>
  )
}
