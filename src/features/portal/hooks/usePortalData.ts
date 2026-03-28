import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { portalApi } from '@/features/portal/api/portal.api'

// ── Authenticated portal access ───────────────────────────────────────────────

export function usePortalAccessClients(companyId: string) {
  return useQuery({
    queryKey: ['portal', 'access-clients', companyId],
    queryFn: () => portalApi.listPortalAccess(),
    enabled: Boolean(companyId),
  })
}

export function useRevokePortalAccess(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (accessId: string) => portalApi.revokePortalAccess(accessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'access-clients', companyId] })
    },
  })
}

// ── Legacy: estimate-level URL tokens ────────────────────────────────────────

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


