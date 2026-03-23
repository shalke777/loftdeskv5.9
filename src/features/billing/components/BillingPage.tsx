import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react'
import { PLAN_DEFS } from '@/shared/lib/constants'
import { useNavigate } from '@tanstack/react-router'
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
import type { SubscriptionStatus } from '@/features/billing/api/billing.api'

type CheckoutKey = 'autoRenewal' | 'zasadyPlatnosci' | 'b2bCheckout'

function renderLimit(limit: number | '∞', used: number) {
  return typeof limit === 'number' ? `${used} / ${limit}` : `${used} / bez limitu`
}

const VISIBLE_PLANS = ['free', 'business'] as const
// ── Subscription status display helpers ─────────────────────────────────────
function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

function subStatusBadge(status: SubscriptionStatus, daysLeft: number | null) {
  switch (status) {
    case 'active':     return { label: 'Aktywna',    variant: 'success' as const }
    case 'trialing':   return { label: daysLeft !== null ? `Trial • ${daysLeft}d` : 'Trial', variant: 'warning' as const }
    case 'past_due':   return { label: 'Zaległość',  variant: 'danger'  as const }
    case 'canceled':   return { label: 'Anulowana',  variant: 'danger'  as const }
    case 'unpaid':     return { label: 'Nieopłacona', variant: 'danger'  as const }
    case 'incomplete': return { label: 'Niekompletna', variant: 'warning' as const }
    default:           return { label: 'Brak sub.',  variant: 'default' as const }
  }
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  try { return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return iso }
}
export function BillingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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
      toast.success('Płatność zakończona', 'Twój plan zostanie zaktualizowany w ciągu kilku sekund.')
      window.history.replaceState({}, '', '/billing')
      // Re-fetch after 3 s to pick up webhook-driven plan update
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['billing', 'summary'] }), 3000)
    } else if (search.checkout === 'cancel') {
      toast.info('Płatność anulowana', 'Nie dokonano zmian w planie.')
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
      toast.info('Brak uprawnień', 'Zmiana planu wymaga roli właściciela firmy.')
      return
    }
    if (planId === 'free' && data!.currentPlan !== 'free') {
      if (stripeEnabled) { stripePortal.mutate() }
      else if (isDemoMode) { changePlan.mutate('free') }
      return
    }
    if (planId === 'business' && data!.currentPlan !== 'business') {
      if (!checkoutReady) {
        toast.error('Wymagane zgody', 'Zaznacz wszystkie wymagane pola przed zakupem.')
        return
      }
      if (stripeEnabled) { stripeCheckout.mutate(undefined) }
      else if (isDemoMode) { changePlan.mutate('business') }
      else { toast.info('Płatności niedostępne', 'Skonfiguruj klucze Stripe, aby aktywować płatności online.') }
    }
  }

  const upgradeLoading = stripeCheckout.isPending || changePlan.isPending

  const daysLeft  = trialDaysLeft(data.trialEndsAt)
  const subBadge  = subStatusBadge(data.subscriptionStatus, daysLeft)
  const periodEnd = formatDate(data.subscriptionPeriodEnd ?? data.trialEndsAt)

  const isPastDue = data.subscriptionStatus === 'past_due' || data.subscriptionStatus === 'unpaid'
  const isCanceled = data.subscriptionStatus === 'canceled'

  return (
    <div>
      <PageHeader title="Plan i limity" subtitle="Aktywny plan, limity i zarządzanie subskrypcją." />

      {/* Past-due or unpaid — high-urgency alert */}
      {isPastDue && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 10, fontSize: 13 }}>
          <AlertTriangle size={16} color="#EF6B6B" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, color: '#EF6B6B' }}>
            <strong>Płatność nie powiodła się.</strong> Zaktualizuj metodę płatności, aby uniknąć przerwy w dostępie.
          </span>
          {stripeEnabled && (
            <Button variant="primary" size="sm" onClick={() => stripePortal.mutate()} loading={stripePortal.isPending}>
              Zaktualizuj płatność
            </Button>
          )}
        </div>
      )}

      {/* Canceled — softer info */}
      {isCanceled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 16px', background: 'rgba(212,150,10,0.12)', border: '1px solid rgba(212,150,10,0.30)', borderRadius: 10, fontSize: 13 }}>
          <Clock size={16} color="#c2410c" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, color: '#D4960A' }}>
            Subskrypcja została anulowana. Dostęp do funkcji premium wygasł.
          </span>
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Card>
          <h3>Firma</h3>
          <p>{data.companyName}</p>
          <p className="field__label">ID: {data.companyId}</p>
        </Card>
        <Card>
          <h3>Plan aktywny</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <Badge variant={data.currentPlan === 'free' ? 'warning' : 'success'}>
              {PLAN_DEFS[data.currentPlan as keyof typeof PLAN_DEFS]?.name ?? data.currentPlan}
            </Badge>
            <Badge variant={subBadge.variant}>{subBadge.label}</Badge>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {formatCurrency(PLAN_DEFS[data.currentPlan as keyof typeof PLAN_DEFS]?.price ?? 0)} / mies.
            </span>
          </div>
          {data.subscriptionStatus === 'trialing' && daysLeft !== null && (
            <p style={{ fontSize: 12, color: daysLeft <= 3 ? '#EF6B6B' : '#D4960A', marginBottom: 6 }}>
              {daysLeft === 0
                ? '⏰ Trial wygasa dziś — aktywuj płatność, aby zachować dostęp.'
                : `⏰ ${daysLeft} • dni trialu pozostało.${daysLeft <= 5 ? ' Aktywuj plan.' : ''}`}
            </p>
          )}
          {periodEnd && data.subscriptionStatus === 'active' && (
            <p className="field__label" style={{ marginBottom: 6 }}>Odnowienie: {periodEnd}</p>
          )}
          <p className="field__label">{data.ksefReady ? 'KSeF skonfigurowany' : 'KSeF wymaga konfiguracji'}</p>
          {data.currentPlan !== 'free' && stripeEnabled && (
            <Button variant="ghost" onClick={() => stripePortal.mutate()} loading={stripePortal.isPending} style={{ marginTop: 8 }}>
              Zarządzaj subskrypcją
            </Button>
          )}
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
                    <span style={{ fontWeight: 600, color: warn ? '#D4960A' : undefined }}>
                    {renderLimit(limit, used)}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#3A3D42', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: pct === null ? '4%' : `${Math.min(pct, 100)}%`,
                      height: '100%',
                      background: pct !== null && pct >= 100 ? '#EF6B6B' : warn ? '#D4960A' : 'var(--color-brand, #77BA8A)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </Card>
        <Card>
          <h3>Status subskrypcji</h3>
          <p style={{ fontSize: 13, marginBottom: 10, color: 'var(--color-text-muted)' }}>
            {data.subscriptionStatus === 'active' && data.currentPlan !== 'free'
              ? 'Plan aktywny — masz dostęp do wszystkich funkcji.'
              : data.subscriptionStatus === 'trialing'
                ? 'Korzystasz z okresu próbnego. Po wygaśnięciu trialu potrzebujesz aktywnej subskrypcji.'
                : data.subscriptionStatus === 'past_due'
                  ? 'Płatność nie powiodła się. Zaktualizuj dane płatności.'
                  : data.subscriptionStatus === 'canceled'
                    ? 'Subskrypcja została anulowana. Przejdź na plan płatny, aby przywrócić dostęp.'
                    : 'Przej dź na Business, aby odblokować pełne możliwości systemu.'}
          </p>
          {data.subscriptionStatus === 'trialing' && daysLeft !== null && daysLeft <= 7 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: daysLeft <= 2 ? 'rgba(239,68,68,0.12)' : 'rgba(212,150,10,0.12)', border: `1px solid ${daysLeft <= 2 ? 'rgba(239,68,68,0.30)' : 'rgba(212,150,10,0.30)'}`, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
              <Clock size={13} color={daysLeft <= 2 ? '#EF6B6B' : '#D4960A'} />
              <span style={{ color: daysLeft <= 2 ? '#EF6B6B' : '#D4960A', flex: 1 }}>
                {daysLeft === 0 ? 'Trial wygasa dziś.' : `${daysLeft} dni trialu pozostało.`}
              </span>
            </div>
          )}
          {(data.currentPlan === 'free' || data.subscriptionStatus === 'canceled') && !isPastDue && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(212,150,10,0.12)', border: '1px solid rgba(212,150,10,0.30)', borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
              <Zap size={13} color="#D4960A" />
              <span style={{ color: '#D4960A', flex: 1 }}>Plan <strong>Free</strong> — ograniczone limity.</span>
            </div>
          )}
          <div className="actions-row" style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={() => navigate({ to: '/settings' })}>Ustawienia firmy</Button>
            <Button variant="ghost" onClick={() => navigate({ to: '/team' })}>Zeszół</Button>
          </div>
        </Card>
      </div>

      {isDemoMode && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(212,150,10,0.12)', border: '1px solid rgba(212,150,10,0.30)', borderRadius: 10, fontSize: 13 }}>
          <strong>Tryb demo</strong> — zmiana planu działa natychmiast bez płatności. W produkcji płatności obsługuje Stripe.
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
                  border: isActive ? '2px solid var(--color-brand, #77BA8A)' : undefined,
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
                      <CheckCircle2 size={14} color="var(--color-success, #77BA8A)" style={{ flexShrink: 0 }} />
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
