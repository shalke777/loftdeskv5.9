import { useMutation, useQueryClient } from '@tanstack/react-query'
import { contractsApi } from '@/features/contracts/api/contracts.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'

export function useEstimateToContract() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (estimateId: string) => contractsApi.createFromEstimate(companyId, estimateId),
    onSuccess: (contract) => {
      qc.invalidateQueries({ queryKey: ['contracts', companyId] })
      qc.invalidateQueries({ queryKey: ['estimates', 'list', companyId] })
      toast.success('Utworzono umowę', `Numer: ${contract.number}`)
    },
  })
}
