import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { demoDb } from '@/shared/lib/demoDb'
import { buildWorkspaceReadiness } from '@/shared/lib/releaseReadiness'
import { buildDeployChecks } from '@/shared/lib/deployReadiness'
import { buildFinalProductionGates, getFinalProductionVerdict } from '@/shared/lib/finalProduction'
import { isDemoMode } from '@/shared/lib/supabase'

export function GoLivePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canUseRelease = useFeatureAccess('release')

  if (!user || !canUseRelease) {
    return <AccessNotice title="Go Live Center" description="Tylko owner/admin mogą zamykać finalny pakiet produkcyjny LoftDesk v5.2." />
  }

  const company = demoDb.companies().find((item) => item.company_id === user.companyId)
  const workspaceChecks = company ? buildWorkspaceReadiness({
    companyName: company.company_name,
    plan: company.plan,
    ksefReady: company.ksefReady,
    membersCount: company.members,
    pendingInvitations: company.pending_invitations,
    portalLinks: company.portal_links,
    estimatesCount: company.estimates,
    invoicesCount: company.invoices,
    projectsCount: company.projects,
  }) : []

  const deployChecks = buildDeployChecks({
    user,
    ksefReady: Boolean(company?.ksefReady),
    pendingInvitations: company?.pending_invitations ?? 0,
    portalLinks: company?.portal_links ?? 0,
  })

  const gates = buildFinalProductionGates({
    user,
    workspaceChecks,
    deployChecks,
    hasCutoverSqlPack: true,
    hasReleaseDocs: true,
    hasPortalCoverage: true,
  })

  const verdict = getFinalProductionVerdict(gates)
  const badgeVariant = verdict === 'ready' ? 'success' : verdict === 'warning' ? 'warning' : 'danger'

  return (
    <div>
      <PageHeader title="Go Live Center" subtitle="Finalny pakiet wydaniowy LoftDesk v5.2: decyzja go-live, kontrola cutover i checklisty produkcyjne." />

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Card>
          <h3>Final verdict</h3>
          <Badge variant={badgeVariant}>
            {verdict === 'ready' ? 'production-ready' : verdict === 'warning' ? 'release with warnings' : 'blocked'}
          </Badge>
          <p className="field__label" style={{ marginTop: 8 }}>
            {verdict === 'ready'
              ? 'Możesz przejść przez final cutover runbook.'
              : verdict === 'warning'
                ? 'Da się wejść w release review, ale zostały ostrzeżenia.'
                : 'Najpierw zdejmij blokady z final gates.'}
          </p>
        </Card>
        <Card>
          <h3>Workspace</h3>
          <p>{user.companyName}</p>
          <p className="field__label">Rola: {user.role}</p>
          <p className="field__label">Plan: {user.plan}</p>
        </Card>
        <Card>
          <h3>Runtime</h3>
          <p>{isDemoMode ? 'DEMO / bridge mode' : 'SUPABASE-FIRST runtime'}</p>
          <p className="field__label">Portal links: {company?.portal_links ?? 0}</p>
          <p className="field__label">Invites pending: {company?.pending_invitations ?? 0}</p>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <h3>Final gates</h3>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {gates.map((gate) => (
              <div key={gate.id} className="list-row">
                <div>
                  <strong>{gate.label}</strong>
                  <div className="muted">{gate.hint}</div>
                </div>
                <Badge variant={gate.status === 'done' ? 'success' : gate.status === 'warning' ? 'warning' : 'danger'}>{gate.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3>Final production pack</h3>
          <ul>
            <li><code>scripts/final-production-report.mjs</code></li>
            <li><code>scripts/final-cutover.mjs</code></li>
            <li><code>scripts/post-release-audit.mjs</code></li>
            <li><code>tests/manual/v5.2-final-production-checklist.md</code></li>
            <li><code>docs/v5.2-final-production-runbook.md</code></li>
            <li><code>docs/v5.2-release-gates.md</code></li>
          </ul>
          <div className="actions-row">
            <Button variant="secondary" onClick={() => navigate({ to: '/release' as any })}>Release Center</Button>
            <Button variant="secondary" onClick={() => navigate({ to: '/health' as any })}>Health Center</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/settings' })}>Settings</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/team' })}>Team</Button>
          </div>
        </Card>

        <Card>
          <h3>Go-live sequence</h3>
          <ol style={{ paddingLeft: 18 }}>
            <li>Uruchom <code>env:check</code> oraz <code>deploy:ready</code>.</li>
            <li>Zrób snapshot bazy i zweryfikuj RLS smoke.</li>
            <li>Przełącz VITE_PUBLIC_BASE_URL oraz Supabase env na staging/prod.</li>
            <li>Sprawdź portal klienta, zaproszenia, onboarding i billing.</li>
            <li>Uruchom post-release audit i zachowaj raport.</li>
          </ol>
        </Card>

        <Card>
          <h3>Decision note</h3>
          <p>
            {verdict === 'ready'
              ? 'v5.2 jest spiętym pakietem produkcyjnym do kontrolowanego wdrożenia.'
              : verdict === 'warning'
                ? 'v5.2 nadaje się do final review, ale przed cutover warto domknąć ostrzeżenia.'
                : 'v5.2 nie powinno jeszcze przejść do go-live bez zdjęcia blokad.'}
          </p>
        </Card>
      </div>
    </div>
  )
}
