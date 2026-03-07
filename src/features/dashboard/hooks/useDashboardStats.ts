import { useQuery } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { dashboardApi } from '@/features/dashboard/api/dashboard.api'

export function useDashboardStats() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['dashboard', companyId],
    queryFn: () => dashboardApi.getStats(companyId),
  })
}
