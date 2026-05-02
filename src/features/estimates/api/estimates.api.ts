import type { CreateEstimateInput, Estimate } from '@/entities/estimate/model'
import { calcTotals } from '@/features/estimates/lib/estimate.calculations'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { applyScope, getDataScope, withScope } from '@/shared/lib/dataScope'
import { projectDocumentsApi } from '@/features/projects/api/projectDocuments.api'

export const estimatesApi = {
  async list(companyId: string): Promise<Estimate[]> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.estimates.list(companyId))
    const scope = await getDataScope(companyId)
    // LIST endpoint: NO nested items (perf RULE: payload < 20KB, no nested *).
    // Items are loaded lazily on-demand via estimatesApi.get(id) when row is expanded.
    const cols = 'id, company_id, client_id, project_id, number, name, status, estimate_type, total_net, total_gross, notes, valid_until, created_at'
    const query = applyScope(supabase.from('cost_estimates').select(cols).order('created_at', { ascending: false }).limit(50), scope)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((row: any) => ({ id: row.id, company_id: row.company_id ?? companyId, client_id: row.client_id, project_id: row.project_id ?? null, number: row.number, name: row.name, status: row.status, estimate_type: (row.estimate_type ?? 'preliminary') as 'preliminary' | 'final', total_net: Number(row.total_net ?? 0), total_gross: Number(row.total_gross ?? 0), notes: row.notes ?? '', valid_until: row.valid_until ?? null, created_at: row.created_at, items: [] }))
  },
  async get(id: string, companyId: string): Promise<Estimate | null> {
    if (isDemoMode || !supabase) {
      const all = demoDb.estimates.list(companyId)
      return Promise.resolve(all.find(e => e.id === id) ?? null)
    }
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('cost_estimates').select('*, items:cost_estimate_items(id, name, description, unit, quantity, unit_price, vat_rate, sort_order, catalog_item_id)').eq('id', id), scope)
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    if (!data) return null
    const row: any = data
    return {
      id: row.id, company_id: row.company_id ?? companyId, client_id: row.client_id,
      project_id: row.project_id ?? null, number: row.number, name: row.name, status: row.status,
      estimate_type: (row.estimate_type ?? 'preliminary') as 'preliminary' | 'final',
      total_net: Number(row.total_net ?? 0), total_gross: Number(row.total_gross ?? 0),
      notes: row.notes ?? '', valid_until: row.valid_until ?? null, created_at: row.created_at,
      items: (row.items ?? []).map((item: any, index: number) => ({
        id: item.id, name: item.name ?? item.description, description: item.description ?? '',
        unit: item.unit, quantity: Number(item.quantity), unit_price: Number(item.unit_price),
        vat_rate: Number(item.vat_rate ?? 23), sort_order: item.sort_order ?? index,
        catalog_item_id: item.catalog_item_id ?? null,
      })),
    }
  },
  async create(input: CreateEstimateInput): Promise<Estimate> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.estimates.create({ company_id: input.company_id, client_id: input.client_id, name: input.name, status: input.status ?? 'draft', estimate_type: input.estimate_type ?? 'preliminary', notes: input.notes, valid_until: input.valid_until ?? null, items: input.items ?? [] }))
    const items = input.items ?? []
    const totals = calcTotals(items)
    const scope = await getDataScope(input.company_id)

    // Resolve sequential estimate number via DB function (atomic, per-company, per-year-month)
    let estimateNumber: string
    const { data: numData, error: numError } = await supabase.rpc('next_doc_number', { p_company_id: input.company_id, p_doc_type: 'estimate' })
    if (numError || !numData) {
      // Fallback: count-based, month-aware (non-atomic, safe for single-user edge case)
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const { count } = await supabase.from('cost_estimates').select('*', { count: 'exact', head: true }).eq('company_id', input.company_id).gte('created_at', monthStart)
      estimateNumber = `WY/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${(count ?? 0) + 1}`
    } else {
      estimateNumber = numData as string
    }

    const payload = withScope(scope, { number: estimateNumber, name: input.name, client_id: input.client_id, project_id: input.project_id ?? null, status: input.status ?? 'draft', estimate_type: input.estimate_type ?? 'preliminary', total_net: totals.net, total_gross: totals.gross, notes: input.notes ?? null, valid_until: input.valid_until ?? null, ai_source_run_id: input.ai_source_run_id ?? null })
    const { data, error } = await supabase.from('cost_estimates').insert(payload).select('*').single()
    if (error) throw error
    if (items.length > 0) {
      const itemRows = items.map((item, index) => ({
        cost_estimate_id: data.id,
        name: item.name ?? item.description ?? '',
        description: item.description ?? item.name ?? '',
        unit: item.unit ?? 'm²',
        quantity: (typeof item.quantity === 'number' && item.quantity > 0) ? item.quantity : 1,
        unit_price: item.unit_price ?? 0,
        vat_rate: item.vat_rate ?? 8,
        sort_order: item.sort_order ?? index,
        catalog_item_id: item.catalog_item_id ?? null,
      }))
      const { error: itemsError } = await supabase.from('cost_estimate_items').insert(itemRows)
      if (itemsError) {
        console.error('[estimates.create] items insert failed:', itemsError)
        throw itemsError
      }
    }
    if (input.project_id) { try { await projectDocumentsApi.link(input.company_id, input.project_id, 'estimate', data.id, { manual: true }) } catch (err) { console.warn('[estimates] project doc link failed on create:', err) } }
    return { id: data.id, company_id: data.company_id ?? input.company_id, client_id: data.client_id, project_id: data.project_id ?? null, number: data.number, name: data.name, status: data.status, estimate_type: (data.estimate_type ?? 'preliminary') as 'preliminary' | 'final', total_net: totals.net, total_gross: totals.gross, notes: data.notes ?? '', valid_until: data.valid_until ?? null, created_at: data.created_at, items }
  },
  async update(id: string, input: Partial<Estimate>, companyId?: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.estimates.update(id, input))
    const items = input.items
    // Explicit whitelist — never spread the full Estimate object into the PATCH body.
    // Sending company_id / id / created_at / number causes PostgREST to either try to
    // update immutable columns or trigger RLS WITH CHECK violations → 400.
    const payload: any = {}
    if (input.name !== undefined) payload.name = input.name
    if (input.status !== undefined) payload.status = input.status
    if (input.estimate_type !== undefined) payload.estimate_type = input.estimate_type
    if (input.client_id !== undefined) payload.client_id = input.client_id ?? null
    if (input.project_id !== undefined) payload.project_id = input.project_id ?? null
    if (input.notes !== undefined) payload.notes = input.notes
    if (input.valid_until !== undefined) payload.valid_until = input.valid_until
    if (items) {
      const totals = calcTotals(items)
      payload.total_net = totals.net
      payload.total_gross = totals.gross
    }
    const { data, error } = await supabase.from('cost_estimates').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    if (items) {
      const { error: deleteError } = await supabase.from('cost_estimate_items').delete().eq('cost_estimate_id', id)
      if (deleteError) {
        console.error('[estimates.update] items delete failed:', deleteError)
        throw deleteError
      }
      if (items.length > 0) {
        const itemRows = items.map((item, index) => ({ cost_estimate_id: id, name: item.name ?? item.description ?? '', description: item.description ?? item.name ?? '', unit: item.unit ?? 'szt', quantity: item.quantity, unit_price: item.unit_price, vat_rate: item.vat_rate ?? 23, sort_order: item.sort_order ?? index, catalog_item_id: item.catalog_item_id ?? null }))
        const { error: itemsError } = await supabase.from('cost_estimate_items').insert(itemRows)
        if (itemsError) throw itemsError
      }
    }
    if (payload.project_id && companyId) {
      try { await projectDocumentsApi.link(companyId, payload.project_id, 'estimate', id, { manual: true }) } catch (err) { console.warn('[estimates] project doc link failed on update:', err) }
    }
    const { data: refreshed } = await supabase.from('cost_estimates').select('*, items:cost_estimate_items(*)').eq('id', id).single()
    return refreshed ?? data
  },
  async delete(id: string, companyId?: string) {
    if (isDemoMode || !supabase) { demoDb.estimates.delete(id); return Promise.resolve() }
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('cost_estimates').delete().eq('id', id), scope)
    const { error } = await query
    if (error) throw error
    // Archive any project_documents rows that reference this estimate (best-effort)
    supabase.from('project_documents')
      .update({ archived_at: new Date().toISOString() })
      .eq('doc_type', 'estimate')
      .eq('doc_id', id)
      .is('archived_at', null)
      .then(() => {}, (err) => console.warn('[estimates] archive project doc failed on delete:', err))
  },
}
