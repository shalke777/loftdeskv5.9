import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { projectsApi } from '@/features/projects/api/projects.api'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
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
      const tempId = crypto.randomUUID()
      const optimistic = {
        id: tempId, company_id: companyId,
        client_id: variables.client_id ?? null,
        number: '…', name: variables.name,
        status: variables.status,
        start_date: variables.start_date ?? null, end_date: variables.end_date ?? null,
        address: variables.address, notes: variables.notes,
        completeness_score: 0, completeness_flags: null, archived_at: null,
        created_at: new Date().toISOString(),
        _optimistic: true,
      } as unknown as Project
      qc.setQueryData<Project[]>(key, (old = []) => [optimistic, ...old])
      return { tempId }
    },
    onSuccess(data, _vars, context) {
      const key = projectKeys.list(companyId)
      qc.setQueryData<Project[]>(key, (old = []) =>
        old.map(p => p.id === context?.tempId
          ? { ...p, ...data, id: context.tempId, serverId: data.id, _optimistic: false }
          : p)
      )
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      qc.invalidateQueries({ queryKey: ['onboarding-progress', companyId] })
      toast.success('Projekt utworzony')
    },
    onError(_err, _vars, context) {
      if (context?.tempId) {
        qc.setQueryData<Project[]>(projectKeys.list(companyId), (old = []) =>
          old.filter(p => p.id !== context.tempId)
        )
      }
      toast.error('Nie udało się utworzyć projektu')
    },
  })
}
export function useCreateProjectFromEstimate() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (estimateId: string) => projectsApi.createFromEstimate(companyId, estimateId), onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); qc.invalidateQueries({ queryKey: ['estimates', 'list', companyId] }); qc.invalidateQueries({ queryKey: ['contracts', companyId] }); qc.invalidateQueries({ queryKey: ['invoices', companyId] }); qc.invalidateQueries({ queryKey: ['onboarding-progress', companyId] }); toast.success('Projekt utworzony z kosztorysu') }, onError: (error) => toast.error('Nie udało się utworzyć projektu', translateError(error)) }) }
export function useUpdateProject() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Project> }) => projectsApi.update(id, input, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.success('Projekt zaktualizowany') }, onError: (error) => toast.error('Nie udało się zapisać projektu', translateError(error)) }) }
export function useUpdateProjectStatus() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: ({ id, status }: { id: string; status: Project['status'] }) => projectsApi.updateStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.info('Status projektu zaktualizowany') }, onError: (error) => toast.error('Nie udało się zmienić statusu projektu', translateError(error)) }) }
export function useCreateInvoiceFromProject() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (config: InvoiceFromProjectConfig) => invoicesApi.createFromProject(companyId, config), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices', companyId] }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.success('Faktura wygenerowana z projektu') }, onError: (error) => toast.error('Nie udało się wygenerować faktury', translateError(error)) }) }
export function useDeleteProject() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => projectsApi.delete(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.info('Projekt usunięty') }, onError: (error) => toast.error('Nie udało się usunąć projektu', translateError(error)) }) }
export function useHardDeleteProject() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => projectsApi.hardDelete(id, companyId), onMutate: (id) => { qc.setQueryData<Project[]>(projectKeys.list(companyId), (old = []) => old.filter(p => p.id !== id)); return { id } }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); qc.invalidateQueries({ queryKey: ['estimates', 'list', companyId] }); qc.invalidateQueries({ queryKey: ['contracts', companyId] }); qc.invalidateQueries({ queryKey: ['invoices', companyId] }); toast.info('Projekt usunięty bezpowrotnie') }, onError: (error, _id, context) => { if (context?.id) qc.invalidateQueries({ queryKey: projectKeys.list(companyId) }); toast.error('Nie udało się usunąć projektu', translateError(error)) } }) }
