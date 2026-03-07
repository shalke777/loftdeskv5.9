
import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { demoDb } from '@/shared/lib/demoDb'

export function InviteAcceptanceAuditCard() {
  const { user } = useAuth()
  if (!user) return null

  const invitations = demoDb.invitations.list(user.companyId)
  const pending = invitations.filter((item) => item.status === 'pending').length
  const accepted = invitations.filter((item) => item.status === 'accepted').length
  const revoked = invitations.filter((item) => item.status === 'revoked').length

  return (
    <Card>
      <h3>Audit zaproszeń</h3>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        <div className="list-row"><span>Pending</span><Badge variant={pending ? 'warning' : 'success'}>{pending}</Badge></div>
        <div className="list-row"><span>Accepted</span><Badge variant="success">{accepted}</Badge></div>
        <div className="list-row"><span>Revoked</span><Badge variant={revoked ? 'default' : 'default'}>{revoked}</Badge></div>
      </div>
      <p className="field__label" style={{ marginTop: 12 }}>Na stagingu sprawdź także przepływ: invite → register/login → join → company_members.</p>
    </Card>
  )
}
