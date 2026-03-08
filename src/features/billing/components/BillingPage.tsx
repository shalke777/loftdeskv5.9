import { PLAN_DEFS } from '@/shared/lib/constants'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useBillingSummary } from '@/features/billing/hooks/useBilling'
import { useCan } from '@/features/auth/hooks/usePermissions'
import { AccessNotice } from '@/shared/ui/AccessNotice/AccessNotice'

function renderLimit(limit: number | '∞', used: number) {
  return typeof limit === 'number' ? `${used} / ${limit}` : `${used} / bez limitu`
}

export function BillingPage() {
  const navigate = useNavigate()
  const canManagePlan = useCan('billing.changePlan')
  const summary = useBillingSummary()

  if (summary.isLoading) return <Spinner />

  const data = summary.data
  if (!data) {
    return (
      <div>
        <PageHeader title="Plan" subtitle="Aktywny plan i wykorzystanie zasobów." />
        <Card><p>Nie udało się pobrać danych.</p></Card>
      </div>
    )
  }

  if (!canManagePlan) {
    return <AccessNotice title="Dostęp tylko dla owner/admin" description="Przegląd planu jest dostępny dla właściciela firmy." />
  }

  const planDef = PLAN_DEFS[data.currentPlan]

  return (
    <div>
      <PageHeader title="Plan i limity" subtitle="Aktywny plan, zużycie zasobów i dane firmy." />

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Card>
          <h3>Firma</h3>
          <p>{data.companyName}</p>
          <p className="field__label">ID: {data.companyId}</p>
        </Card>
        <Card>
          <h3>Aktywny plan</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Badge variant={data.currentPlan === 'free' ? 'warning' : 'success'}>{planDef?.name ?? data.currentPlan}</Badge>
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

      <div className="grid-3">
        <Card><h3>Klienci</h3><p>{renderLimit(data.limits.clients, data.usage.clients)}</p></Card>
        <Card><h3>Projekty</h3><p>{renderLimit(data.limits.projects, data.usage.projects)}</p></Card>
        <Card><h3>Kosztorysy</h3><p>{renderLimit(data.limits.estimates, data.usage.estimates)}</p></Card>
        <Card><h3>Faktury</h3><p>{renderLimit(data.limits.invoices, data.usage.invoices)}</p></Card>
        <Card><h3>Umowy</h3><p>{renderLimit(data.limits.contracts, data.usage.contracts)}</p></Card>
        {planDef?.features && (
          <Card>
            <h3>Funkcje planu</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {planDef.features.map((f) => <li key={f} style={{ fontSize: 13 }}>{f}</li>)}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
