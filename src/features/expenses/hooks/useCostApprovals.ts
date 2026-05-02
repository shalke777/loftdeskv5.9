import { useQuery } from '@tanstack/react-query'
import { costApprovalsApi } from '@/features/expenses/api/cost-approvals.api'
import { useCompanyId } from '@/features/auth'
import type { CostApproval } from '@/features/expenses/api/cost-approvals.api'

export type { CostApproval }

/**
 * Lists all cost approvals for a project (operator view).
 * Refetches every 30 seconds to pick up client responses.
 */
export function useCostApprovals(projectId: string | null) {
  const companyId = useCompanyId()

  return useQuery<CostApproval[]>({
    queryKey:      ['cost-approvals', projectId, companyId],
    queryFn:       () => costApprovalsApi.listForProject(projectId!, companyId),
    enabled:       Boolean(projectId),
    staleTime:     15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}

/**
 * Lists approvals for a specific expense (used in ExpenseApprovalModal to
 * detect if there's already a pending/active approval).
 */
export function useExpenseApprovals(expenseId: string | null) {
  const companyId = useCompanyId()

  return useQuery<CostApproval[]>({
    queryKey: ['expense-approvals', expenseId, companyId],
    queryFn:  () => costApprovalsApi.listForExpense(expenseId!, companyId),
    enabled:  Boolean(expenseId),
    staleTime: 30_000,
  })
}
