import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { portalApi } from '@/features/portal/api/portal.api'

export function usePortalData(token: string) {
  return useQuery({
    queryKey: ['portal', token],
    queryFn: () => portalApi.get(token),
    refetchInterval: 10000,
  })
}

export function usePortalChat(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: string) => portalApi.sendMessage(token, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', token] })
    },
  })
}

export function usePortalIdentity(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (clientName: string) => portalApi.saveClientName(token, clientName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal', token] }),
  })
}

export function usePortalDecision(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (decision: 'accepted' | 'rejected') => portalApi.decide(token, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal', token] }),
  })
}

export function usePortalTokens(companyId: string) {
  return useQuery({
    queryKey: ['portal', 'company-tokens', companyId],
    queryFn: () => portalApi.listCompanyTokens(companyId),
    enabled: Boolean(companyId),
  })
}

export function useCreatePortalToken(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ estimateId, userId, clientName }: { estimateId: string; userId: string; clientName: string }) =>
      portalApi.createCompanyToken(companyId, estimateId, userId, clientName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'company-tokens', companyId] })
      queryClient.invalidateQueries({ queryKey: ['estimates'] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', companyId] })
    },
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

export function usePortalApprovalDecision(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, comment }: { id: string; decision: 'accepted' | 'rejected' | 'revision_requested'; comment?: string }) => portalApi.decideApproval(id, decision, comment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal', token] }),
  })
}

export function usePortalProtocolDecision(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'accepted' | 'rejected' }) => portalApi.decideProtocol(id, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal', token] }),
  })
}

export function usePortalStandardAccept(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => portalApi.acceptStandard(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal', token] }),
  })
}
