import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { projectsApi } from '@/features/projects/api/projects.api'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { scheduleOptimisticCleanup } from '@/shared/lib/optimisticHelpers'
import type { Project } from '@/entities/project/model'
import type { InvoiceFromProjectConfig } from '@/features/projects/components/ProjectInvoiceModal'

const projectKeys = { all: ['projects'] as const, list: (companyId: string) => [...projectKeys.all, companyId] as const }
export function useProjects() { const companyId = useCompanyId(); return useQuery({ queryKey: projectKeys.list(companyId), queryFn: () => projectsApi.list(companyId) }) }
export function useCreateProject() {
  const companyId = useCompanyId()
  const qc        = useQueryClient()
  const toast      = useToast()
  return useMutation({
    mutationFn: projectsApi.create,
    async onMutate(variables) {
      const key = projectKeys.list(companyId)
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Project[]>(key)
      const optimisticId = `temp-${crypto.randomUUID()}`
      const optimistic = {
        id: optimisticId, company_id: companyId, _status: 'creating',
        client_id: variables.client_id ?? null,
        number: '…', name: variables.name,
        status: variables.status,
        start_date: variables.start_date ?? null, end_date: variables.end_date ?? null,
        address: variables.address, notes: variables.notes,
        completeness_score: 0, completeness_flags: null, archived_at: null,
        created_at: new Date().toISOString(),
      } as unknown as Project
      qc.setQueryData<Project[]>(key, (old = []) => [optimistic, ...old])
      const cancelWatchdog = scheduleOptimisticCleanup<Project>(qc, key, optimisticId)
      return { previous, optimisticId, cancelWatchdog }
    },
    onSuccess(data, _vars, context) {
      context?.cancelWatchdog?.()
      const key = projectKeys.list(companyId)
      qc.setQueryData<Project[]>(key, (old = []) =>
        old.map(p => p.id === context?.optimisticId ? data : p)
      )
      toast.success('Projekt utworzony')
    },
    onError(_err, _vars, context) {
      context?.cancelWatchdog?.()
      if (context?.previous !== undefined)
        qc.setQueryData(projectKeys.list(companyId), context.previous)
      toast.error('Nie udało się utworzyć projektu')
    },
    onSettled() {
      qc.invalidateQueries({ queryKey: projectKeys.list(companyId) })
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      qc.invalidateQueries({ queryKey: ['onboarding-progress', companyId] })
    },
  })
}
export function useCreateProjectFromEstimate() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (estimateId: string) => projectsApi.createFromEstimate(companyId, estimateId), onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); qc.invalidateQueries({ queryKey: ['estimates', 'list', companyId] }); qc.invalidateQueries({ queryKey: ['contracts', companyId] }); qc.invalidateQueries({ queryKey: ['invoices', companyId] }); qc.invalidateQueries({ queryKey: ['onboarding-progress', companyId] }); toast.success('Projekt utworzony z kosztorysu') }, onError: (error) => toast.error('Nie udało się utworzyć projektu', translateError(error)) }) }
export function useUpdateProject() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Project> }) => projectsApi.update(id, input, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.success('Projekt zaktualizowany') }, onError: (error) => toast.error('Nie udało się zapisać projektu', translateError(error)) }) }
export function useUpdateProjectStatus() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: ({ id, status }: { id: string; status: Project['status'] }) => projectsApi.updateStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.info('Status projektu zaktualizowany') }, onError: (error) => toast.error('Nie udało się zmienić statusu projektu', translateError(error)) }) }
export function useCreateInvoiceFromProject() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (config: InvoiceFromProjectConfig) => invoicesApi.createFromProject(companyId, config), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices', companyId] }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.success('Faktura wygenerowana z projektu') }, onError: (error) => toast.error('Nie udało się wygenerować faktury', translateError(error)) }) }
export function useDeleteProject() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => projectsApi.delete(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.info('Projekt usunięty') }, onError: (error) => toast.error('Nie udało się usunąć projektu', translateError(error)) }) }
export function useHardDeleteProject() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => projectsApi.hardDelete(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); qc.invalidateQueries({ queryKey: ['estimates', 'list', companyId] }); qc.invalidateQueries({ queryKey: ['contracts', companyId] }); qc.invalidateQueries({ queryKey: ['invoices', companyId] }); toast.info('Projekt usunięty bezpowrotnie') }, onError: (error) => toast.error('Nie udało się usunąć projektu', translateError(error)) }) }
