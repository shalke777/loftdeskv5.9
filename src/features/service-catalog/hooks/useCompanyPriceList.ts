import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { companyPriceListApi } from '../api/company-price-list.api'

function priceListKey(companyId: string) {
  return ['company_price_list', companyId] as const
}

/** Returns a Map<catalog_item_id, unit_price> for quick lookup in pickers */
export function useCompanyPriceList() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: priceListKey(companyId),
    queryFn: () => companyPriceListApi.getByCompany(companyId),
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  })
}

/** Mutation: upsert a single price entry */
export function useUpsertPrice() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ catalogItemId, unitPrice }: { catalogItemId: string; unitPrice: number }) =>
      companyPriceListApi.upsertPrice(companyId, catalogItemId, unitPrice),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
    },
  })
}

/** Mutation: bulk upsert prices from an estimate save */
export function useUpsertManyPrices() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entries: Array<{ catalog_item_id: string; unit_price: number }>) =>
      companyPriceListApi.upsertMany(companyId, entries),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
    },
  })
}
