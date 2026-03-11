import { useQuery } from '@tanstack/react-query'
import { projectExpensesApi, type ExpenseInvoiceV4 } from '@/features/expenses/api/expenses.api'
import { useCompanyId } from '@/features/auth'

export function useProjectExpenses(projectId: string | null) {
  const companyId = useCompanyId()

  return useQuery<ExpenseInvoiceV4[]>({
    queryKey: ['project-expenses', projectId, companyId],
    queryFn:  () => projectExpensesApi.listForProject(projectId!, companyId),
    enabled:  Boolean(projectId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
