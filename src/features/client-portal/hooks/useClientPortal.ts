import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clientPortalApi } from '@/features/client-portal/api/client-portal.api'
import { useCompanyId } from '@/features/auth/hooks/useAuth'

// Guard: companyId resolves to 'demo-company' when session is not yet loaded.
// Never fire queries against the DB with that placeholder.
function isRealCompanyId(id: string | null | undefined): id is string {
  return Boolean(id) && id !== 'demo-company'
}

export const clientKeys = {
  projects:   (companyId: string) => ['client-projects', companyId] as const,
  project:    (id: string, companyId: string) => ['client-project', id, companyId] as const,
  estimates:  (id: string) => ['client-estimates',  id] as const,
  invoices:   (id: string) => ['client-invoices',   id] as const,
  contracts:  (id: string) => ['client-contracts',  id] as const,
  messages:   (id: string) => ['client-messages',   id] as const,
  approvals:  (id: string) => ['client-approvals',  id] as const,
  account:    ['client-account'] as const,
}

export function useClientProjects() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: clientKeys.projects(companyId),
    queryFn:  () => clientPortalApi.listProjects(companyId),
    enabled:  isRealCompanyId(companyId),
    staleTime: 10_000,
  })
}

export function useClientProject(projectId: string) {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: clientKeys.project(projectId, companyId),
    queryFn:  () => clientPortalApi.getProject(projectId, companyId),
    enabled:  Boolean(projectId) && isRealCompanyId(companyId),
    staleTime: 10_000,
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
