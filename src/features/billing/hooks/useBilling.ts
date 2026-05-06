import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi, type BillingPlan } from '@/features/billing/api/billing.api'
import { useCompanyId, useAuth } from '@/features/auth'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { hasStripeConfig } from '@/shared/lib/stripe'

export function useBillingSummary() {
  const companyId = useCompanyId()
  return useQuery({
    // companyId in the key so invalidation by companyId still works in useChangePlan/useProjects.
    // billingApi.summary() ignores the param and resolves company via getDataScope() (DB source of truth).
    queryKey: ['billing', 'summary', companyId],
    queryFn: () => billingApi.summary(companyId),
    // staleTime: 0 — billing controls feature access; always fetch fresh data.
    // This ensures a DB plan change or plan_source update is visible immediately
    // without requiring a hard refresh.
    staleTime: 0,
  })
}

export function useChangePlan() {
  const companyId = useCompanyId()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { refreshSession } = useAuth()

  return useMutation({
    mutationFn: (plan: BillingPlan) => billingApi.changePlan(companyId, plan),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'summary', companyId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] })
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile', companyId] })
      await refreshSession()
      toast.success('Plan zapisany', 'Zmiana planu została zapisana.')
    },
    onError: (error: unknown) => {
      toast.error('Nie udało się zmienić planu', translateError(error, 'Spróbuj ponownie.'))
    },
  })
}

export function useStripeCheckout() {
  const companyId = useCompanyId()
  const toast = useToast()

  return useMutation({
    mutationFn: async (priceId?: string) => {
      if (!hasStripeConfig()) throw new Error('Stripe nie jest skonfigurowany.')
      const { url } = await billingApi.createCheckoutSession(companyId, priceId)
      if (url) {
        window.location.assign(url)
      } else {
        throw new Error('Brak URL sesji checkout.')
      }
    },
    onError: (error: unknown) => {
      toast.error('Błąd płatności', translateError(error, 'Spróbuj ponownie.'))
    },
  })
}

export function useStripePortal() {
  const companyId = useCompanyId()
  const toast = useToast()

  return useMutation({
    mutationFn: async () => {
      const { url } = await billingApi.openCustomerPortal(companyId)
      if (url) window.location.assign(url)
    },
    onError: (error: unknown) => {
      toast.error('Błąd portalu płatności', translateError(error, 'Spróbuj ponownie.'))
    },
  })
}
