import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expensesApi, ExpenseInvoice, ParsedExpenseData } from '../api/expenses.api'
import { useToast } from '@/shared/hooks/useToast'

export const useExpenses = (companyId: string) =>
  useQuery({
    queryKey: ['expenses', companyId],
    queryFn: () => expensesApi.list(companyId),
    enabled: !!companyId,
    staleTime: 30_000,
  })

export const useCreateExpense = (companyId: string) => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: {
      fileUrl?: string
      fileName?: string
      parsed?: ParsedExpenseData
      projectId?: string | null
      extractionConfidence?: number | null
      parserSource?: 'ai' | 'regex' | 'manual' | 'vision' | null
      extractionWarnings?: string[] | null
      parseRaw?: Record<string, unknown> | null
    }) => expensesApi.create({ companyId, ...input }),
    onSuccess: (data, variables) => {
      // Natychmiastowe dodanie do cache — widoczne od razu
      qc.setQueryData<ExpenseInvoice[]>(['expenses', companyId], (old = []) => [data, ...old])
      if (variables.projectId) {
        qc.setQueryData<ExpenseInvoice[]>(['project-expenses', variables.projectId], (old = []) => [data, ...old])
      }
      qc.invalidateQueries({ queryKey: ['expenses', companyId] })
      if (variables.projectId) {
        qc.invalidateQueries({ queryKey: ['project-expenses', variables.projectId] })
      }
      toast.success('Koszt zapisany')
    },
    onError: (error: any) => toast.error('Nie udało się zapisać kosztu', error?.message ?? 'Spróbuj ponownie.'),
  })
}

export const useUpdateExpense = (companyId: string) => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseInvoice> }) =>
      expensesApi.update(id, data),
    onSuccess: (_, { id, data }) => {
      // Patch in-place without waiting for refetch
      qc.setQueryData<ExpenseInvoice[]>(['expenses', companyId], (old = []) =>
        old.map(e => e.id === id ? { ...e, ...data, updated_at: new Date().toISOString() } : e),
      )
      qc.invalidateQueries({ queryKey: ['expenses', companyId] })
      toast.success('Koszt zaktualizowany')
    },
    onError: (error: any) => toast.error('Nie udało się zaktualizować kosztu', error?.message ?? 'Spróbuj ponownie.'),
  })
}

export const useDeleteExpense = (companyId: string) => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: (_, id) => {
      // Natychmiastowe usunięcie z cache
      qc.setQueryData<ExpenseInvoice[]>(['expenses', companyId], (old = []) => old.filter(e => e.id !== id))
      qc.invalidateQueries({ queryKey: ['expenses', companyId] })
      toast.success('Koszt usunięty')
    },
    onError: (error: any) => toast.error('Nie udało się usunąć kosztu', error?.message ?? 'Spróbuj ponownie.'),
  })
}
