import { useEffect } from 'react'
import { PLAN_DEFS } from '@/shared/lib/constants'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Card } from '@/shared/ui/Card/Card'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useBillingSummary, useStripeCheckout, useStripePortal, useChangePlan } from '@/features/billing/hooks/useBilling'
import { useToast } from '@/shared/hooks/useToast'
import { formatCurrency } from '@/shared/lib/formatters'
import { hasStripeConfig } from '@/shared/lib/stripe'
import { isDemoMode } from '@/shared/lib/supabase'
import { useCan } from '@/features/auth/hooks/usePermissions'

function renderLimit(limit: number | '∞', used: number) {
  return typeof limit === 'number' ? `${used} / ${limit}` : `${used} / bez limitu`
}

const VISIBLE_PLANS = ['free', 'business'] as const

export function BillingPage() {
  const navigate = useNavigate()
  const summary = useBillingSummary()
  const toast = useToast()
  const stripeCheckout = useStripeCheckout()
  const stripePortal = useStripePortal()
  const changePlan = useChangePlan()
  const canManagePlan = useCan('billing.changePlan')
  const stripeEnabled = hasStripeConfig() && !isDemoMode

  const search = (typeof window !== 'undefined' ? Object.fromEntries(new URLSearchParams(window.location.search)) : {}) as Record<string, string>

  useEffect(() => {
    if (search.checkout === 'success') {
      toast.success('Platnosc zakonczona', 'Twoj plan zostal zaktualizowany. Moze to potrwac kilka sekund.')
      window.history.replaceState({}, '', '/billing')
    } else if (search.checkout === 'cancel') {
      toast.info('Platnosc anulowana', 'Nie dokonano zmian w planie.')
      window.history.replaceState({}, '', '/billing')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (summary.isLoading) return <Spinner />

  const data = summary.data
  if (!data) {
    return (
      <div>
        <PageHeader title="Plan" subtitle="Aktywny plan i wykorzystanie zasobow." />
        <Card><p>Nie udalo sie pobrac danych billingowych.</p></Card>
      </div>
    )
  }

  function handleUpgrade(planId: string) {
    if (!canManagePlan) {
      toast.info('Brak uprawnien', 'Zmiana planu wymaga roli wlasciciela firmy.')
      return
    }
    if (planId === 'free' && data!.currentPlan !== 'free') {
      if (stripeEnabled) {
        stripePortal.mutate()
      } else if (isDemoMode) {
        changePlan.mutate('free')
      }
      return
    }
    if (planId === 'business' && data!.currentPlan !== 'business') {
      if (stripeEnabled) {
        stripeCheckout.mutate()
      } else if (isDemoMode) {
        changePlan.mutate('business')
      } else {
        toast.info('Platnosci niedostepne', 'Skonfiguruj klucze Stripe aby aktywowac platnosci online.')
      }
    }
  }

  const upgradeLoading = stripeCheckout.isPending || changePlan.isPending

  return (
    <div>
      <PageHeader title="Plan i limity" subtitle="Aktywny plan, limity i zarzadzanie subskrypcja." />

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
          <p className="field__label">{data.ksefReady ? 'KSeF skonfigurowany' : 'KSeF wymaga konfiguracji'}</p>
          {data.currentPlan !== 'free' && stripeEnabled && (
            <Button variant="ghost" onClick={() => stripePortal.mutate()} loading={stripePortal.isPending} style={{ marginTop: 8 }}>
              Zarzadzaj subskrypcja
            </Button>
          )}
        </Card>
        <Card>
          <h3>Skroty</h3>
          <div className="actions-row" style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={() => navigate({ to: '/settings' })}>Ustawienia firmy</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/team' })}>Zespol</Button>
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
          <p>{data.currentPlan === 'free' ? 'Przejdz na Business by odblokowac pelne funkcje.' : 'Plan aktywny — pelne mozliwosci systemu.'}</p>
        </Card>
      </div>

      {isDemoMode && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10, fontSize: 13 }}>
          <strong>Tryb demo</strong> — zmiana planu dziala natychmiast bez platnosci. W produkcji platnosci obsluguje Stripe.
        </div>
      )}

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
                  loading={upgradeLoading}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {data.currentPlan === plan.id
                    ? 'Plan aktywny'
                    : plan.id === 'business'
                      ? (stripeEnabled ? 'Kup Business' : (isDemoMode ? 'Aktywuj Business (demo)' : 'Przejdz na Business'))
                      : 'Przejdz na Free'}
                </Button>
              </div>
            </Card>
          ))}
      </div>
    </div>
  )
}
