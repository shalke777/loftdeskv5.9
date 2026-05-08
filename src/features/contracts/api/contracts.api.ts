import type { Contract, CreateContractInput } from '@/entities/contract/model'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { applyScope, getDataScope, withScope } from '@/shared/lib/dataScope'
import { projectDocumentsApi } from '@/features/projects/api/projectDocuments.api'

export const contractsApi = {
  async list(companyId: string): Promise<Contract[]> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.contracts.list(companyId))
    const scope = await getDataScope(companyId)
    const cols = 'id, company_id, client_id, project_id, estimate_id, number, status, sign_date, start_date, end_date, location, value, value_net, vat_rate, notes, template_name, penalty_per_day_pct, max_penalty_pct, tranches, custom_paragraphs, created_at'
    const query = applyScope(supabase.from('contracts').select(cols).order('created_at', { ascending: false }).limit(50), scope)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((row: any) => ({ id: row.id, company_id: row.company_id ?? companyId, client_id: row.client_id, project_id: row.project_id, estimate_id: row.estimate_id ?? null, number: row.number, status: row.status, sign_date: row.sign_date, start_date: row.start_date ?? null, end_date: row.end_date ?? null, location: row.location ?? '', value: Number(row.value ?? 0), value_net: row.value_net != null ? Number(row.value_net) : undefined, vat_rate: row.vat_rate != null ? Number(row.vat_rate) : undefined, notes: row.notes ?? '', template_name: row.template_name ?? '', template_content: '', custom_paragraphs: row.custom_paragraphs ?? [], tranches: row.tranches ?? [], penalty_per_day_pct: row.penalty_per_day_pct != null ? Number(row.penalty_per_day_pct) : undefined, max_penalty_pct: row.max_penalty_pct != null ? Number(row.max_penalty_pct) : undefined, created_at: row.created_at }))
  },
  async create(input: CreateContractInput): Promise<Contract> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.contracts.create(input as Contract))
    const scope = await getDataScope(input.company_id)

    // Resolve sequential contract number via DB function (atomic, per-company, per-year-month)
    // Pass sign_date so backdated contracts get the correct month in the number (e.g. UM/2026/01/1)
    let contractNumber: string
    const { data: numData, error: numError } = await supabase.rpc('next_doc_number', { p_company_id: input.company_id, p_doc_type: 'contract', p_issue_date: input.sign_date ?? null })
    if (numError || !numData) {
      // Fallback: count-based, uses sign_date month when available
      const ref = input.sign_date ? new Date(input.sign_date) : new Date()
      const monthStart = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-01`
      const { count } = await supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', input.company_id).gte('created_at', monthStart)
      contractNumber = `UM/${ref.getFullYear()}/${String(ref.getMonth() + 1).padStart(2, '0')}/${(count ?? 0) + 1}`
    } else {
      contractNumber = numData as string
    }

    const payload = withScope(scope, { number: contractNumber, client_id: input.client_id, project_id: input.project_id ?? null, estimate_id: input.estimate_id ?? null, status: input.status, sign_date: input.sign_date, start_date: input.start_date ?? null, end_date: input.end_date ?? null, location: input.location ?? null, value: input.value, value_net: input.value_net ?? null, vat_rate: input.vat_rate ?? null, notes: input.notes ?? null, template_name: input.template_name ?? null, template_content: input.template_content ?? null, custom_paragraphs: input.custom_paragraphs ?? [], tranches: input.tranches ?? [], penalty_per_day_pct: input.penalty_per_day_pct ?? null, max_penalty_pct: input.max_penalty_pct ?? null })
    const { data, error } = await supabase.from('contracts').insert(payload).select('*').single(); if (error) throw error
    if (input.project_id) { try { await projectDocumentsApi.link(input.company_id, input.project_id, 'contract', data.id, { manual: true }) } catch (err) { console.warn('[contracts] project document link failed:', err) } }
    return { id: data.id, company_id: data.company_id ?? input.company_id, client_id: data.client_id, project_id: data.project_id, estimate_id: data.estimate_id ?? null, number: data.number, status: data.status, sign_date: data.sign_date, start_date: data.start_date ?? null, end_date: data.end_date ?? null, location: data.location ?? '', value: Number(data.value ?? 0), value_net: data.value_net != null ? Number(data.value_net) : undefined, vat_rate: data.vat_rate != null ? Number(data.vat_rate) : undefined, notes: data.notes ?? '', template_name: data.template_name ?? '', template_content: data.template_content ?? '', custom_paragraphs: data.custom_paragraphs ?? [], tranches: data.tranches ?? [], penalty_per_day_pct: data.penalty_per_day_pct != null ? Number(data.penalty_per_day_pct) : undefined, max_penalty_pct: data.max_penalty_pct != null ? Number(data.max_penalty_pct) : undefined, created_at: data.created_at }
  },
  async update(id: string, input: Partial<Contract>, companyId?: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.contracts.update(id, input))
    const scope = await getDataScope(companyId)
    // Explicit whitelist — prevents unknown columns from crashing the update
    const patch: Record<string, unknown> = {}
    const allowed = ['client_id','project_id','estimate_id','status','sign_date','start_date','end_date','location','value','value_net','vat_rate','notes','template_name','template_content','custom_paragraphs','tranches','penalty_per_day_pct','max_penalty_pct'] as const
    for (const key of allowed) { if (key in input) patch[key] = (input as any)[key] }
    const query = applyScope(supabase.from('contracts').update(patch).eq('id', id).select('*').single(), scope)
    const { data, error } = await query
    if (error) throw error
    return data
  },
  async createFromEstimate(companyId: string, estimateId: string): Promise<Contract> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.contracts.createFromEstimate(companyId, estimateId))
    const { data: estimate, error: estErr } = await supabase.from('cost_estimates').select('*').eq('id', estimateId).single()
    if (estErr || !estimate) throw estErr ?? new Error('Nie znaleziono kosztorysu')
    return contractsApi.create({
      company_id: companyId,
      client_id: estimate.client_id,
      project_id: estimate.project_id ?? null,
      estimate_id: estimateId,
      status: 'unsigned',
      sign_date: null,
      value: Number(estimate.total_gross ?? 0),
      value_net: estimate.total_net != null ? Number(estimate.total_net) : undefined,
      vat_rate: estimate.vat_rate != null ? Number(estimate.vat_rate) : undefined,
      notes: `Wygenerowano z kosztorysu ${estimate.number ?? estimateId}`,
      template_name: `Umowa · ${estimate.number ?? ''}`,
      template_content: '',
      custom_paragraphs: [],
      tranches: [
        { id: crypto.randomUUID(), label: 'Zaliczka', amount: Math.round(Number(estimate.total_gross ?? 0) * 0.3 * 100) / 100, percent: 30, due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), status: 'planned', condition: 'Przed rozpoczęciem robót' },
        { id: crypto.randomUUID(), label: 'Płatność końcowa', amount: Math.round(Number(estimate.total_gross ?? 0) * 0.7 * 100) / 100, percent: 70, due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), status: 'planned', condition: 'Po odbiorze końcowym' },
      ],
    })
  },
  async sign(id: string, companyId?: string) { if (isDemoMode || !supabase) { demoDb.contracts.sign(id); return Promise.resolve() } const scope = await getDataScope(companyId); const query = applyScope(supabase.from('contracts').update({ status: 'signed', sign_date: new Date().toISOString().slice(0, 10) }).eq('id', id), scope); const { error } = await query; if (error) throw error },
  async delete(id: string, companyId?: string) {
    if (isDemoMode || !supabase) { demoDb.contracts.delete(id); return Promise.resolve() }
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('contracts').delete().eq('id', id), scope)
    const { error } = await query
    if (error) throw error
    // Archive any project_documents rows that reference this contract (best-effort)
    supabase.from('project_documents')
      .update({ archived_at: new Date().toISOString() })
      .eq('doc_type', 'contract')
      .eq('doc_id', id)
      .is('archived_at', null)
      .then(() => {})
  },
}
