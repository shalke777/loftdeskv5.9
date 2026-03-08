import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi, type BillingPlan } from '@/features/billing/api/billing.api'
import { useCompanyId, useAuth } from '@/features/auth'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { getStripe, hasStripeConfig } from '@/shared/lib/stripe'

export function useBillingSummary() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['billing', 'summary', companyId],
    queryFn: () => billingApi.summary(companyId),
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
  const { user } = useAuth()
  const toast = useToast()

  return useMutation({
    mutationFn: async () => {
      if (!hasStripeConfig()) throw new Error('Stripe nie jest skonfigurowany.')
      const { url } = await billingApi.createCheckoutSession(companyId, user?.email ?? '')
      if (url) {
        window.location.assign(url)
      } else {
        const stripe = await getStripe()
        if (!stripe) throw new Error('Nie można załadować Stripe.')
        throw new Error('Brak URL sesji checkout.')
      }
    },
    onError: (error: unknown) => {
      toast.error('Błąd płatności', translateError(error, 'Spróbuj ponownie.'))
    },
  })
}

export function useStripePortal() {
  const { user } = useAuth()
  const toast = useToast()

  return useMutation({
    mutationFn: async () => {
      const { url } = await billingApi.openCustomerPortal(user?.email ?? '')
      if (url) window.location.assign(url)
    },
    onError: (error: unknown) => {
      toast.error('Błąd portalu płatności', translateError(error, 'Spróbuj ponownie.'))
    },
  })
}
