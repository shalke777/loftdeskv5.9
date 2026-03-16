import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { buildWorkspaceReadiness } from '@/shared/lib/releaseReadiness'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useEstimates } from '@/features/estimates/hooks/useEstimates'
import { useInvoices } from '@/features/invoices/hooks/useInvoices'
import { useProjects } from '@/features/projects/hooks/useProjects'

export function WorkspaceReadinessCard() {
  const { user } = useAuth()

  // -- Real Supabase data -- all scoped to user.companyId via useCompanyId() --
  const { team, invitations, profile, loading: settingsLoading } = useSettings()
  const { data: estimates, isLoading: estimatesLoading } = useEstimates()
  const { data: invoices, isLoading: invoicesLoading } = useInvoices()
  const { data: projects, isLoading: projectsLoading } = useProjects()
  // usePortalTokens removed — legacy client_tokens portal retired (Phase 3)
  // portalLinks hardcoded to 0; WorkspaceReadiness portal check is now obsolete

  if (!user) return null

  // While ANY data source is still loading we suppress all computed statuses --
  // so we never show `uwaga` just because a hook returned undefined/[] before the
  // first successful response.
  const isLoading = settingsLoading || estimatesLoading || invoicesLoading || projectsLoading

  const checks = buildWorkspaceReadiness({
    companyName: user.companyName,
    plan: user.plan,
    // profile is from Supabase via useSettings -- safe to derive ksef_token directly
    ksefReady: isLoading ? true : Boolean((profile as any)?.ksef_token),
    // team / invitations are from Supabase via useSettings -- already scoped to companyId
    membersCount: isLoading ? 2 : team.length,
    pendingInvitations: isLoading ? 0 : invitations.filter((item: any) => item.status === 'pending').length,
    // legacy portal tokens gone — new email-based portal has no token URLs to count
    portalLinks: 0,
    estimatesCount: isLoading ? 1 : (estimates ?? []).length,
    invoicesCount: isLoading ? 1 : (invoices ?? []).length,
    projectsCount: isLoading ? 1 : (projects ?? []).length,
  })

  return (
    <Card>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <div>
          <h3>Readiness workspace'u</h3>
          <p className="field__label">Szybki przegląd gotowości firmy do przejścia na staging / pracę produkcyjną.</p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {checks.map((check) => (
          <div key={check.id} className="toolbar" style={{ padding: 10, border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <div>
              <strong>{check.label}</strong>
              <div className="field__label">
                {isLoading ? 'Sprawdzanie…' : check.hint}
              </div>
            </div>
            <Badge
              variant={
                isLoading
                  ? 'default'
                  : check.status === 'done'
                  ? 'success'
                  : check.status === 'warning'
                  ? 'warning'
                  : 'danger'
              }
            >
              {isLoading ? '…' : check.status === 'done' ? 'gotowe' : check.status === 'warning' ? 'uwaga' : 'blokada'}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  )
}