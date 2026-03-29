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

export function usePortalProjectSummaries(projectIds: string[]) {
  const key = [...projectIds].sort().join(',')
  return useQuery({
    queryKey: ['portal', 'project-summaries', key],
    queryFn: () => portalApi.listProjectSummaries(projectIds),
    enabled: projectIds.length > 0,
    staleTime: 30_000,
  })
}

export function useProjectPortalAccess(projectId: string) {
  return useQuery({
    queryKey: ['portal', 'project-access', projectId],
    queryFn: () => portalApi.getProjectAccess(projectId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })
}

export function useRevokeProjectAccess(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (accessId: string) => portalApi.revokePortalAccess(accessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'project-access', projectId] })
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


