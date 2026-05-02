import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { costApprovalsApi } from '@/features/expenses/api/cost-approvals.api'
import { useCompanyId } from '@/features/auth'
import { supabase, isDemoMode } from '@/shared/lib/supabase'
import type { CostApproval } from '@/features/expenses/api/cost-approvals.api'

export type { CostApproval }

/**
 * Lists all cost approvals for a project (operator view).
 * Realtime primary — client responses arrive instantly.
 * Slow polling fallback only in case Realtime channel drops.
 */
export function useCostApprovals(projectId: string | null) {
  const companyId   = useCompanyId()
  const queryClient = useQueryClient()
  const queryKey    = ['cost-approvals', projectId, companyId] as const

  // Realtime: client accepted/declined → refresh approval list immediately
  useEffect(() => {
    if (!projectId || !supabase || isDemoMode) return
    const channel = supabase
      .channel(`cost-approvals:${projectId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'cost_approvals',
          filter: `project_id=eq.${projectId}`,
        },
        () => { void queryClient.invalidateQueries({ queryKey }) },
      )
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [projectId, queryClient]) // eslint-disable-line react-hooks/exhaustive-deps

  return useQuery<CostApproval[]>({
    queryKey,
    queryFn:       () => costApprovalsApi.listForProject(projectId!, companyId),
    enabled:       Boolean(projectId),
    staleTime:     30_000,
    refetchInterval: 120_000,
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
