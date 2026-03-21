import { useMutation, useQueryClient } from '@tanstack/react-query'
import { contractsApi } from '@/features/contracts/api/contracts.api'
import { autoLinkService } from '@/services/project/autoLinkService'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'

export function useEstimateToContract() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (estimateId: string) => contractsApi.createFromEstimate(companyId, estimateId),
    onSuccess: (contract, estimateId) => {
      qc.invalidateQueries({ queryKey: ['contracts', companyId] })
      qc.invalidateQueries({ queryKey: ['estimates', 'list', companyId] })
      toast.success('Utworzono umowę', `Numer: ${contract.number}`)
      if (contract.project_id) qc.invalidateQueries({ queryKey: ['project_documents', contract.project_id] })
      autoLinkService.link({
        type: 'contract',
        id: contract.id,
        companyId,
        clientId: contract.client_id,
        projectId: contract.project_id ?? null,
        sourceType: 'estimate',
        sourceId: estimateId,
      }).catch(() => {})
    },
  })
}
