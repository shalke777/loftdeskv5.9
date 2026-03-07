import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { demoDb } from '@/shared/lib/demoDb'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { useToast } from '@/shared/hooks/useToast'
import { useNavigate } from '@tanstack/react-router'
import { useFeatureAccess } from '@/features/auth/hooks/usePermissions'
import { PLAN_DEFS } from '@/shared/lib/constants'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { buildWorkspaceReadiness } from '@/shared/lib/releaseReadiness'

export function AdminPage() {
  const navigate = useNavigate()
  const users = demoDb.users.list()
  const companies = demoDb.companies()
  const toast = useToast()
  const isAdmin = useFeatureAccess('admin')

  if (!isAdmin) {
    return <AccessNotice title="Admin" description="To miejsce jest zarezerwowane dla operatora platformy LoftDesk." />
  }

  return (
    <div>
      <PageHeader title="Admin" subtitle="Operator platformy: multi-tenant, plany, workspace'y, health-check i szybkie akcje serwisowe." />
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Card><h3>Firmy</h3><p>{companies.length}</p></Card>
        <Card><h3>Użytkownicy</h3><p>{users.length}</p></Card>
        <Card>
          <h3>Serwis</h3>
          <Button variant="secondary" onClick={() => { demoDb.reset(); toast.success('Platforma demo zresetowana') }}>Reset całej bazy demo</Button>
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {companies.map((company) => {
          const readiness = buildWorkspaceReadiness({
            companyName: company.company_name,
            plan: company.plan,
            ksefReady: company.ksefReady,
            membersCount: company.members,
            pendingInvitations: company.pending_invitations,
            portalLinks: company.portal_links,
            estimatesCount: company.estimates,
            invoicesCount: company.invoices,
            projectsCount: company.projects,
          })
          const blocked = readiness.filter((item) => item.status === 'blocked').length
          const warnings = readiness.filter((item) => item.status === 'warning').length

          return (
            <Card key={company.company_id}>
              <div className="toolbar" style={{ marginBottom: 8 }}>
                <div>
                  <h3>{company.company_name}</h3>
                  <p>{company.company_id}</p>
                </div>
                <Badge variant={company.plan === 'free' ? 'warning' : 'success'}>{company.plan}</Badge>
              </div>
              <p>Członkowie: {company.members}</p>
              <p>Klienci: {company.clients}</p>
              <p>Projekty: {company.projects}</p>
              <p>Kosztorysy: {company.estimates}</p>
              <p>Faktury: {company.invoices}</p>
              <p>Zaproszenia pending: {company.pending_invitations}</p>
              <p>Linki portalu: {company.portal_links}</p>
              <p>KSeF: {company.ksefReady ? 'gotowe' : 'brak konfiguracji'}</p>
              <div className="actions-row" style={{ marginTop: 12, marginBottom: 12 }}>
                <Badge variant={blocked ? 'danger' : warnings ? 'warning' : 'success'}>
                  {blocked ? `${blocked} blokady` : warnings ? `${warnings} uwagi` : 'gotowe do stagingu'}
                </Badge>
              </div>
              <div className="actions-row" style={{ marginTop: 12, marginBottom: 12 }}>
                <Button variant="ghost" onClick={() => navigate({ to: '/go-live' as any })}>Go Live</Button>
                {Object.values(PLAN_DEFS).map((plan) => (
                  <Button
                    key={plan.id}
                    variant={company.plan === plan.id ? 'ghost' : 'secondary'}
                    disabled={company.plan === plan.id}
                    onClick={() => {
                      demoDb.companyPlanUpdate(company.company_id, plan.id)
                      toast.success('Plan zaktualizowany', `${company.company_name}: ${plan.name}`)
                    }}
                  >
                    {plan.name}
                  </Button>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid-2">
        {users.map((user) => (
          <Card key={user.id}>
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <div>
                <h3>{user.full_name}</h3>
                <p>{user.email}</p>
              </div>
              <Badge variant={user.role === 'admin' ? 'danger' : user.plan === 'free' ? 'warning' : 'success'}>{user.role}</Badge>
            </div>
            <p>Firma: {user.company_name}</p>
            <p>Company ID: {user.company_id}</p>
            <p>Plan: {user.plan}</p>
            <p>KSeF: {user.ksef_token ? 'skonfigurowany' : 'brak tokena'}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
