import type { QueryClient } from '@tanstack/react-query'

/**
 * Registers a watchdog that silently removes a stuck optimistic item from the
 * React Query cache after `ms` milliseconds (default 15 s).
 *
 * Call this at the end of onMutate() and store the returned cancel function
 * in the mutation context.  Call context.cancelWatchdog() in both onSuccess
 * and onError to disarm the timer before it fires.
 *
 * Design constraints:
 *  • Watchdog ONLY removes the item from the cache — it never calls
 *    invalidateQueries.  Reconciliation with the server is exclusively
 *    React Query's responsibility via onSettled → invalidateQueries.
 *  • If the server response arrives after the watchdog fires, onSuccess
 *    replaces by id (no-op since item is gone) then onSettled triggers the
 *    authoritative refetch — no double-refetch, no flicker.
 *  • If the mutation never resolves (permanent network loss), the stale item
 *    is silently removed.  The list refreshes on the next navigation or focus.
 *  • Concurrent mutations each have their own independent timer keyed by
 *    optimisticId — they cannot affect each other.
 *  • On tab close the in-memory cache is discarded on next load, so no
 *    orphan can persist across page reloads.
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
    // Silently drop only the stuck optimistic item — do NOT invalidate.
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
