import { useMutation, useQueryClient } from '@tanstack/react-query'
import { portalRespondApproval } from '@/features/portal/api/portal-project.api'
import type { ApprovalStatus } from '@/features/expenses/api/cost-approvals.api'

export interface RespondApprovalPayload {
  approval_id:    string
  status:         Extract<ApprovalStatus, 'accepted' | 'rejected' | 'questioned'>
  client_comment?: string
}

/**
 * Portal-side mutation: client responds to a cost approval.
 *
 * Idempotency:
 *  - `response_idempotency_key` is generated client-side as crypto.randomUUID()
 *    once per mutation call — double-tapping the button calls mutate() again,
 *    but the second call returns 'already_responded' from the RPC, which we
 *    treat as success (no error shown, list refreshes with current status).
 *
 * Edge cases:
 *  - Returns 'already_processed' if approval is no longer pending_client.
 *  - Returns 'error' on network/session failure.
 *  - All three return codes result in the query being invalidated so the
 *    UI shows the current state.
 */
export function useRespondToCostApproval(sessionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: RespondApprovalPayload) =>
      portalRespondApproval(sessionId, {
        approval_id:              payload.approval_id,
        status:                   payload.status,
        client_comment:           payload.client_comment,
        // UUID generated per call to guarantee per-call idempotency
        response_idempotency_key: crypto.randomUUID(),
      }),

    onSettled: () => {
      // Always refresh the approvals list after any response attempt
      // so the UI reflects current state (even after double-tap / session issue)
      queryClient.invalidateQueries({ queryKey: ['portal-approvals', sessionId] })
    },

    onSuccess: (result) => {
      // 'already_responded' or 'already_processed' are soft non-errors —
      // the list will refresh with the current status above.
      if (result === 'error') {
        throw new Error('Nie można przetworzyć odpowiedzi. Odśwież stronę i spróbuj ponownie.')
      }
    },
  })
}
