import type { Contract, CreateContractInput } from '@/entities/contract/model'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { applyScope, getDataScope, withScope } from '@/shared/lib/dataScope'

export const contractsApi = {
  async list(companyId: string): Promise<Contract[]> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.contracts.list(companyId))
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('contracts').select('*').order('created_at', { ascending: false }), scope)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((row: any) => ({ id: row.id, company_id: row.company_id ?? companyId, client_id: row.client_id, project_id: row.project_id, estimate_id: row.estimate_id ?? null, number: row.number, status: row.status, sign_date: row.sign_date, start_date: row.start_date ?? null, end_date: row.end_date ?? null, location: row.location ?? '', value: Number(row.value ?? 0), value_net: row.value_net != null ? Number(row.value_net) : undefined, vat_rate: row.vat_rate != null ? Number(row.vat_rate) : undefined, notes: row.notes ?? '', template_name: row.template_name ?? '', template_content: row.template_content ?? '', custom_paragraphs: row.custom_paragraphs ?? [], tranches: row.tranches ?? [], created_at: row.created_at }))
  },
  async create(input: CreateContractInput): Promise<Contract> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.contracts.create(input as Contract))
    const scope = await getDataScope(input.company_id)
    const payload = withScope(scope, { number: `UMW/${new Date().getFullYear()}/${Date.now().toString().slice(-4)}`, client_id: input.client_id, project_id: input.project_id ?? null, estimate_id: input.estimate_id ?? null, status: input.status, sign_date: input.sign_date, start_date: input.start_date ?? null, end_date: input.end_date ?? null, location: input.location ?? null, value: input.value, value_net: input.value_net ?? null, vat_rate: input.vat_rate ?? null, notes: input.notes ?? null, template_name: input.template_name ?? null, template_content: input.template_content ?? null, custom_paragraphs: input.custom_paragraphs ?? [], tranches: input.tranches ?? [] })
    const { data, error } = await supabase.from('contracts').insert(payload).select('*').single(); if (error) throw error
    return { id: data.id, company_id: data.company_id ?? input.company_id, client_id: data.client_id, project_id: data.project_id, estimate_id: data.estimate_id ?? null, number: data.number, status: data.status, sign_date: data.sign_date, start_date: data.start_date ?? null, end_date: data.end_date ?? null, location: data.location ?? '', value: Number(data.value ?? 0), value_net: data.value_net != null ? Number(data.value_net) : undefined, vat_rate: data.vat_rate != null ? Number(data.vat_rate) : undefined, notes: data.notes ?? '', template_name: data.template_name ?? '', template_content: data.template_content ?? '', custom_paragraphs: data.custom_paragraphs ?? [], tranches: data.tranches ?? [], created_at: data.created_at }
  },
  async update(id: string, input: Partial<Contract>, companyId?: string) { if (isDemoMode || !supabase) return Promise.resolve(demoDb.contracts.update(id, input)); const scope = await getDataScope(companyId); const query = applyScope(supabase.from('contracts').update(input).eq('id', id).select('*').single(), scope); const { data, error } = await query; if (error) throw error; return data },
  async createFromEstimate(companyId: string, estimateId: string): Promise<Contract> { if (isDemoMode || !supabase) return Promise.resolve(demoDb.contracts.createFromEstimate(companyId, estimateId)); throw new Error('Workflow estimate → umowa wymaga mapowania estimate do contract po stronie funkcji.') },
  async sign(id: string, companyId?: string) { if (isDemoMode || !supabase) { demoDb.contracts.sign(id); return Promise.resolve() } const scope = await getDataScope(companyId); const query = applyScope(supabase.from('contracts').update({ status: 'signed', sign_date: new Date().toISOString().slice(0, 10) }).eq('id', id), scope); const { error } = await query; if (error) throw error },
  async delete(id: string, companyId?: string) { if (isDemoMode || !supabase) { demoDb.contracts.delete(id); return Promise.resolve() } const scope = await getDataScope(companyId); const query = applyScope(supabase.from('contracts').delete().eq('id', id), scope); const { error } = await query; if (error) throw error },
}
