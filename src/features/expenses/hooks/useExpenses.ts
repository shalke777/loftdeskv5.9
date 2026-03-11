import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expensesApi, ExpenseInvoice, ParsedExpenseData } from '../api/expenses.api'

export const useExpenses = (companyId: string) =>
  useQuery({
    queryKey: ['expenses', companyId],
    queryFn: () => expensesApi.list(companyId),
    enabled: !!companyId,
    staleTime: 30_000,
  })

export const useCreateExpense = (companyId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      fileUrl?: string
      fileName?: string
      parsed?: ParsedExpenseData
      projectId?: string | null
    }) => expensesApi.create({ companyId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses', companyId] }),
  })
}

export const useUpdateExpense = (companyId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseInvoice> }) =>
      expensesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses', companyId] }),
  })
}

export const useDeleteExpense = (companyId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses', companyId] }),
  })
}
