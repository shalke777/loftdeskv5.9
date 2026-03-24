import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientPortalApi } from '@/features/client-portal/api/client-portal.api'

export const clientKeys = {
  projects:   ['client-projects']     as const,
  project:    (id: string) => ['client-project',   id] as const,
  estimates:  (id: string) => ['client-estimates',  id] as const,
  invoices:   (id: string) => ['client-invoices',   id] as const,
  contracts:  (id: string) => ['client-contracts',  id] as const,
  messages:   (id: string) => ['client-messages',   id] as const,
  approvals:  (id: string) => ['client-approvals',  id] as const,
  documents:  (id: string) => ['client-documents',  id] as const,
  photoDocs:  (id: string) => ['client-photo-docs', id] as const,
  account:    ['client-account'] as const,
}

export function useClientProjects() {
  return useQuery({
    queryKey: clientKeys.projects,
    queryFn:  () => clientPortalApi.listProjects(),
    staleTime: 10_000,
  })
}

export function useClientProject(projectId: string) {
  return useQuery({
    queryKey: clientKeys.project(projectId),
    queryFn:  () => clientPortalApi.getProject(projectId),
    enabled:  Boolean(projectId),
    staleTime: 10_000,
    // A deleted/inaccessible project returns 406 — don't retry, it won't change
    retry: 0,
  })
}

export function useClientEstimates(projectId: string) {
  return useQuery({
    queryKey: clientKeys.estimates(projectId),
    queryFn:  () => clientPortalApi.listEstimates(projectId),
    enabled:  Boolean(projectId),
  })
}

export function useClientInvoices(projectId: string) {
  return useQuery({
    queryKey: clientKeys.invoices(projectId),
    queryFn:  () => clientPortalApi.listInvoices(projectId),
    enabled:  Boolean(projectId),
  })
}

export function useClientContracts(projectId: string) {
  return useQuery({
    queryKey: clientKeys.contracts(projectId),
    queryFn:  () => clientPortalApi.listContracts(projectId),
    enabled:  Boolean(projectId),
  })
}

export function useClientMessages(projectId: string) {
  return useQuery({
    queryKey: clientKeys.messages(projectId),
    queryFn:  () => clientPortalApi.listMessages(projectId),
    enabled:  Boolean(projectId),
    refetchInterval: 15_000,
    staleTime: 5_000,
  })
}

export function useClientSendMessage(projectId: string, companyId: string, senderName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => clientPortalApi.sendMessage(projectId, companyId, body, senderName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.messages(projectId) }),
  })
}

export function useClientDeleteMessage(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) => clientPortalApi.deleteMessage(messageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.messages(projectId) }),
  })
}

export function useClientApprovals(projectId: string) {
  return useQuery({
    queryKey: clientKeys.approvals(projectId),
    queryFn:  () => clientPortalApi.listApprovals(projectId),
    enabled:  Boolean(projectId),
  })
}

export function useClientRespondApproval(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, comment }: { id: string; status: 'accepted' | 'rejected' | 'questioned'; comment?: string }) =>
      clientPortalApi.respondApproval(id, status, comment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.approvals(projectId) }),
  })
}

export function useClientDocuments(projectId: string) {
  return useQuery({
    queryKey: clientKeys.documents(projectId),
    queryFn:  () => clientPortalApi.listProjectDocuments(projectId),
    enabled:  Boolean(projectId),
  })
}

export function useClientPhotoDocs(projectId: string) {
  return useQuery({
    queryKey: clientKeys.photoDocs(projectId),
    queryFn:  () => clientPortalApi.listPhotoDocs(projectId),
    enabled:  Boolean(projectId),
  })
}

export function useClientAccount() {
  return useQuery({
    queryKey: clientKeys.account,
    queryFn:  () => clientPortalApi.getMyAccount(),
    staleTime: 30_000,
  })
}

export function useClientUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fields: { full_name?: string; phone?: string }) => clientPortalApi.updateMyAccount(fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.account }),
  })
}
