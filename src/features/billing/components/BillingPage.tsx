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
import { useAuth } from '@/features/auth/hooks/useAuth'
import { demoDb } from '@/shared/lib/demoDb'

function renderLimit(limit: number | '∞', used: number) {
  return typeof limit === 'number' ? `${used} / ${limit}` : `${used} / bez limitu`
}

const VISIBLE_PLANS = ['free', 'business'] as const

export function BillingPage() {
  const navigate = useNavigate()
  const canManagePlan = useCan('billing.changePlan')
  const summary = useBillingSummary()
  const changePlan = useChangePlan()
  const { user } = useAuth()

  if (summary.isLoading) return <Spinner />

  const data = summary.data
  if (!data) {
    return (
      <div>
        <PageHeader title="Plan" subtitle="Aktywny plan i wykorzystanie zasobów." />
        <Card><p>Nie udało się pobrać danych billingowych.</p></Card>
      </div>
    )
  }

  if (!canManagePlan) {
    return <AccessNotice title="Billing tylko dla owner/admin" description="Przegląd i zmiana planu są dostępne dla właściciela firmy lub operatora platformy." />
  }

  return (
    <div>
      <PageHeader title="Plan i limity" subtitle="Aktywny plan, limity i zarządzanie subskrypcją." />

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Card>
          <h3>Firma</h3>
          <p>{data.companyName}</p>
          <p className="field__label">ID: {data.companyId}</p>
        </Card>
        <Card>
          <h3>Plan aktywny</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Badge variant={data.currentPlan === 'free' ? 'warning' : 'success'}>{PLAN_DEFS[data.currentPlan as keyof typeof PLAN_DEFS]?.name ?? data.currentPlan}</Badge>
            <span>{formatCurrency(PLAN_DEFS[data.currentPlan as keyof typeof PLAN_DEFS]?.price ?? 0)} / mies.</span>
          </div>
          <p className="field__label">{data.ksefReady ? 'KSeF skonfigurowany ✓' : 'KSeF wymaga konfiguracji'}</p>
        </Card>
        <Card>
          <h3>Skróty</h3>
          <div className="actions-row" style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={() => navigate({ to: '/settings' })}>Ustawienia firmy</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/team' })}>Zespół</Button>
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
          <h3>Status</h3>
          <p>{data.currentPlan === 'free' ? 'Przejdź na Business by odblokować pełne funkcje.' : 'Plan aktywny — pełne możliwości systemu.'}</p>
        </Card>
      </div>

      <div className="grid-3">
        {Object.values(PLAN_DEFS)
          .filter((plan) => (VISIBLE_PLANS as readonly string[]).includes(plan.id))
          .map((plan) => (
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
                  disabled={data.currentPlan === plan.id}
                  loading={changePlan.isPending && changePlan.variables === plan.id}
                  onClick={() => changePlan.mutate(plan.id)}
                >
                  {data.currentPlan === plan.id ? 'Plan aktywny' : `Przejdź na ${plan.name}`}
                </Button>
              </div>
            </Card>
          ))}
      </div>
    </div>
  )
}
