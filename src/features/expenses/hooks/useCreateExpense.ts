import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  projectExpensesApi,
  expensesApi,
  type CreateExpenseForProjectInput,
} from '@/features/expenses/api/expenses.api'
import { useAuth, useCompanyId } from '@/features/auth'
import { createTimelineEvent } from '@/features/projects/lib/timeline'
import { enqueue } from '@/shared/lib/offlineQueue'
import { registerOfflineHandler } from '@/shared/ui/OfflineBanner'

// Offline expense payload (file omitted — can't upload binary offline)
type ExpenseOfflinePayload = Omit<CreateExpenseForProjectInput, 'company_id' | 'project_id'> & {
  _companyId: string
  _projectId: string
}

// Register global replay handler once (module-level, idempotent)
registerOfflineHandler('expense:create', async (raw: unknown) => {
  const p = raw as ExpenseOfflinePayload
  await projectExpensesApi.createForProject({
    ...p,
    company_id: p._companyId,
    project_id: p._projectId,
    file_url: null,
    file_name: null,
  })
})

/**
 * Mutation to create an expense for a project.
 * Side effects (fire-and-forget):
 *   1. File upload to Supabase Storage (if file provided)
 *   2. Timeline event: 'expense_created'
 *
 * Offline-aware: enqueues to IndexedDB when navigator.onLine = false (file skipped).
 */
export function useCreateExpense(projectId: string) {
  const queryClient = useQueryClient()
  const companyId   = useCompanyId()
  const { user }    = useAuth()

  return useMutation({
    mutationFn: async (payload: Omit<CreateExpenseForProjectInput, 'company_id' | 'project_id'> & { file?: File | null }) => {
      const { file, ...rest } = payload

      // ── Offline path: queue for later sync ────────────────────────────────
      if (!navigator.onLine) {
        await enqueue('expense:create', {
          ...rest,
          _companyId: companyId,
          _projectId: projectId,
        } satisfies ExpenseOfflinePayload)
        // Return synthetic result — UI shows optimistic feedback
        return {
          id: `offline-${Date.now()}`,
          company_id: companyId,
          project_id: projectId,
          ...rest,
        } as any // eslint-disable-line @typescript-eslint/no-explicit-any
      }

      // ── Online path ────────────────────────────────────────────────────────
      // Upload file if provided
      let fileUrl:  string | null = null
      let fileName: string | null = null
      if (file) {
        try {
          const uploaded = await expensesApi.uploadFile(file, companyId)
          fileUrl  = uploaded.url
          fileName = uploaded.name
        } catch (uploadErr) {
          // Non-blocking: expense saved without file — log for debugging
          console.warn('[expenses] File upload failed, saving expense without attachment:', uploadErr)
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

      // Skip timeline event for offline-queued entries (id starts with 'offline-')
      if (String(expense.id).startsWith('offline-')) return

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

