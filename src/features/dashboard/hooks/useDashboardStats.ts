import { useQuery } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { dashboardApi } from '@/features/dashboard/api/dashboard.api'

export function useDashboardStats() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['dashboard', companyId],
    queryFn: () => dashboardApi.getStats(companyId),
    // Dashboard aggregation is expensive (6 queries or 1 RPC).
    // 30s stale window prevents redundant refetches on tab focus.
    // Mutations (create invoice/project/etc.) invalidate this key directly.
    staleTime: 30_000,
  })
}
