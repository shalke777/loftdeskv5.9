import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi, type BillingPlan } from '@/features/billing/api/billing.api'
import { useCompanyId, useAuth } from '@/features/auth'
import { useToast } from '@/shared/hooks/useToast'

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
      toast.error('Nie udało się zmienić planu', error instanceof Error ? error.message : 'Spróbuj ponownie.')
    },
  })
}
