import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { captureError, classifyError } from '@/shared/lib/monitoring'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only report query errors that aren't expected retries
      captureError(error, {
        area: classifyError(error),
        extra: { queryKey: query.queryKey, source: 'QueryCache' },
        level: 'warning',
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      captureError(error, {
        area: classifyError(error),
        extra: { mutationKey: mutation.options.mutationKey, source: 'MutationCache' },
      })
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
})
