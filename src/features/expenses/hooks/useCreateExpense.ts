import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  projectExpensesApi,
  expensesApi,
  type CreateExpenseForProjectInput,
} from '@/features/expenses/api/expenses.api'
import { useAuth, useCompanyId } from '@/features/auth'
import { createTimelineEvent } from '@/features/projects/lib/timeline'

/**
 * Mutation to create an expense for a project.
 * Side effects (fire-and-forget):
 *   1. File upload to Supabase Storage (if file provided)
 *   2. Timeline event: 'expense_created'
 */
export function useCreateExpense(projectId: string) {
  const queryClient = useQueryClient()
  const companyId   = useCompanyId()
  const { user }    = useAuth()

  return useMutation({
    mutationFn: async (payload: Omit<CreateExpenseForProjectInput, 'company_id' | 'project_id'> & { file?: File | null }) => {
      const { file, ...rest } = payload

      // Upload file if provided
      let fileUrl:  string | null = null
      let fileName: string | null = null
      if (file) {
        try {
          const uploaded = await expensesApi.uploadFile(file, companyId)
          fileUrl  = uploaded.url
          fileName = uploaded.name
        } catch {
          // Non-blocking: expense can be saved without file
        }
      }

      return projectExpensesApi.createForProject({
        ...rest,
        company_id: companyId,
        project_id: projectId,
        file_url:   fileUrl,
        file_name:  fileName,
      })
    },

    onSuccess: (expense) => {
      queryClient.invalidateQueries({ queryKey: ['project-expenses', projectId] })

      // Fire-and-forget timeline event
      createTimelineEvent({
        company_id:   companyId,
        project_id:   projectId,
        event_type:   'expense_created',
        visibility:   'internal',
        title:        `Dodano koszt: ${expense.vendor_name ?? expense.vendor ?? 'nieznany sprzedawca'}`,
        description:  expense.invoice_number
          ? `Faktura ${expense.invoice_number} — ${expense.amount_gross ?? '?'} ${expense.currency ?? 'PLN'}`
          : `Kwota: ${expense.amount_gross ?? '?'} ${expense.currency ?? 'PLN'}`,
        actor_type:   'operator',
        actor_id:     user?.id ?? undefined,
        actor_name:   user?.fullName ?? undefined,
        reference_id:   expense.id,
        reference_type: 'expense' as const,
        payload: {
          expense_id:    expense.id,
          vendor_name:   expense.vendor_name ?? expense.vendor,
          gross_amount:  expense.amount_gross,
          currency:      expense.currency ?? 'PLN',
          source_type:   expense.source_type,
          invoice_number: expense.invoice_number,
        },
      }).catch(() => { /* ignore timeline errors */ })
    },
  })
}
