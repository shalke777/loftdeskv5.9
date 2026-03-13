import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { Table } from '@/shared/ui/Table/Table'
import { useInviteMember, useRevokeInvitation, useSettings } from '@/features/settings/hooks/useSettings'
import { Select } from '@/shared/ui/Select/Select'
import { useCan, useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'

const roles = ['owner', 'admin', 'manager', 'worker', 'accountant'] as const

export function TeamMembersCard() {
  const { team, invitations } = useSettings()
  const inviteMember = useInviteMember()
  const revokeInvitation = useRevokeInvitation()
  const [email, setEmail] = useState('pracownik@firma.pl')
  const [role, setRole] = useState<(typeof roles)[number]>('worker')
  const canUseTeam = useFeatureAccess('team')
  const canInvite = useCan('settings.inviteMember')

  if (!canUseTeam) {
    return <AccessNotice title="Zespół od planu Business" description="Role i company_members są przygotowane architektonicznie, ale aktywują się od planu Business." actionLabel="Przejdź do billing" onAction={() => window.location.assign('/billing')} />
  }

  return (
    <Card>
      <h3>Zespół i zaproszenia</h3>
      <p>Zarządzaj członkami, rolami i nowymi zaproszeniami do workspace'u.</p>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <Input label="E-mail nowego członka" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canInvite} />
        <Select label="Rola" value={role} onChange={(e) => setRole(e.target.value as (typeof roles)[number])} options={roles.map((item) => ({ value: item, label: item }))} disabled={!canInvite} />
      </div>
      <div className="actions-row">
        <Button
          disabled={!canInvite}
          loading={inviteMember.isPending}
          onClick={() => {
            if (!email.trim()) return
            inviteMember.mutate({ email, role })
            setEmail('')
          }}
        >
          Wyślij zaproszenie
        </Button>
      </div>

      {/* Current members */}
      <div style={{ marginTop: 16 }}>
        <Table
          data={team}
          columns={[
            { key: 'full_name', header: 'Użytkownik' },
            { key: 'email', header: 'E-mail' },
            { key: 'role', header: 'Rola' },
            { key: 'plan', header: 'Plan' },
          ]}
        />
      </div>

      {/* Pending invitations */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Zaproszenia oczekujące</h4>
        {invitations.length === 0
          ? <p className="muted">Brak aktywnych zaproszeń.</p>
          : (
            <div style={{ display: 'grid', gap: 10 }}>
              {invitations.map((item: any) => (
                <div key={item.id} className="list-row">
                  <div>
                    <strong>{item.email}</strong>
                    <div className="muted">rola: {item.role} · status: {item.status}</div>
                    <div className="muted">link: /join/{item.token}</div>
                  </div>
                  <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
                    <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/join/${item.token}`)}>Kopiuj link</Button>
                    {item.status === 'pending' ? (
                      <Button variant="secondary" loading={revokeInvitation.isPending} onClick={() => revokeInvitation.mutate(item.id)}>Wycofaj</Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </Card>
  )
}

