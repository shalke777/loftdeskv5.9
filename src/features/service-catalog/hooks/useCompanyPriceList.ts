import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { useToast } from '@/shared/hooks/useToast'
import { companyPriceListApi, normalizeLabel } from '../api/company-price-list.api'
import type { CompanyPriceEntry } from '../api/company-price-list.api'

export type { CompanyPriceEntry }
export { normalizeLabel }

function priceListKey(companyId: string) {
  return ['company_price_list', companyId] as const
}

function priceListDetailKey(companyId: string) {
  return ['company_price_list_detail', companyId] as const
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

/** Returns a Map<normalized_custom_label, unit_price> for fallback fuzzy lookup */
export function useCompanyCustomPriceMap() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['company_price_list_custom', companyId],
    queryFn: () => companyPriceListApi.getCustomMapByCompany(companyId),
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  })
}

/** Returns full list of entries including custom ones (for settings display) */
export function useCompanyPriceListDetail() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: priceListDetailKey(companyId),
    queryFn: () => companyPriceListApi.listByCompany(companyId),
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId,
  })
}

/** Mutation: upsert a single catalog price entry */
export function useUpsertPrice() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ catalogItemId, unitPrice }: { catalogItemId: string; unitPrice: number }) =>
      companyPriceListApi.upsertPrice(companyId, catalogItemId, unitPrice),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      const msg = error?.message ?? 'Sprawdź połączenie i spróbuj ponownie'
      toast.error('Nie udało się zapisać ceny', msg)
      console.error('[price-list] upsertPrice error:', error)
    },
  })
}

/** Mutation: upsert a single custom (non-catalog) price entry */
export function useUpsertCustomPrice() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ customLabel, unitPrice }: { customLabel: string; unitPrice: number }) =>
      companyPriceListApi.upsertCustomPrice(companyId, customLabel, unitPrice),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      const msg = error?.message ?? 'Sprawdź połączenie i spróbuj ponownie'
      toast.error('Nie udało się zapisać ceny', msg)
      console.error('[price-list] upsertCustomPrice error:', error)
    },
  })
}

/** Mutation: delete a catalog price entry */
export function useDeletePrice() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (catalogItemId: string) =>
      companyPriceListApi.deletePrice(companyId, catalogItemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      toast.error('Nie udało się usunąć ceny', error?.message ?? 'Spróbuj ponownie')
      console.error('[price-list] deletePrice error:', error)
    },
  })
}

/** Mutation: delete a custom price entry */
export function useDeleteCustomPrice() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (customLabel: string) =>
      companyPriceListApi.deleteCustomPrice(companyId, customLabel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      toast.error('Nie udało się usunąć ceny', error?.message ?? 'Spróbuj ponownie')
      console.error('[price-list] deleteCustomPrice error:', error)
    },
  })
}

/** Mutation: bulk upsert — supports catalog and custom entries */
export function useUpsertManyPrices() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (entries: Array<{ catalog_item_id?: string | null; custom_label?: string | null; unit_price: number }>) =>
      companyPriceListApi.upsertMany(companyId, entries),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: priceListKey(companyId) })
      qc.invalidateQueries({ queryKey: priceListDetailKey(companyId) })
    },
    onError: (error: any) => {
      toast.error('Nie udało się zapisać cennika', error?.message ?? 'Spróbuj ponownie')
      console.error('[price-list] upsertMany error:', error)
    },
  })
}
