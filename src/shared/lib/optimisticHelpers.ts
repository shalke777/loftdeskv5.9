import type { QueryClient } from '@tanstack/react-query'

/**
 * Registers a one-shot watchdog that silently removes a stuck optimistic item
 * from the React Query cache after `ms` milliseconds (default 15 s).
 *
 * Usage:
 *   const cancelWatchdog = scheduleOptimisticCleanup(qc, key, optimisticId)
 *   // Store cancelWatchdog in mutation context.
 *   // Call context.cancelWatchdog() in BOTH onSuccess and onError.
 *
 * Design:
 *  • `cancelled` is set to true when cancelWatchdog() is called from onSuccess
 *    or onError — i.e. React Query lifecycle is the only mutation state.
 *    No custom FSM, no retry loop, no mutationActive flag.
 *  • If the mutation settles normally, cancelWatchdog() fires first and the
 *    timer becomes a no-op regardless of when it actually runs.
 *  • If neither onSuccess nor onError ever fires (permanent network loss, RQ
 *    internal edge case), the timer fires, finds the item still has
 *    _status==='creating', and silently removes it.  The list re-syncs on the
 *    next onSettled/invalidation or navigation.
 *  • Watchdog NEVER calls invalidateQueries — server reconciliation is
 *    exclusively React Query's via onSettled → invalidateQueries.
 *  • Concurrent mutations are isolated: each call creates independent
 *    `cancelled` + `timer` closures keyed by their own optimisticId.
 *  • Tab close discards the in-memory cache entirely — no orphan persists.
 */
export function scheduleOptimisticCleanup<T extends { id: string }>(
  qc:           QueryClient,
  queryKey:     readonly unknown[],
  optimisticId: string,
  ms = 15_000,
): () => void {
  let cancelled = false

  const timer = window.setTimeout(() => {
    if (cancelled) return
    qc.setQueryData<T[]>(queryKey, (old) =>
      old?.filter(
        (item) =>
          !(
            item.id === optimisticId &&
            (item as Record<string, unknown>)['_status'] === 'creating'
          ),
      ) ?? old,
    )
  }, ms)

  return () => {
    cancelled = true
    window.clearTimeout(timer)
  }
}
