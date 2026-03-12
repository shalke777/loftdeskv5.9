import { useEffect, useState } from 'react'
import { CheckCircle2, Zap } from 'lucide-react'
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
import {
  CheckoutConsentCheckboxes,
  defaultCheckoutConsents,
  checkoutConsentsValid,
  type ConsentValues,
} from '@/features/legal/components/LegalConsentCheckboxes'

type CheckoutKey = 'autoRenewal' | 'zasadyPlatnosci' | 'b2bCheckout'

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
  const [checkoutConsents, setCheckoutConsents] = useState<ConsentValues<CheckoutKey>>(defaultCheckoutConsents())
  const checkoutReady = checkoutConsentsValid(checkoutConsents)

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
      if (!checkoutReady) {
        toast.error('Wymagane zgody', 'Zaznacz wszystkie wymagane pola przed zakupem.')
        return
      }
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
        <Card style={{ gridColumn: 'span 2' }}>
          <h3 style={{ marginBottom: 14 }}>Wykorzystanie zasobów</h3>
          {(
            [
              ['clients',   'Klienci'],
              ['projects',  'Projekty'],
              ['estimates', 'Kosztorysy'],
              ['invoices',  'Faktury'],
              ['contracts', 'Umowy'],
            ] as const
          ).map(([key, label]) => {
            const used  = data.usage[key]
            const limit = data.limits[key]
            const pct   = limit === '∞' ? null : limit === 0 ? 100 : Math.round((used / limit) * 100)
            const warn  = pct !== null && pct >= 80
            return (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 600, color: warn ? '#d97706' : undefined }}>
                    {renderLimit(limit, used)}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: pct === null ? '4%' : `${Math.min(pct, 100)}%`,
                      height: '100%',
                      background: pct !== null && pct >= 100 ? '#dc2626' : warn ? '#f59e0b' : 'var(--color-brand, #7a2230)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </Card>
        <Card>
          <h3>Status</h3>
          <p style={{ fontSize: 13, marginBottom: 12, color: 'var(--color-text-muted)' }}>
            {data.currentPlan === 'free'
              ? 'Przejdź na Business, aby odblokować pełne możliwości systemu.'
              : 'Plan aktywny — masz dostęp do wszystkich funkcji.'}
          </p>
          {data.currentPlan === 'free' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <Zap size={13} color="#d97706" />
              <span style={{ color: '#92400e', flex: 1 }}>
                Plan <strong>Free</strong> — ograniczone limity.
              </span>
            </div>
          )}
          <div className="actions-row" style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={() => navigate({ to: '/settings' })}>Ustawienia firmy</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/team' })}>Zespół</Button>
          </div>
        </Card>
      </div>

      {isDemoMode && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10, fontSize: 13 }}>
          <strong>Tryb demo</strong> — zmiana planu dziala natychmiast bez platnosci. W produkcji platnosci obsluguje Stripe.
        </div>
      )}

      {/* Checkout consent checkboxes — shown only when upgrading is possible */}
      {data.currentPlan === 'free' && (
        <Card style={{ marginBottom: 16 }}>
          <h3>Warunki zakupu subskrypcji Business</h3>
          <p className="field__label" style={{ marginBottom: 12 }}>
            Zaznacz wszystkie pola, aby odblokować przycisk zakupu.
          </p>
          <CheckoutConsentCheckboxes
            values={checkoutConsents}
            onChange={(key, val) => setCheckoutConsents((prev) => ({ ...prev, [key]: val }))}
          />
        </Card>
      )}

      <div className="grid-3">
        {Object.values(PLAN_DEFS)
          .filter((plan) => (VISIBLE_PLANS as readonly string[]).includes(plan.id))
          .map((plan) => {
            const isActive = data.currentPlan === plan.id
            const isBusiness = plan.id === 'business'
            return (
              <Card
                key={plan.id}
                style={{
                  border: isActive ? '2px solid var(--color-brand, #7a2230)' : undefined,
                  position: 'relative',
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                    }}
                  >
                    <Badge variant="success">Aktywny</Badge>
                  </div>
                )}
                {isBusiness && !isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                    }}
                  >
                    <Badge variant="warning">Polecany</Badge>
                  </div>
                )}
                <h3 style={{ fontSize: 18, marginBottom: 4 }}>{plan.name}</h3>
                <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>
                  {plan.price === 0 ? 'Bezpłatny' : `${formatCurrency(plan.price)} / mies.`}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'grid', gap: 6 }}>
                  {plan.features.map((feature) => (
                    <li key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <CheckCircle2 size={14} color="var(--color-success, #16a34a)" style={{ flexShrink: 0 }} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isActive ? 'ghost' : 'primary'}
                  disabled={
                    isActive ||
                    (isBusiness && data.currentPlan === 'free' && !checkoutReady)
                  }
                  loading={upgradeLoading}
                  onClick={() => handleUpgrade(plan.id)}
                  style={{ width: '100%' }}
                >
                  {isActive
                    ? 'Plan aktywny'
                    : isBusiness
                      ? stripeEnabled
                        ? 'Kup Business'
                        : isDemoMode
                          ? 'Aktywuj Business (demo)'
                          : 'Przejdź na Business'
                      : 'Wróć do Free'}
                </Button>
              </Card>
            )
          })}
      </div>
    </div>
  )
}
