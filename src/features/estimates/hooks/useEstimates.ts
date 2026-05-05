import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { estimatesApi } from '@/features/estimates/api/estimates.api'
import { autoLinkService } from '@/services/project/autoLinkService'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { scheduleOptimisticCleanup } from '@/shared/lib/optimisticHelpers'
import { supabase } from '@/shared/lib/supabase'
import type { Estimate } from '@/entities/estimate/model'

export const estimateKeys = { all: ['estimates'] as const, list: (companyId: string) => [...estimateKeys.all, 'list', companyId] as const }

export function useEstimates() {
  const companyId   = useCompanyId()
  const queryClient = useQueryClient()

  // Realtime: gdy klient zatwierdzi dokument → trigger DB aktualizuje status
  // w cost_estimates → ta subskrypcja odświeża listę natychmiast (~1-2s)
  useEffect(() => {
    if (!companyId || !supabase) return
    const channel = supabase
      .channel(`estimates-status:${companyId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'cost_estimates',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: estimateKeys.list(companyId) })
        },
      )
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [companyId, queryClient])

  return useQuery({ queryKey: estimateKeys.list(companyId), queryFn: () => estimatesApi.list(companyId) })
}

export function useEstimateDetail(id: string | undefined, enabled = true) {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['estimates', 'detail', companyId, id],
    queryFn: () => estimatesApi.get(id as string, companyId),
    enabled: !!id && !!companyId && enabled,
    staleTime: 30_000,
  })
}
export function useCreateEstimate() {
  const companyId   = useCompanyId()
  const queryClient = useQueryClient()
  const toast       = useToast()
  return useMutation({
    mutationFn: estimatesApi.create,
    async onMutate(variables) {
      const key = estimateKeys.list(companyId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Estimate[]>(key)
      const optimisticId = `temp-${crypto.randomUUID()}`
      const optimistic = {
        id: optimisticId, company_id: companyId, _status: 'creating',
        client_id: variables.client_id ?? null,
        project_id: variables.project_id ?? null,
        number: '…', name: variables.name,
        status: variables.status,
        estimate_type: variables.estimate_type ?? 'preliminary',
        total_net: 0, total_gross: 0,
        notes: variables.notes ?? '',
        valid_until: variables.valid_until ?? null,
        items: variables.items ?? [],
        created_at: new Date().toISOString(),
      } as unknown as Estimate
      queryClient.setQueryData<Estimate[]>(key, (old = []) => [optimistic, ...old])
      let mutationActive = true
      const cancelWatchdog = scheduleOptimisticCleanup<Estimate>(queryClient, key, optimisticId, () => mutationActive)
      return { previous, optimisticId, cancelWatchdog, _deactivate() { mutationActive = false } }
    },
    onSuccess(data, _vars, context) {
      context?._deactivate?.()
      context?.cancelWatchdog?.()
      const key = estimateKeys.list(companyId)
      queryClient.setQueryData<Estimate[]>(key, (old = []) =>
        old.map(e => e.id === context?.optimisticId ? data : e)
      )
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', companyId] })
      toast.success('Kosztorys utworzony')
      autoLinkService.link({
        type: 'estimate', id: data.id, companyId,
        clientId: data.client_id, projectId: data.project_id ?? null,
      }).then(() => {
        if (data.project_id) queryClient.invalidateQueries({ queryKey: ['projects', companyId] })
      }).catch((err) => console.warn('[autoLink] estimate link failed:', err))
    },
    onError(error: any, _vars, context) {
      context?._deactivate?.()
      context?.cancelWatchdog?.()
      if (context?.previous !== undefined)
        queryClient.setQueryData(estimateKeys.list(companyId), context.previous)
      const msg = error?.message ?? error?.details ?? 'Sprawdź połączenie i spróbuj ponownie'
      toast.error('Nie udało się utworzyć kosztorysu', msg)
      console.error('[estimates] create error:', error)
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: estimateKeys.list(companyId) })
    },
  })
}
export function useUpdateEstimate() { const companyId = useCompanyId(); const queryClient = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Estimate> }) => estimatesApi.update(id, input, companyId), onSuccess: (data) => { const updated = data as Estimate; queryClient.setQueryData<Estimate[]>(estimateKeys.list(companyId), (old = []) => old.map(e => e.id === updated.id ? updated : e)); queryClient.invalidateQueries({ queryKey: estimateKeys.list(companyId) }); toast.success('Kosztorys zaktualizowany'); if (updated.project_id) { autoLinkService.link({ type: 'estimate', id: updated.id, companyId, clientId: updated.client_id, projectId: updated.project_id }).then(() => { queryClient.invalidateQueries({ queryKey: ['projects', companyId] }) }).catch((err) => console.warn('[autoLink] estimate update link failed:', err)) } }, onError: (error: any) => { const msg = error?.message ?? error?.details ?? 'Sprawdź połączenie i spróbuj ponownie'; toast.error('Błąd zapisu wyceny', msg); console.error('[estimates] update error:', error) } }) }
export function useDeleteEstimate() { const companyId = useCompanyId(); const queryClient = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => estimatesApi.delete(id, companyId), onSuccess: (_, id) => { queryClient.setQueryData<Estimate[]>(estimateKeys.list(companyId), (old = []) => old.filter(e => e.id !== id)); queryClient.invalidateQueries({ queryKey: estimateKeys.list(companyId) }); queryClient.invalidateQueries({ queryKey: ['project_documents'] }); toast.info('Kosztorys usunięty') }, onError: (error) => toast.error('Nie udało się usunąć kosztorysu', translateError(error)) }) }
