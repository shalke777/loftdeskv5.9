import { useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Select } from '@/shared/ui/Select/Select'
import { useInviteMember, useRevokeInvitation, useSettings } from '@/features/settings/hooks/useSettings'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { getAppOrigin } from '@/shared/lib/native'

export function TeamInvitationsCard() {
  const { invitations } = useSettings()
  const canInvite = useCan('settings.inviteMember')
  const invite = useInviteMember()
  const revoke = useRevokeInvitation()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'manager' | 'worker' | 'accountant'>('worker')

  if (!canInvite) {
    return <AccessNotice title="Zaproszenia" description="Twój plan albo rola nie pozwalają wysyłać zaproszeń do zespołu." />
  }

  return (
    <Card>
      <h3>Zaproszenia do zespołu</h3>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pracownik@firma.pl" />
        <Select
          label="Rola"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          options={[
            { label: 'Admin', value: 'admin' },
            { label: 'Manager', value: 'manager' },
            { label: 'Worker', value: 'worker' },
            { label: 'Accountant', value: 'accountant' },
          ]}
        />
      </div>
      <div className="actions-row">
        <Button
          loading={invite.isPending}
          onClick={() => {
            if (!email.trim()) return
            invite.mutate({ email, role })
            setEmail('')
          }}
        >
          Wyślij zaproszenie
        </Button>
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {invitations.length === 0 ? <p className="muted">Brak aktywnych zaproszeń.</p> : null}
        {invitations.map((item: any) => (
          <div key={item.id} className="list-row">
            <div>
              <strong>{item.email}</strong>
              <div className="muted">rola: {item.role} · status: {item.status}</div>
              <div className="muted">link: /join/{item.token}</div>
            </div>
            <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(`${getAppOrigin()}/join/${item.token}`)}>Kopiuj link</Button>
              {item.status === 'pending' ? (
                <Button variant="secondary" loading={revoke.isPending} onClick={() => revoke.mutate(item.id)}>Wycofaj</Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
