import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  costApprovalsApi,
  type CreateApprovalInput,
  type CancelApprovalInput,
} from '@/features/expenses/api/cost-approvals.api'
import { useAuth, useCompanyId } from '@/features/auth'

/**
 * Mutation: operator sends an expense for client approval.
 *
 * On success:
 *  - Invalidates ['cost-approvals', projectId]
 *  - Invalidates ['project-expenses', projectId] (so approval_status refreshes)
 *  - Invalidates ['expense-approvals', expenseId]
 */
export function useCreateCostApproval(projectId: string) {
  const queryClient = useQueryClient()
  const companyId   = useCompanyId()
  const { user }    = useAuth()

  const create = useMutation({
    mutationFn: (input: Omit<CreateApprovalInput, 'company_id' | 'actor_id' | 'actor_name'>) =>
      costApprovalsApi.create({
        ...input,
        company_id: companyId,
        actor_id:   user?.id   ?? undefined,
        actor_name: user?.fullName ?? undefined,
      }),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cost-approvals',    projectId,       companyId] })
      queryClient.invalidateQueries({ queryKey: ['project-expenses',  projectId,       companyId] })
      queryClient.invalidateQueries({ queryKey: ['expense-approvals', variables.expense_id, companyId] })
    },
  })

  const cancel = useMutation({
    mutationFn: (input: Omit<CancelApprovalInput, 'company_id'>) =>
      costApprovalsApi.cancel({ ...input, company_id: companyId }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-approvals',   projectId, companyId] })
      queryClient.invalidateQueries({ queryKey: ['project-expenses', projectId, companyId] })
    },
  })

  return { create, cancel }
}
