import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { buildWorkspaceReadiness } from '@/shared/lib/releaseReadiness'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { demoDb } from '@/shared/lib/demoDb'

export function WorkspaceReadinessCard() {
  const { user } = useAuth()
  const { team, invitations, profile } = useSettings()
  const portalLinks = user ? demoDb.portal.listForCompany(user.companyId).length : 0
  const estimatesCount = user ? demoDb.estimates.list(user.companyId).length : 0
  const invoicesCount = user ? demoDb.invoices.list(user.companyId).length : 0
  const projectsCount = user ? demoDb.projects.list(user.companyId).length : 0

  if (!user) return null

  const checks = buildWorkspaceReadiness({
    companyName: user.companyName,
    plan: user.plan,
    ksefReady: Boolean((profile as any)?.ksef_token),
    membersCount: team.length,
    pendingInvitations: invitations.filter((item: any) => item.status === 'pending').length,
    portalLinks,
    estimatesCount,
    invoicesCount,
    projectsCount,
  })

  return (
    <Card>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <div>
          <h3>Readiness workspace’u</h3>
          <p className="field__label">Szybki przegląd gotowości firmy do przejścia na staging / pracę produkcyjną.</p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {checks.map((check) => (
          <div key={check.id} className="toolbar" style={{ padding: 10, border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <div>
              <strong>{check.label}</strong>
              <div className="field__label">{check.hint}</div>
            </div>
            <Badge variant={check.status === 'done' ? 'success' : check.status === 'warning' ? 'warning' : 'danger'}>
              {check.status === 'done' ? 'gotowe' : check.status === 'warning' ? 'uwaga' : 'blokada'}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  )
}
