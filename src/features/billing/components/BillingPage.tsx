import { PLAN_DEFS } from '@/shared/lib/constants'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useBillingSummary, useChangePlan } from '@/features/billing/hooks/useBilling'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { formatCurrency } from '@/shared/lib/formatters'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'
import { buildBillingReadiness } from '@/shared/lib/releaseReadiness'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { demoDb } from '@/shared/lib/demoDb'

function renderLimit(limit: number | '∞', used: number) {
  return typeof limit === 'number' ? `${used} / ${limit}` : `${used} / bez limitu`
}

export function BillingPage() {
  const navigate = useNavigate()
  const canManagePlan = useCan('billing.changePlan')
  const summary = useBillingSummary()
  const changePlan = useChangePlan()
  const { team, invitations } = useSettings()
  const { user } = useAuth()

  if (summary.isLoading) return <Spinner />

  const data = summary.data
  if (!data) {
    return (
      <div>
        <PageHeader title="Billing" subtitle="Plan, limity i gotowość do przejścia na model subskrypcyjny." />
        <Card><p>Nie udało się pobrać danych billingowych.</p></Card>
      </div>
    )
  }

  if (!canManagePlan) {
    return <AccessNotice title="Billing tylko dla owner/admin" description="Przegląd i zmiana planu są dostępne dla właściciela firmy lub operatora platformy." />
  }

  const portalLinks = user ? demoDb.portal.listForCompany(user.companyId).length : 0
  const readiness = buildBillingReadiness(data, {
    membersCount: team.length,
    pendingInvitations: invitations.filter((item: any) => item.status === 'pending').length,
    portalLinks,
  })

  return (
    <div>
      <PageHeader title="Billing i plan" subtitle="Kontrola planu, limitów, wykorzystania oraz gotowości do wdrożenia Stripe/BLIK/KSeF." />
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Card>
          <h3>Firma</h3>
          <p>{data.companyName}</p>
          <p className="field__label">ID: {data.companyId}</p>
        </Card>
        <Card>
          <h3>Plan aktywny</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge variant={data.currentPlan === 'free' ? 'warning' : 'success'}>{PLAN_DEFS[data.currentPlan].name}</Badge>
            <span>{formatCurrency(PLAN_DEFS[data.currentPlan].price)} / mies.</span>
          </div>
          <p className="field__label">{data.ksefReady ? 'KSeF skonfigurowany' : 'KSeF wymaga konfiguracji'}</p>
        </Card>
        <Card>
          <h3>Wdrożenie billing</h3>
          <p>Warstwa v4.9 jest przygotowana pod plan gating, role gating, portal i przełączenie Stripe/webhooków.</p>
          <div className="actions-row" style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={() => navigate({ to: '/settings' })}>Ustawienia firmy</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/team' })}>Zespół</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/go-live' as any })}>Go Live</Button>
          </div>
        </Card>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Card><h3>Klienci</h3><p>{renderLimit(data.limits.clients, data.usage.clients)}</p></Card>
        <Card><h3>Projekty</h3><p>{renderLimit(data.limits.projects, data.usage.projects)}</p></Card>
        <Card><h3>Kosztorysy</h3><p>{renderLimit(data.limits.estimates, data.usage.estimates)}</p></Card>
        <Card><h3>Faktury</h3><p>{renderLimit(data.limits.invoices, data.usage.invoices)}</p></Card>
        <Card><h3>Umowy</h3><p>{renderLimit(data.limits.contracts, data.usage.contracts)}</p></Card>
        <Card>
          <h3>Rekomendacja</h3>
          <p>{data.currentPlan === 'free' ? 'Przejście na Pro odblokuje portal klienta, KSeF i brak limitów.' : 'Plan wspiera już operacyjną pracę firmy.'}</p>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3>Readiness do cutover</h3>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {readiness.map((check) => (
            <div key={check.id} className="toolbar" style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 10 }}>
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

      <div className="grid-3">
        {Object.values(PLAN_DEFS).map((plan) => (
          <Card key={plan.id}>
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <div>
                <h3>{plan.name}</h3>
                <p>{formatCurrency(plan.price)} / mies.</p>
              </div>
              {data.currentPlan === plan.id ? <Badge variant="success">Aktywny</Badge> : null}
            </div>
            <ul style={{ paddingLeft: 18 }}>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <div className="actions-row" style={{ marginTop: 12 }}>
              <Button
                variant={data.currentPlan === plan.id ? 'ghost' : 'primary'}
                disabled={data.currentPlan === plan.id || plan.id === 'admin'}
                loading={changePlan.isPending && changePlan.variables === plan.id}
                onClick={() => changePlan.mutate(plan.id)}
              >
                {data.currentPlan === plan.id ? 'Plan aktywny' : 'Wybierz plan'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
