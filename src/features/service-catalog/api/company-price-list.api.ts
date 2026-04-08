import { isDemoMode, supabase } from '@/shared/lib/supabase'

export interface CompanyPriceEntry {
  catalog_item_id: string
  unit_price: number
  updated_at: string
}

export const companyPriceListApi = {
  /** Fetch all price entries for a company (returns Map for O(1) lookup) */
  async getByCompany(companyId: string): Promise<Map<string, number>> {
    if (isDemoMode || !supabase) return new Map()

    const { data, error } = await supabase
      .from('company_price_list')
      .select('catalog_item_id, unit_price')
      .eq('company_id', companyId)

    if (error) throw error
    const map = new Map<string, number>()
    for (const row of data ?? []) {
      map.set(row.catalog_item_id, Number(row.unit_price))
    }
    return map
  },

  /** Upsert a single price entry (insert or update) */
  async upsertPrice(companyId: string, catalogItemId: string, unitPrice: number): Promise<void> {
    if (isDemoMode || !supabase || unitPrice <= 0) return

    const { error } = await supabase
      .from('company_price_list')
      .upsert(
        {
          company_id: companyId,
          catalog_item_id: catalogItemId,
          unit_price: unitPrice,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,catalog_item_id' }
      )

    if (error) throw error
  },

  /** Bulk upsert — call after saving estimate to record all used prices */
  async upsertMany(
    companyId: string,
    entries: Array<{ catalog_item_id: string; unit_price: number }>
  ): Promise<void> {
    if (isDemoMode || !supabase) return
    const rows = entries
      .filter((e) => e.unit_price > 0)
      .map((e) => ({
        company_id: companyId,
        catalog_item_id: e.catalog_item_id,
        unit_price: e.unit_price,
        updated_at: new Date().toISOString(),
      }))
    if (rows.length === 0) return

    const { error } = await supabase
      .from('company_price_list')
      .upsert(rows, { onConflict: 'company_id,catalog_item_id' })

    if (error) throw error
  },
}
