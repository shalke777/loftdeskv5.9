import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { Input } from '@/shared/ui/Input/Input'
import { Table } from '@/shared/ui/Table/Table'
import { useInviteMember, useSettings } from '@/features/settings/hooks/useSettings'
import { Select } from '@/shared/ui/Select/Select'
import { useCan, useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'

const roles = ['owner', 'admin', 'manager', 'worker', 'accountant'] as const

export function TeamMembersCard() {
  const { team } = useSettings()
  const inviteMember = useInviteMember()
  const [email, setEmail] = useState('pracownik@firma.pl')
  const [role, setRole] = useState<(typeof roles)[number]>('worker')
  const canUseTeam = useFeatureAccess('team')
  const canInvite = useCan('settings.inviteMember')

  if (!canUseTeam) {
    return <AccessNotice title="Zespół od planu Business" description="Role i company_members są przygotowane architektonicznie, ale aktywują się od planu Business." actionLabel="Przejdź do billing" onAction={() => window.location.assign('/billing')} />
  }

  return (
    <Card>
      <h3>Zespół</h3>
      <p>Zarządzaj członkami, rolami i nowymi zaproszeniami do workspace'u.</p>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <Input label="E-mail nowego członka" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canInvite} />
        <Select label="Rola" value={role} onChange={(e) => setRole(e.target.value as (typeof roles)[number])} options={roles.map((item) => ({ value: item, label: item }))} disabled={!canInvite} />
      </div>
      <div className="actions-row">
        <Button disabled={!canInvite} onClick={() => inviteMember.mutate({ email, role })}>Wyślij zaproszenie</Button>
      </div>
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
    </Card>
  )
}
