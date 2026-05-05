import type { QueryClient } from '@tanstack/react-query'

/**
 * Registers a watchdog that removes an in-flight optimistic item from the
 * React Query cache after `ms` milliseconds (default 15 s).
 *
 * Call this at the end of onMutate() and store the returned cancel function
 * in the mutation context.  Call context.cancelWatchdog() in both onSuccess
 * and onError to disarm the timer before it fires.
 *
 * Guarantees:
 *  • No stuck "_status: 'creating'" item survives longer than `ms`.
 *  • After cleanup an invalidateQueries re-fetches real server state so the
 *    list is consistent even if the server completed the insert.
 *  • Concurrent mutations each have their own independent timer keyed by
 *    optimisticId — they cannot affect each other.
 *  • On tab close the in-memory cache is discarded entirely on next load,
 *    so no orphan can persist across page reloads.
 */
export function scheduleOptimisticCleanup<T extends { id: string }>(
  qc:          QueryClient,
  queryKey:    readonly unknown[],
  optimisticId: string,
  ms = 15_000,
): () => void {
  const timer = window.setTimeout(() => {
    qc.setQueryData<T[]>(queryKey, (old) =>
      old?.filter((item) =>
        !(item.id === optimisticId && (item as Record<string, unknown>)['_status'] === 'creating'),
      ),
    )
    // Trigger a background refetch so the list converges to server state.
    void qc.invalidateQueries({ queryKey })
  }, ms)

  return () => window.clearTimeout(timer)
}
