import type { QueryClient } from '@tanstack/react-query'

/**
 * Registers a watchdog that silently removes a stuck optimistic item from the
 * React Query cache after `ms` milliseconds (default 15 s).
 *
 * Call this at the end of onMutate() and store the returned cancel function
 * in the mutation context.  Call context.cancelWatchdog() in both onSuccess
 * and onError to disarm the timer before it fires.
 *
 * Design invariants:
 *  • Watchdog ONLY removes the item from the cache — it NEVER calls
 *    invalidateQueries.  Reconciliation with the server is exclusively
 *    React Query's responsibility via onSettled → invalidateQueries.
 *  • If isMutationPending() returns true when the timer fires, removal is
 *    deferred by RETRY_INTERVAL (5 s) up to MAX_RETRIES (3) times.
 *    This prevents premature removal on slow networks.
 *  • After MAX_RETRIES defers the item is force-removed regardless, capping
 *    the maximum lifetime of any stuck "creating" item at ms + 3×5s = 30 s.
 *  • The `cancelled` flag is set by the cancel function which is called in
 *    both onSuccess and onError — guaranteeing the watchdog is always a
 *    no-op once the mutation has settled normally.
 *  • Concurrent mutations each have their own independent timer + cancelled
 *    flag keyed by optimisticId — they cannot affect each other.
 *  • On tab close the in-memory cache is discarded, so no orphan persists
 *    across page reloads.
 *
 * Slow-network scenario (server responds at 16 s, timer at 15 s):
 *  15s — timer fires, isMutationPending() === true → deferred (retry 1)
 *  16s — onSuccess fires → _deactivate() → cancelWatchdog() → cancelled=true
 *  20s — deferred timer fires → cancelled=true → no-op ✓
 *
 * Permanent-loss scenario (server never responds):
 *  15s — timer fires, isMutationPending() === true → deferred (retry 1)
 *  20s — still pending → deferred (retry 2)
 *  25s — still pending → deferred (retry 3 = MAX_RETRIES)
 *  30s — MAX_RETRIES exhausted → item force-removed ✓
 *  (React Query's own retry/timeout will eventually call onError which is
 *   also fine — cancelWatchdog is idempotent and the filter is a no-op.)
 */

const RETRY_INTERVAL = 5_000
const MAX_RETRIES    = 3

export function scheduleOptimisticCleanup<T extends { id: string }>(
  qc:                  QueryClient,
  queryKey:            readonly unknown[],
  optimisticId:        string,
  isMutationPending:   () => boolean = () => false,
  ms = 15_000,
): () => void {
  let cancelled = false
  let retries   = 0
  let timerId:  number

  const attempt = () => {
    if (cancelled) return

    if (isMutationPending() && retries < MAX_RETRIES) {
      retries++
      timerId = window.setTimeout(attempt, RETRY_INTERVAL)
      return
    }

    // Mutation has settled or MAX_RETRIES exhausted — silently drop the item.
    qc.setQueryData<T[]>(queryKey, (old) =>
      old?.filter(
        (item) =>
          !(
            item.id === optimisticId &&
            (item as Record<string, unknown>)['_status'] === 'creating'
          ),
      ) ?? old,
    )
  }

  timerId = window.setTimeout(attempt, ms)

  return () => {
    cancelled = true
    window.clearTimeout(timerId)
  }
}
