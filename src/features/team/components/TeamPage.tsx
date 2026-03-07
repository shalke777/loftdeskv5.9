import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { TeamMembersCard } from '@/features/settings/components/TeamMembersCard'
import { TeamInvitationsCard } from '@/features/settings/components/TeamInvitationsCard'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { useHasRole } from '@/features/auth/hooks/useAuth'
import { InviteAcceptanceAuditCard } from '@/features/team/components/InviteAcceptanceAuditCard'

export function TeamPage() {
  const canManage = useHasRole(['owner', 'admin', 'manager'])

  if (!canManage) {
    return <AccessNotice title="Brak dostępu do zespołu" description="Tylko owner/admin/manager mogą zarządzać członkami i zaproszeniami." />
  }

  return (
    <div>
      <PageHeader title="Zespół" subtitle="Członkowie, role i zaproszenia do firmy." />
      <div className="grid-2">
        <TeamMembersCard />
        <TeamInvitationsCard />
        <InviteAcceptanceAuditCard />
      </div>
    </div>
  )
}
