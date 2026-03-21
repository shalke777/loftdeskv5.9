import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { portalApi } from '@/features/portal/api/portal.api'

export function usePortalTokens(companyId: string) {
  return useQuery({
    queryKey: ['portal', 'company-tokens', companyId],
    queryFn: () => portalApi.listCompanyTokens(companyId),
    enabled: Boolean(companyId),
  })
}

export function useDeactivatePortalToken(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tokenId: string) => portalApi.deactivateCompanyToken(companyId, tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'company-tokens', companyId] })
    },
  })
}


