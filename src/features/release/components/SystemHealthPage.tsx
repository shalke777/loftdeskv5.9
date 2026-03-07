
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Card } from '@/shared/ui/Card/Card'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { demoDb } from '@/shared/lib/demoDb'
import { getFrontendEnvStatus } from '@/shared/lib/env'
import { buildDeployChecks } from '@/shared/lib/deployReadiness'

export function SystemHealthPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canUseRelease = useFeatureAccess('release')

  if (!user || !canUseRelease) {
    return <AccessNotice title="Health Center" description="Tylko owner/admin mogą sprawdzać deploy health i cutover readiness." />
  }

  const env = getFrontendEnvStatus()
  const company = demoDb.companies().find((item) => item.company_id === user.companyId)
  const checks = buildDeployChecks({
    user,
    ksefReady: Boolean(company?.ksefReady),
    pendingInvitations: company?.pending_invitations ?? 0,
    portalLinks: company?.portal_links ?? 0,
  })

  const blocked = checks.filter((item) => item.status === 'blocked').length
  const warnings = checks.filter((item) => item.status === 'warning').length

  return (
    <div>
      <PageHeader title="Health Center" subtitle="Techniczny status środowiska, workspace'u i mostu do deployu v5.2." />
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Card>
          <h3>Frontend env</h3>
          <p>Mode: {env.mode}</p>
          <p className="field__label">SUPABASE_URL: {env.hasSupabaseUrl ? 'ok' : 'brak'}</p>
          <p className="field__label">ANON_KEY: {env.hasSupabaseAnonKey ? 'ok' : 'brak'}</p>
        </Card>
        <Card>
          <h3>Workspace</h3>
          <p>{user.companyName}</p>
          <p className="field__label">company_id: {user.companyId}</p>
          <p className="field__label">rola: {user.role}</p>
        </Card>
        <Card>
          <h3>Deploy verdict</h3>
          <Badge variant={blocked ? 'danger' : warnings ? 'warning' : 'success'}>
            {blocked ? `${blocked} blokady` : warnings ? `${warnings} uwagi` : 'deploy-ready'}
          </Badge>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <h3>Kontrole</h3>
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
          <h3>Pakiet v5.1</h3>
          <ul>
            <li><code>scripts/env-validate.mjs</code></li>
            <li><code>scripts/deploy-ready-report.mjs</code></li>
            <li><code>scripts/route-smoke.mjs</code></li>
            <li><code>docs/v5.1-deploy-ready-plan.md</code></li>
            <li><code>tests/manual/v5.1-deploy-ready-checklist.md</code></li>
            <li><code>tests/manual/v5.2-final-production-checklist.md</code></li>
          </ul>
          <div className="actions-row">
            <Button variant="secondary" onClick={() => navigate({ to: '/release' as any })}>Release Center</Button>
            <Button variant="secondary" onClick={() => navigate({ to: '/settings' })}>Ustawienia</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/team' })}>Zespół</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/go-live' as any })}>Go Live</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
