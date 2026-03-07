import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { useNavigate } from '@tanstack/react-router'
import { demoDb } from '@/shared/lib/demoDb'
import { buildWorkspaceReadiness } from '@/shared/lib/releaseReadiness'
import { isDemoMode } from '@/shared/lib/supabase'
import { buildDeployChecks } from '@/shared/lib/deployReadiness'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'

export function ReleaseCenterPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = useFeatureAccess('admin')
  const companies = demoDb.companies()

  if (!user || (!isAdmin && !['owner', 'admin'].includes(user.role))) {
    return <AccessNotice title="Release Center" description="Tylko owner/admin mogą wejść w staging i cutover checklisty." />
  }

  const currentCompany = companies.find((company) => company.company_id === user.companyId) ?? companies[0]
  const checks = currentCompany ? buildWorkspaceReadiness({
    companyName: currentCompany.company_name,
    plan: currentCompany.plan,
    ksefReady: currentCompany.ksefReady,
    membersCount: currentCompany.members,
    pendingInvitations: currentCompany.pending_invitations,
    portalLinks: currentCompany.portal_links,
    estimatesCount: currentCompany.estimates,
    invoicesCount: currentCompany.invoices,
    projectsCount: currentCompany.projects,
  }) : []

  const blocked = checks.filter((item) => item.status === 'blocked').length
  const warnings = checks.filter((item) => item.status === 'warning').length
  const deployChecks = buildDeployChecks({
    user,
    ksefReady: Boolean(currentCompany?.ksefReady),
    pendingInvitations: currentCompany?.pending_invitations ?? 0,
    portalLinks: currentCompany?.portal_links ?? 0,
  })

  return (
    <div>
      <PageHeader title="Release Center" subtitle="Deploy readiness, cutover pack i kontrola gotowości workspace'u przed finalnym wydaniem v5.2." />
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Card>
          <h3>Tryb backendu</h3>
          <p>{isDemoMode ? 'DEMO / localStorage' : 'SUPABASE-FIRST'}</p>
        </Card>
        <Card>
          <h3>Workspace</h3>
          <p>{user.companyName}</p>
          <p className="field__label">Plan: {user.plan}</p>
        </Card>
        <Card>
          <h3>Status release</h3>
          <Badge variant={blocked ? 'danger' : warnings ? 'warning' : 'success'}>
            {blocked ? `${blocked} blokady` : warnings ? `${warnings} uwagi` : 'staging-ready'}
          </Badge>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <h3>Checklist gotowości</h3>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {checks.map((check) => (
              <div key={check.id} className="list-row">
                <div>
                  <strong>{check.label}</strong>
                  <div className="muted">{check.hint}</div>
                </div>
                <Badge variant={check.status === 'done' ? 'success' : check.status === 'warning' ? 'warning' : 'danger'}>{check.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3>Deploy check</h3>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {deployChecks.map((check) => (
              <div key={check.id} className="list-row">
                <div>
                  <strong>{check.label}</strong>
                  <div className="muted">{check.hint}</div>
                </div>
                <Badge variant={check.status === 'done' ? 'success' : check.status === 'warning' ? 'warning' : 'danger'}>{check.status}</Badge>
              </div>
            ))}
          </div>
          <div className="actions-row">
            <Button variant="secondary" onClick={() => navigate({ to: '/health' as any })}>Health Center</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/go-live' as any })}>Go Live</Button>
          </div>
        </Card>

        <Card>
          <h3>Cutover pack</h3>
          <ul>
            <li><code>scripts/deploy-preflight.mjs</code></li>
            <li><code>scripts/pre-cutover-snapshot.sql</code></li>
            <li><code>scripts/post-cutover-verify.sql</code></li>
            <li><code>scripts/rls-smoke.sql</code></li>
            <li><code>tests/manual/v5.0-release-checklist.md</code></li>
            <li><code>tests/manual/v5.1-deploy-ready-checklist.md</code></li>
          </ul>
          <div className="actions-row">
            <Button variant="secondary" onClick={() => navigate({ to: '/settings' })}>Otwórz ustawienia</Button>
            <Button variant="secondary" onClick={() => navigate({ to: '/billing' })}>Otwórz billing</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/admin' as any })}>Otwórz admin</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/health' as any })}>Otwórz health</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/go-live' as any })}>Otwórz go-live</Button>
          </div>
        </Card>

        <Card>
          <h3>Zakres v5.2</h3>
          <ul>
            <li>error boundary dla całej aplikacji</li>
            <li>join/invite acceptance flow</li>
            <li>release center i staging readiness</li>
            <li>health center i env validation</li>
            <li>mocniejszy deploy/cutover pack</li>
            <li>go-live center i final production runbook</li>
          </ul>
        </Card>

        <Card>
          <h3>Decyzja wdrożeniowa</h3>
          <p>{blocked ? 'Najpierw zdejmij blokady z checklisty i dopiero wtedy przejdź na staging.' : warnings ? 'Możesz wejść na staging, ale najpierw przejrzyj uwagi.' : 'Workspace jest gotowy do final production review w v5.2.'}</p>
        </Card>
      </div>
    </div>
  )
}
