import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { autoLinkService } from '@/services/project/autoLinkService'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import { scheduleOptimisticCleanup } from '@/shared/lib/optimisticHelpers'
import type { Invoice } from '@/entities/invoice/model'

const invoiceKeys = { all: ['invoices'] as const, list: (companyId: string) => [...invoiceKeys.all, companyId] as const }
export function useInvoices() { const companyId = useCompanyId(); return useQuery({ queryKey: invoiceKeys.list(companyId), queryFn: () => invoicesApi.list(companyId) }) }
export function useInvoiceDetail(id: string | undefined, enabled = true) {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['invoices', 'detail', companyId, id],
    queryFn: () => invoicesApi.get(id as string, companyId),
    enabled: !!id && !!companyId && enabled,
    staleTime: 30_000,
  })
}
export function useCreateInvoice() {
  const companyId = useCompanyId()
  const qc        = useQueryClient()
  const toast     = useToast()
  return useMutation({
    mutationFn: invoicesApi.create,
    async onMutate(variables) {
      const key = invoiceKeys.list(companyId)
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Invoice[]>(key)
      const optimisticId = `temp-${crypto.randomUUID()}`
      const optimistic = {
        id: optimisticId, company_id: companyId, _status: 'creating',
        client_id: variables.client_id ?? null,
        project_id: variables.project_id ?? null,
        contract_id: variables.contract_id ?? null,
        number: null, status: 'draft',
        issue_date: variables.issue_date,
        due_date: variables.due_date ?? null,
        total_net: 0, total_gross: 0,
        ksef_status: null, ksef_ref: null,
        items: variables.items ?? [],
        created_at: new Date().toISOString(),
      } as unknown as Invoice
      qc.setQueryData<Invoice[]>(key, (old = []) => [optimistic, ...old])
      let mutationActive = true
      const cancelWatchdog = scheduleOptimisticCleanup<Invoice>(qc, key, optimisticId, () => mutationActive)
      return { previous, optimisticId, cancelWatchdog, _deactivate() { mutationActive = false } }
    },
    onSuccess(data, _vars, context) {
      context?._deactivate?.()
      context?.cancelWatchdog?.()
      const key = invoiceKeys.list(companyId)
      qc.setQueryData<Invoice[]>(key, (old = []) =>
        old.map(i => i.id === context?.optimisticId ? data : i)
      )
      qc.invalidateQueries({ queryKey: ['dashboard', companyId] })
      if (data.project_id) qc.invalidateQueries({ queryKey: ['project_documents', data.project_id] })
      toast.success('Faktura utworzona')
      autoLinkService.link({
        type: 'invoice', id: data.id, companyId,
        clientId: data.client_id, projectId: data.project_id ?? null,
        sourceType: 'contract', sourceId: data.contract_id ?? null,
      }).then(() => {
        if (data.project_id) qc.invalidateQueries({ queryKey: ['projects', companyId] })
      }).catch((err) => console.warn('[autoLink] invoice link failed:', err))
    },
    onError(_err, _vars, context) {
      context?._deactivate?.()
      context?.cancelWatchdog?.()
      if (context?.previous !== undefined)
        qc.setQueryData(invoiceKeys.list(companyId), context.previous)
      toast.error('Nie udało się utworzyć faktury', translateError(_err))
    },
    onSettled() {
      qc.invalidateQueries({ queryKey: invoiceKeys.list(companyId) })
    },
  })
}
export function useUpdateInvoice() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<Invoice> }) => invoicesApi.update(id, input, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: invoiceKeys.list(companyId) }); toast.success('Faktura zaktualizowana') }, onError: (error) => toast.error('Nie udało się zaktualizować faktury', translateError(error)) }) }
export function useDeleteInvoice() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => invoicesApi.delete(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: invoiceKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); qc.invalidateQueries({ queryKey: ['project_documents'] }); toast.info('Faktura usunięta') }, onError: (error) => toast.error('Nie udało się usunąć faktury', translateError(error)) }) }
export function useMarkInvoicePaid() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => invoicesApi.markPaid(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: invoiceKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.success('Faktura oznaczona jako opłacona') }, onError: (error) => toast.error('Nie udało się oznaczyć faktury jako opłaconej', translateError(error)) }) }
export function useSendInvoiceToKsef() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => invoicesApi.sendToKsef(id, companyId), onSuccess: () => { qc.invalidateQueries({ queryKey: invoiceKeys.list(companyId) }); toast.success('Faktura dodana do kolejki KSeF') }, onError: (error) => toast.error('Nie udało się dodać do kolejki KSeF', translateError(error)) }) }
export function useCreateInvoiceFromEstimate() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (estimateId: string) => invoicesApi.createFromEstimate(companyId, estimateId), onSuccess: (data, estimateId) => { qc.invalidateQueries({ queryKey: invoiceKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.success('Faktura wygenerowana z kosztorysu'); if (data.project_id) qc.invalidateQueries({ queryKey: ['project_documents', data.project_id] }); autoLinkService.link({ type: 'invoice', id: data.id, companyId, clientId: data.client_id, projectId: data.project_id ?? null, sourceType: 'estimate', sourceId: estimateId }).catch((err) => console.warn('[autoLink] invoice-from-estimate link failed:', err)) }, onError: (error) => toast.error('Nie udało się wygenerować faktury', translateError(error)) }) }
export function useCreateInvoiceFromContract() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (contractId: string) => invoicesApi.createFromContract(companyId, contractId), onSuccess: (data) => { qc.invalidateQueries({ queryKey: invoiceKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.success('Faktura wygenerowana z umowy'); if (data.project_id) qc.invalidateQueries({ queryKey: ['project_documents', data.project_id] }); autoLinkService.link({ type: 'invoice', id: data.id, companyId, clientId: data.client_id, projectId: data.project_id ?? null, sourceType: 'contract', sourceId: data.contract_id ?? null }).catch((err) => console.warn('[autoLink] invoice-from-contract link failed:', err)) }, onError: (error) => toast.error('Nie udało się wygenerować faktury', translateError(error)) }) }
export function useFinalizeInvoice() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (id: string) => invoicesApi.finalize(id, companyId), onSuccess: (number) => { qc.invalidateQueries({ queryKey: invoiceKeys.list(companyId) }); qc.invalidateQueries({ queryKey: ['dashboard', companyId] }); toast.success(`Faktura wystawiona — ${number}`) }, onError: (error) => toast.error('Nie udało się wystawić faktury', translateError(error)) }) }
export function useCreateCorrection() { const companyId = useCompanyId(); const qc = useQueryClient(); const toast = useToast(); return useMutation({ mutationFn: (originalId: string) => invoicesApi.createCorrection(companyId, originalId), onSuccess: () => { qc.invalidateQueries({ queryKey: invoiceKeys.list(companyId) }); toast.success('Korekta utworzona jako szkic — uzupełnij powód korekty i wystaw') }, onError: (error) => toast.error('Nie udało się utworzyć korekty', translateError(error)) }) }
