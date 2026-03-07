import type { CreateProjectInput, Project } from '@/entities/project/model'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { applyScope, getDataScope, withScope } from '@/shared/lib/dataScope'

export const projectsApi = {
  async list(companyId: string): Promise<Project[]> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.projects.list(companyId))
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('projects').select('*').order('created_at', { ascending: false }), scope)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((row: any) => ({ id: row.id, company_id: row.company_id ?? companyId, client_id: row.client_id, number: row.number, name: row.name, status: row.status, start_date: row.start_date, end_date: row.end_date, address: row.address ?? '', investment_address: row.investment_address ?? null, notes: row.notes ?? '', completeness_score: Number(row.completeness_score ?? 0), completeness_flags: row.completeness_flags ?? null, archived_at: row.archived_at ?? null, created_at: row.created_at }))
  },
  async create(input: CreateProjectInput): Promise<Project> {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.projects.create(input))
    const scope = await getDataScope(input.company_id)
    const payload = withScope(scope, { number: `PRJ/${new Date().getFullYear()}/${Date.now().toString().slice(-4)}`, client_id: input.client_id, name: input.name, status: input.status, start_date: input.start_date, end_date: input.end_date, address: input.address ?? null, investment_address: input.investment_address ?? null, notes: input.notes ?? null, completeness_score: 0, completeness_flags: {} })
    const { data, error } = await supabase.from('projects').insert(payload).select('*').single()
    if (error) throw error
    return { id: data.id, company_id: data.company_id ?? input.company_id, client_id: data.client_id, number: data.number, name: data.name, status: data.status, start_date: data.start_date, end_date: data.end_date, address: data.address ?? '', investment_address: data.investment_address ?? null, notes: data.notes ?? '', completeness_score: Number(data.completeness_score ?? 0), completeness_flags: data.completeness_flags ?? null, archived_at: data.archived_at ?? null, created_at: data.created_at }
  },
  async update(id: string, input: Partial<Project>, companyId?: string) {
    if (isDemoMode || !supabase) return Promise.resolve(demoDb.projects.update(id, input))
    const scope = await getDataScope(companyId)
    const query = applyScope(supabase.from('projects').update(input).eq('id', id).select('*').single(), scope)
    const { data, error } = await query
    if (error) throw error
    return data
  },
  async createFromEstimate(companyId: string, estimateId: string) {
    if (isDemoMode || !supabase) {
      const project = demoDb.projects.createFromEstimate(companyId, estimateId)
      // Powiąż wycenę z projektem (project_id na estimate)
      const est = demoDb.estimates.list(companyId).find((e: any) => e.id === estimateId)
      if (est) demoDb.estimates.update(estimateId, { ...est, project_id: project.id })
      // Kaskadowo powiąż powiązane umowy
      const relatedContracts = (demoDb.contracts.list(companyId) as any[]).filter((c: any) => c.estimate_id === estimateId)
      for (const contract of relatedContracts) {
        demoDb.contracts.update(contract.id, { project_id: project.id })
        // Faktury z tej umowy
        const relatedInvoices = (demoDb.invoices.list(companyId) as any[]).filter((inv: any) => inv.contract_id === contract.id)
        for (const invoice of relatedInvoices) {
          demoDb.invoices.update(invoice.id, { project_id: project.id })
        }
      }
      return Promise.resolve(project)
    }
    const scope = await getDataScope(companyId)
    // Pobierz dane wyceny
    const { data: est, error: estErr } = await supabase
      .from('cost_estimates')
      .select('id, client_id, name, project_id')
      .eq('id', estimateId)
      .single()
    if (estErr || !est) throw new Error('Nie znaleziono wyceny')
    // Jeśli wycena ma już projekt — zwróć go
    if (est.project_id) {
      const { data: existingProj } = await applyScope(
        supabase.from('projects').select('*').eq('id', est.project_id).single(),
        scope,
      )
      if (existingProj) return existingProj
    }
    // Utwórz nowy projekt
    const year = new Date().getFullYear()
    const payload = withScope(scope, {
      number: `PRJ/${year}/${Date.now().toString().slice(-4)}`,
      client_id: est.client_id,
      name: est.name || 'Projekt z kosztorysu',
      status: 'offer',
      start_date: null,
      end_date: null,
      address: null,
      investment_address: null,
      notes: null,
      completeness_score: 0,
      completeness_flags: {},
    })
    const { data, error } = await supabase.from('projects').insert(payload).select('*').single()
    if (error) throw error
    // Powiąż wycenę z projektem
    await supabase.from('cost_estimates').update({ project_id: data.id }).eq('id', estimateId)
    // Kaskadowo powiąż umowy powiązane z tą wyceną
    const { data: relatedContracts } = await supabase
      .from('contracts')
      .select('id')
      .eq('estimate_id', estimateId)
    if (relatedContracts?.length) {
      const contractIds = relatedContracts.map((c: any) => c.id)
      await supabase.from('contracts').update({ project_id: data.id }).in('id', contractIds)
      // Kaskadowo powiąż faktury z tych umów
      const { data: relatedInvoices } = await supabase
        .from('invoices')
        .select('id')
        .in('contract_id', contractIds)
      if (relatedInvoices?.length) {
        await supabase.from('invoices').update({ project_id: data.id }).in('id', relatedInvoices.map((i: any) => i.id))
      }
    }
    return { id: data.id, company_id: data.company_id ?? companyId, client_id: data.client_id, number: data.number, name: data.name, status: data.status, start_date: data.start_date, end_date: data.end_date, address: data.address ?? '', investment_address: data.investment_address ?? null, notes: data.notes ?? '', completeness_score: data.completeness_score ?? 0, completeness_flags: data.completeness_flags ?? {}, created_at: data.created_at }
  },
  async updateStatus(id: string, status: Project['status'], companyId?: string) { if (isDemoMode || !supabase) { demoDb.projects.updateStatus(id, status); return Promise.resolve() } const scope = await getDataScope(companyId); const query = applyScope(supabase.from('projects').update({ status }).eq('id', id), scope); const { error } = await query; if (error) throw error },
  async delete(id: string, companyId?: string) { if (isDemoMode || !supabase) { demoDb.projects.delete(id); return Promise.resolve() } const scope = await getDataScope(companyId); const query = applyScope(supabase.from('projects').delete().eq('id', id), scope); const { error } = await query; if (error) throw error },
}
