/**
 * useOfflineMutation — wraps a mutation with offline queue fallback (B1)
 *
 * When navigator.onLine = false:
 *   - Enqueues the mutation payload in IndexedDB
 *   - Calls onOfflineEnqueued callback (for toast feedback)
 *   - Does NOT throw — user sees optimistic feedback
 *
 * When online:
 *   - Executes the real mutation normally
 *
 * Usage:
 *   const { mutate } = useOfflineMutation({
 *     queueType: 'expense:create',
 *     onlineFn: (payload) => expensesApi.create(payload),
 *     onOfflineEnqueued: () => toast.info('Zapisano offline'),
 *   })
 */

import { useState, useCallback } from 'react'
import { enqueue } from '@/shared/lib/offlineQueue'
import { registerOfflineHandler } from '@/shared/ui/OfflineBanner'

interface UseOfflineMutationOptions<TPayload, TResult> {
  /** Unique type string used to identify this mutation in the queue */
  queueType: string
  /** The real async mutation function (called when online) */
  onlineFn: (payload: TPayload) => Promise<TResult>
  /** Called when mutation was enqueued (offline path). Use for toast. */
  onOfflineEnqueued?: () => void
  /** Called on success (online path) */
  onSuccess?: (result: TResult) => void
  /** Called on error (online path only) */
  onError?: (error: unknown) => void
  /** Handler to replay this mutation type — registers globally */
  replayFn?: (payload: TPayload) => Promise<void>
}

export function useOfflineMutation<TPayload, TResult = unknown>({
  queueType,
  onlineFn,
  onOfflineEnqueued,
  onSuccess,
  onError,
  replayFn,
}: UseOfflineMutationOptions<TPayload, TResult>) {
  const [loading, setLoading] = useState(false)

  // Register replay handler globally once
  if (replayFn) {
    registerOfflineHandler(queueType, replayFn as (payload: unknown) => Promise<unknown>)
  }

  const mutate = useCallback(
    async (payload: TPayload) => {
      if (!navigator.onLine) {
        await enqueue(queueType, payload)
        onOfflineEnqueued?.()
        return
      }

      setLoading(true)
      try {
        const result = await onlineFn(payload)
        onSuccess?.(result)
        return result
      } catch (err) {
        onError?.(err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [queueType, onlineFn, onOfflineEnqueued, onSuccess, onError],
  )

  return { mutate, loading }
}
