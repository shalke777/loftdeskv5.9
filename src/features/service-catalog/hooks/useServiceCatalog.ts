import { useQuery } from '@tanstack/react-query'
import { serviceCatalogApi } from '@/features/service-catalog/api/service-catalog.api'

const catalogKeys = {
  all: ['service-catalog'] as const,
  list: () => [...catalogKeys.all, 'list'] as const,
  byCategory: (category: string) => [...catalogKeys.all, 'category', category] as const,
}

/** All active catalog items (cached, read-only, staleTime 10 min) */
export function useServiceCatalog() {
  return useQuery({
    queryKey: catalogKeys.list(),
    queryFn: () => serviceCatalogApi.list(),
    staleTime: 10 * 60 * 1000,
  })
}

/** Active items for a specific category */
export function useServiceCatalogByCategory(category: string) {
  return useQuery({
    queryKey: catalogKeys.byCategory(category),
    queryFn: () => serviceCatalogApi.listByCategory(category),
    staleTime: 10 * 60 * 1000,
    enabled: !!category,
  })
}
