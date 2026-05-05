import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { contractsApi } from '@/features/contracts/api/contracts.api'
import { autoLinkService } from '@/services/project/autoLinkService'
import { useToast } from '@/shared/hooks/useToast'
import { scheduleOptimisticCleanup } from '@/shared/lib/optimisticHelpers'
import type { Contract } from '@/entities/contract/model'

const contractKeys = { all: ['contracts'] as const, list: (companyId: string) => [...contractKeys.all, companyId] as const }
export function useContracts() { const companyId = useCompanyId(); return useQuery({ queryKey: contractKeys.list(companyId), queryFn: () => contractsApi.list(companyId) }) }
export function useCreateContract() {
  const companyId = useCompanyId()
  const qc        = useQueryClient()
  const toast     = useToast()
  return useMutation({
    mutationFn: contractsApi.create,
    async onMutate(variables) {
      const key = contractKeys.list(companyId)
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Contract[]>(key)
      const optimisticId = `temp-${crypto.randomUUID()}`
      const optimistic = {
        id: optimisticId, company_id: companyId, _status: 'creating',
        client_id: variables.client_id ?? null,
        project_id: variables.project_id ?? null,
        estimate_id: variables.estimate_id ?? null,
        number: '…', status: 'unsigned',
        sign_date: variables.sign_date ?? null,
        start_date: variables.start_date ?? null,
        end_date: variables.end_date ?? null,
        location: variables.location ?? '',
        value: variables.value ?? 0,
        notes: variables.notes ?? '',
        tranches: variables.tranches ?? [],
        custom_paragraphs: variables.custom_paragraphs ?? [],
        created_at: new Date().toISOString(),
      } as unknown as Contract
      qc.setQueryData<Contract[]>(key, (old = []) => [optimistic, ...old])
      let mutationActive = true
      const cancelWatchdog = scheduleOptimisticCleanup<Contract>(qc, key, optimisticId, () => mutationActive)
      return { previous, optimisticId, cancelWatchdog, _deactivate() { mutationActive = false } }
    },
    onSuccess(data, _vars, context) {
      context?._deactivate?.()
      context?.cancelWatchdog?.()
      const key = contractKeys.list(companyId)
      qc.setQueryData<Contract[]>(key, (old = []) =>
        old.map(c => c.id === context?.optimisticId ? data : c)
      )
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      if (data.project_id) qc.invalidateQueries({ queryKey: ['project_documents', data.project_id] })
      toast.success('Umowa utworzona')
      autoLinkService.link({
        type: 'contract', id: data.id, companyId,
        clientId: data.client_id, projectId: data.project_id ?? null,
        sourceType: 'estimate', sourceId: data.estimate_id ?? null,
      }).then(() => {
        if (data.project_id) qc.invalidateQueries({ queryKey: ['projects', companyId] })
      }).catch((err) => console.warn('[autoLink] contract link failed:', err))
    },
    onError(error: any, _vars, context) {
      context?._deactivate?.()
      context?.cancelWatchdog?.()
      if (context?.previous !== undefined)
        qc.setQueryData(contractKeys.list(companyId), context.previous)
      toast.error('Nie udało się utworzyć umowy', error?.message ?? 'Spróbuj ponownie.')
    },
    onSettled() {
      qc.invalidateQueries({ queryKey: contractKeys.list(companyId) })
    },
  })
}
export function useUpdateContract() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Contract> }) => contractsApi.update(id, input, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: contractKeys.list(companyId) }); toast.success('Umowa zaktualizowana') }, onError: (error: any) => toast.error('Nie udało się zaktualizować umowy', error?.message ?? 'Spróbuj ponownie.') }) }
export function useSignContract() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => contractsApi.sign(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: contractKeys.list(companyId) }); toast.success('Umowa oznaczona jako podpisana') }, onError: (error: any) => toast.error('Nie udało się oznaczyć umowy jako podpisanej', error?.message ?? 'Spróbuj ponownie.') }) }
export function useDeleteContract() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => contractsApi.delete(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: contractKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['project_documents'] }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.info('Umowa usunięta') }, onError: (error: any) => toast.error('Nie udało się usunąć umowy', error?.message ?? 'Spróbuj ponownie.') }) }
