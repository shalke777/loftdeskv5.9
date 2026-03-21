import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { contractsApi } from '@/features/contracts/api/contracts.api'
import { autoLinkService } from '@/services/project/autoLinkService'
import { useToast } from '@/shared/hooks/useToast'
import type { Contract } from '@/entities/contract/model'

const contractKeys = { all: ['contracts'] as const, list: (companyId: string) => [...contractKeys.all, companyId] as const }
export function useContracts() { const companyId = useCompanyId(); return useQuery({ queryKey: contractKeys.list(companyId), queryFn: () => contractsApi.list(companyId) }) }
export function useCreateContract() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: contractsApi.create, onSuccess: (data) => { qc.invalidateQueries({ queryKey: contractKeys.list(companyId) }); toast.success('Umowa utworzona'); if (data.project_id) qc.invalidateQueries({ queryKey: ['project_documents', data.project_id] }); autoLinkService.link({ type: 'contract', id: data.id, companyId, clientId: data.client_id, projectId: data.project_id ?? null, sourceType: 'estimate', sourceId: data.estimate_id ?? null }).catch(() => {}) } }) }
export function useUpdateContract() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Contract> }) => contractsApi.update(id, input, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: contractKeys.list(companyId) }); toast.success('Umowa zaktualizowana') } }) }
export function useSignContract() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => contractsApi.sign(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: contractKeys.list(companyId) }); toast.success('Umowa oznaczona jako podpisana') } }) }
export function useDeleteContract() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => contractsApi.delete(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: contractKeys.list(companyId) }); toast.info('Umowa usunięta') } }) }
