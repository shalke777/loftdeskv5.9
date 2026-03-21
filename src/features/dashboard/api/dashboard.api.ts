import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { clientsApi } from '@/features/clients/api/clients.api'
import { estimatesApi } from '@/features/estimates/api/estimates.api'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { projectsApi } from '@/features/projects/api/projects.api'
import { contractsApi } from '@/features/contracts/api/contracts.api'
import { settingsApi } from '@/features/settings/api/settings.api'

export const dashboardApi = {
  async getStats(companyId: string) {
    if (isDemoMode || !supabase) {
      return demoDb.dashboard(companyId)
    }

    // Fetch all entities in parallel; use allSettled so one failure doesn't
    // blank the whole dashboard — each indicator handles its own empty fallback.
    const [
      clientsRes,
      estimatesRes,
      invoicesRes,
      projectsRes,
      contractsRes,
      profileRes,
    ] = await Promise.allSettled([
      clientsApi.list(companyId),
      estimatesApi.list(companyId),
      invoicesApi.list(companyId),
      projectsApi.list(companyId),
      contractsApi.list(companyId),
      settingsApi.profile(companyId),
    ])

    const clients   = clientsRes.status   === 'fulfilled' ? clientsRes.value   : []
    const estimates = estimatesRes.status === 'fulfilled' ? estimatesRes.value : []
    const invoices  = invoicesRes.status  === 'fulfilled' ? invoicesRes.value  : []
    const projects  = projectsRes.status  === 'fulfilled' ? projectsRes.value  : []
    const contracts = contractsRes.status === 'fulfilled' ? contractsRes.value : []
    const profile   = profileRes.status   === 'fulfilled' ? profileRes.value   : null

    if (import.meta.env.DEV) {
      console.group('[dashboard] getStats — input counts')
      console.log('company_id:', companyId)
      console.log('clients:', clients.length, clientsRes.status === 'rejected' ? `(BŁĄD: ${(clientsRes as PromiseRejectedResult).reason})` : '')
      console.log('estimates:', estimates.length, estimatesRes.status === 'rejected' ? `(BŁĄD: ${(estimatesRes as PromiseRejectedResult).reason})` : '')
      console.log('invoices:', invoices.length, invoicesRes.status === 'rejected' ? `(BŁĄD: ${(invoicesRes as PromiseRejectedResult).reason})` : '')
      console.log('projects:', projects.length, projectsRes.status === 'rejected' ? `(BŁĄD: ${(projectsRes as PromiseRejectedResult).reason})` : '')
      console.log('contracts:', contracts.length, contractsRes.status === 'rejected' ? `(BŁĄD: ${(contractsRes as PromiseRejectedResult).reason})` : '')
      console.log('profile:', profile, profileRes.status === 'rejected' ? `(BŁĄD: ${(profileRes as PromiseRejectedResult).reason})` : '')
      console.groupEnd()
    }

    // --- Pipeline aggregation (mirrors demoDb.dashboard logic) ---
    const usedEstimateIds = new Set<string>()
    const usedContractIds = new Set<string>()
    const pipelineProjects: {
      id: string; name: string; number: string; status: string; clientName: string
      contractValue: number; estimateValue: number; invoicedTotal: number; paidTotal: number
    }[] = []

    for (const proj of projects) {
      const contract = contracts.find((c) => c.project_id === proj.id)
      const estimate = estimates.find((e) => (e as any).project_id === proj.id)
      const projInvoices = invoices.filter((inv) => inv.project_id === proj.id)
      if (contract) usedContractIds.add(contract.id)
      if (estimate) usedEstimateIds.add(estimate.id)
      pipelineProjects.push({
        id: proj.id,
        name: proj.name,
        number: proj.number,
        status: proj.status,
        clientName: clients.find((c) => c.id === proj.client_id)?.name ?? '',
        contractValue: contract?.value ?? 0,
        estimateValue: estimate?.total_gross ?? 0,
        invoicedTotal: projInvoices.reduce((s, inv) => s + inv.total_gross, 0),
        paidTotal: projInvoices.filter((inv) => inv.status === 'paid').reduce((s, inv) => s + inv.total_gross, 0),
        completeness_score: proj.completeness_score ?? null,
      })
    }

    // Standalone contracts (not linked to any project)
    for (const c of contracts.filter((c) => !usedContractIds.has(c.id) && !c.project_id)) {
      const cInvoices = invoices.filter((inv) => inv.contract_id === c.id)
      pipelineProjects.push({
        id: c.id,
        name: c.number,
        number: 'Umowa',
        status: c.status,
        clientName: clients.find((cl) => cl.id === c.client_id)?.name ?? '',
        contractValue: c.value,
        estimateValue: 0,
        invoicedTotal: cInvoices.reduce((s, inv) => s + inv.total_gross, 0),
        paidTotal: cInvoices.filter((inv) => inv.status === 'paid').reduce((s, inv) => s + inv.total_gross, 0),
      })
    }

    // Standalone estimates (not linked to any project)
    for (const e of estimates.filter((e) => !usedEstimateIds.has(e.id) && !(e as any).project_id)) {
      pipelineProjects.push({
        id: e.id,
        name: e.name || e.number,
        number: 'Kosztorys',
        status: e.status,
        clientName: clients.find((cl) => cl.id === e.client_id)?.name ?? '',
        contractValue: 0,
        estimateValue: e.total_gross,
        invoicedTotal: 0,
        paidTotal: 0,
      })
    }

    const pipeline = pipelineProjects.reduce((s, p) => s + (p.contractValue || p.estimateValue), 0)

    const companyName = (profile as any)?.name ?? (profile as any)?.company ?? (profile as any)?.company_name ?? 'LoftDesk'
    const plan: 'free' | 'pro' | 'business' | 'admin' = (profile as any)?.plan ?? 'pro'
    const ksefReady = Boolean((profile as any)?.ksef_token)

    const result = {
      plan,
      companyName,
      clientsCount: clients.length,
      projectsCount: projects.length,
      estimatesCount: estimates.length,
      invoicesCount: invoices.length,
      contractsCount: contracts.length,
      activeProjects: projects.filter((p) => p.status === 'active').length,
      paidRevenue: invoices.filter((inv) => inv.status === 'paid').reduce((s, inv) => s + inv.total_gross, 0),
      pipeline,
      pipelineProjects,
      overdueCount: invoices.filter((inv) => inv.status === 'overdue').length,
      ksefReady,
      recentActivity: [
        estimates.length > 0 ? `Kosztorysy: ${estimates.length} szt.` : null,
        invoices.length > 0 ? `Faktury: ${invoices.length} szt.` : null,
        projects.length > 0 ? `Projekty: ${projects.length} szt.` : null,
      ].filter(Boolean) as string[],
      upcoming: projects.slice(0, 3).map((p) => `${p.name} · ${p.status}`),
    }

    if (import.meta.env.DEV) {
      console.group('[dashboard] getStats — agregacja')
      console.log('activeProjects:', result.activeProjects, '/ projectsCount:', result.projectsCount)
      console.log('paidRevenue:', result.paidRevenue, '| overdueCount:', result.overdueCount)
      console.log('pipeline:', result.pipeline, '| pipelineProjects:', result.pipelineProjects.length)
      console.log('estimatesCount:', result.estimatesCount, '| invoicesCount:', result.invoicesCount, '| contractsCount:', result.contractsCount)
      console.log('companyName:', result.companyName, '| plan:', result.plan, '| ksefReady:', result.ksefReady)
      console.groupEnd()
    }

    return result
  },
}
