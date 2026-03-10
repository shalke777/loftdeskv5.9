import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { buildWorkspaceReadiness } from '@/shared/lib/releaseReadiness'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useEstimates } from '@/features/estimates/hooks/useEstimates'
import { useInvoices } from '@/features/invoices/hooks/useInvoices'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { usePortalTokens } from '@/features/portal/hooks/usePortalData'

export function WorkspaceReadinessCard() {
  const { user } = useAuth()
  const { team, invitations, profile } = useSettings()
  const { data: estimates = [] } = useEstimates()
  const { data: invoices = [] } = useInvoices()
  const { data: projects = [] } = useProjects()
  const { data: portalTokens = [] } = usePortalTokens(user?.companyId ?? '')

  if (!user) return null

  const checks = buildWorkspaceReadiness({
    companyName: user.companyName,
    plan: user.plan,
    ksefReady: Boolean((profile as any)?.ksef_token),
    membersCount: team.length,
    pendingInvitations: invitations.filter((item: any) => item.status === 'pending').length,
    portalLinks: portalTokens.filter((t) => t.active).length,
    estimatesCount: estimates.length,
    invoicesCount: invoices.length,
    projectsCount: projects.length,
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
