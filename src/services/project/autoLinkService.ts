import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { demoDb } from '@/shared/lib/demoDb'
import { projectDocumentsApi } from '@/features/projects/api/projectDocuments.api'
import type { ProjectDocument } from '@/entities/project/model'

export type DocType = ProjectDocument['doc_type']

export interface AutoLinkInput {
  type: DocType
  id: string
  companyId: string
  clientId?: string | null
  /** Jeśli doc już ma project_id → fast path, tylko wstaw do project_documents */
  projectId?: string | null
  address?: string | null
  sourceType?: DocType | null
  sourceId?: string | null
}

/** Uproszczona odległość Levenshteina (adresy < 200 znaków) */
function lev(a: string, b: string): number {
  const al = a.length
  const bl = b.length
  const m: number[][] = Array.from({ length: al + 1 }, (_, i) =>
    Array.from({ length: bl + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= al; i++)
    for (let j = 1; j <= bl; j++)
      m[i][j] =
        a[i - 1] === b[j - 1] ? m[i - 1][j - 1] : 1 + Math.min(m[i - 1][j], m[i][j - 1], m[i - 1][j - 1])
  return m[al][bl]
}

async function insertTimeline(
  companyId: string,
  projectId: string,
  action: string,
  details: Record<string, unknown>,
) {
  if (isDemoMode || !supabase) return
  await supabase
    .from('project_timeline')
    .insert({ company_id: companyId, project_id: projectId, action, details })
}

async function recomputeCompleteness(projectId: string, companyId: string) {
  if (isDemoMode || !supabase) return
  const { data } = await supabase
    .from('project_documents')
    .select('doc_type')
    .eq('project_id', projectId)
    .is('archived_at', null)
  const types = new Set((data ?? []).map((r: { doc_type: string }) => r.doc_type))
  const flags = {
    has_client: true,
    has_estimate: types.has('estimate'),
    has_contract: types.has('contract'),
    has_invoice: types.has('invoice'),
    has_protocol: types.has('protocol'),
    has_note: types.has('note'),
  }
  const score = Math.min(
    20 * (flags.has_estimate ? 1 : 0) +
    25 * (flags.has_contract ? 1 : 0) +
    25 * (flags.has_invoice  ? 1 : 0) +
    20 * (flags.has_client   ? 1 : 0) +
    5  * (flags.has_protocol ? 1 : 0) +
    5  * (flags.has_note     ? 1 : 0),
    100,
  )
  await supabase
    .from('projects')
    .update({ completeness_score: score, completeness_flags: flags })
    .eq('id', projectId)
    .eq('company_id', companyId)
}

const TABLE_MAP: Partial<Record<DocType, string>> = {
  estimate: 'cost_estimates',
  contract: 'contracts',
  invoice: 'invoices',
}

export const autoLinkService = {
  async link(input: AutoLinkInput): Promise<{ projectId: string | null; created: boolean }> {
    // ── TRYB DEMO (localStorage) ─────────────────────────────────────────────
    if (isDemoMode || !supabase) {
      return autoLinkService._linkDemo(input)
    }

    // ── KROK 1: Explicit project_id ──────────────────────────────────────────
    if (input.projectId) {
      await projectDocumentsApi.link(input.companyId, input.projectId, input.type, input.id, {
        auto: true,
        sourceDocType: input.sourceType,
        sourceDocId: input.sourceId,
      })
      await insertTimeline(input.companyId, input.projectId, 'doc_linked', {
        doc_type: input.type,
        doc_id: input.id,
        reason: 'explicit',
      })
      await recomputeCompleteness(input.projectId, input.companyId)
      return { projectId: input.projectId, created: false }
    }

    // ── KROK 2: Dziedziczenie przez chain (source doc ma project_id) ─────────
    if (input.sourceId && input.sourceType) {
      const table = TABLE_MAP[input.sourceType]
      if (table) {
        const { data: sourceDoc } = await supabase
          .from(table)
          .select('project_id')
          .eq('id', input.sourceId)
          .single()
        const inheritedId: string | null = sourceDoc?.project_id ?? null
        if (inheritedId) {
          // Propaguj project_id na sam dokument
          const docTable = TABLE_MAP[input.type]
          if (docTable) {
            await supabase.from(docTable).update({ project_id: inheritedId }).eq('id', input.id)
          }
          await projectDocumentsApi.link(input.companyId, inheritedId, input.type, input.id, {
            auto: true,
            sourceDocType: input.sourceType,
            sourceDocId: input.sourceId,
          })
          await insertTimeline(input.companyId, inheritedId, 'doc_linked', {
            doc_type: input.type,
            doc_id: input.id,
            reason: 'chain',
            source_type: input.sourceType,
            source_id: input.sourceId,
          })
          await recomputeCompleteness(inheritedId, input.companyId)
          return { projectId: inheritedId, created: false }
        }
      }
    }

    // ── KROK 3: Lookup po client_id (+ adres) ────────────────────────────────
    let confidence = 0
    let candidateId: string | null = null

    if (input.clientId) {
      const { data: candidates } = await supabase
        .from('projects')
        .select('id, investment_address, address')
        .eq('company_id', input.companyId)
        .eq('client_id', input.clientId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })

      const cands: Array<{ id: string; investment_address: string | null; address: string | null }> =
        candidates ?? []

      if (cands.length === 1) {
        confidence = 85
        candidateId = cands[0].id
      } else if (cands.length > 1 && input.address) {
        const norm = (s?: string | null) => (s ?? '').toLowerCase().trim()
        const ranked = cands
          .map((c) => ({
            id: c.id,
            dist: lev(norm(input.address), norm(c.investment_address ?? c.address)),
          }))
          .sort((a, b) => a.dist - b.dist)
        if (ranked[0].dist < 10) {
          confidence = 75
          candidateId = ranked[0].id
        } else {
          confidence = 40
          candidateId = cands[0].id
        }
      } else if (cands.length > 1) {
        confidence = 40
        candidateId = cands[0].id
      }
    }

    // ── KROK 4: Auto-create projekt (tylko dla estimate/contract bez projektu) ─
    if (!candidateId && input.clientId && (input.type === 'estimate' || input.type === 'contract')) {
      const year = new Date().getFullYear()
      const suffix = Date.now().toString().slice(-4)
      const { data: newProj, error: projErr } = await supabase
        .from('projects')
        .insert({
          company_id: input.companyId,
          client_id: input.clientId,
          number: `PRJ/${year}/${suffix}`,
          name: 'Projekt klienta (auto)',
          investment_address: input.address ?? null,
          address: input.address ?? null,
          status: 'offer',
          completeness_score: 0,
          completeness_flags: {},
        })
        .select('id')
        .single()
      if (!projErr && newProj) {
        const newProjId: string = newProj.id
        candidateId = newProjId
        // Propaguj project_id na sam dokument
        const docTable = TABLE_MAP[input.type]
        if (docTable) {
          await supabase.from(docTable).update({ project_id: newProjId }).eq('id', input.id)
        }
        await projectDocumentsApi.link(input.companyId, newProjId, input.type, input.id, {
          auto: true,
        })
        await insertTimeline(input.companyId, newProjId, 'project_created', {
          triggered_by: input.type,
          doc_id: input.id,
        })
        await insertTimeline(input.companyId, newProjId, 'doc_linked', {
          doc_type: input.type,
          doc_id: input.id,
          reason: 'auto_create',
        })
        await recomputeCompleteness(newProjId, input.companyId)
        return { projectId: newProjId, created: true }
      }
    }

    // ── KROK 5: Pending assignment ────────────────────────────────────────────
    await supabase.from('assignment_queue').upsert(
      {
        company_id: input.companyId,
        doc_type: input.type,
        doc_id: input.id,
        suggested_project_id: candidateId,
        confidence,
        reason: confidence > 0 ? 'client_match' : 'none',
      },
      { onConflict: 'company_id,doc_type,doc_id' },
    )
    return { projectId: null, created: false }
  },

  /** Demo mode: używa demoDb zamiast Supabase */
  _linkDemo(input: AutoLinkInput): { projectId: string | null; created: boolean } {
    // Jeśli już ma project_id — nic nie rób
    if (input.projectId) return { projectId: input.projectId, created: false }

    // Dziedzicz przez chain (np. faktura z umowy, umowa z kosztorysu)
    if (input.sourceId && input.sourceType) {
      const sourceTables: Record<string, () => unknown[]> = {
        estimate: () => (demoDb as any).estimates?.list(input.companyId) ?? [],
        contract: () => (demoDb as any).contracts?.list(input.companyId) ?? [],
      }
      const getter = sourceTables[input.sourceType]
      if (getter) {
        const sourceDoc = (getter() as any[]).find((d: any) => d.id === input.sourceId)
        if (sourceDoc?.project_id) {
          return { projectId: sourceDoc.project_id, created: false }
        }
      }
    }

    // Znajdź istniejący projekt dla tego klienta
    if (input.clientId) {
      const existing = demoDb.projects
        .list(input.companyId)
        .find((p) => p.client_id === input.clientId)
      if (existing) {
        // Zaktualizuj project_id na dokumencie w demoDb
        autoLinkService._demoPatchProjectId(input, existing.id)
        return { projectId: existing.id, created: false }
      }
    }

    // Auto-utwórz projekt (dla estimate i contract)
    if (input.clientId && (input.type === 'estimate' || input.type === 'contract')) {
      if (input.type === 'estimate') {
        const newProj = demoDb.projects.createFromEstimate(input.companyId, input.id)
        // Patch project_id na samej wycenie
        autoLinkService._demoPatchProjectId(input, newProj.id)
        // Kaskadowo: umowy z tej wyceny
        const relatedContracts = (demoDb.contracts.list(input.companyId) as any[]).filter((c: any) => c.estimate_id === input.id)
        for (const contract of relatedContracts) {
          autoLinkService._demoPatchProjectId({ ...input, type: 'contract', id: contract.id }, newProj.id)
          // Faktury z tej umowy
          const relatedInvoices = (demoDb.invoices.list(input.companyId) as any[]).filter((inv: any) => inv.contract_id === contract.id)
          for (const invoice of relatedInvoices) {
            autoLinkService._demoPatchProjectId({ ...input, type: 'invoice', id: invoice.id }, newProj.id)
          }
        }
        return { projectId: newProj.id, created: true }
      }
      // Dla contract — utwórz pusty projekt
      const newProj = demoDb.projects.create({
        company_id: input.companyId,
        client_id: input.clientId,
        name: 'Projekt (auto)',
        status: 'offer',
        start_date: null,
        end_date: null,
        address: input.address ?? '',
        budget: null,
        costs: 0,
        notes: undefined,
      })
      autoLinkService._demoPatchProjectId(input, newProj.id)
      return { projectId: newProj.id, created: true }
    }

    return { projectId: null, created: false }
  },

  /** Aktualizuje project_id na dokumencie w demoDb */
  _demoPatchProjectId(input: AutoLinkInput, projectId: string) {
    try {
      if (input.type === 'estimate') {
        const ests = demoDb.estimates?.list(input.companyId) as any[]
        const est = ests.find((e: any) => e.id === input.id)
        if (est) demoDb.estimates?.update(input.id, { ...est, project_id: projectId })
      } else if (input.type === 'contract') {
        const contracts = demoDb.contracts?.list(input.companyId) as any[]
        const c = contracts.find((x: any) => x.id === input.id)
        if (c) demoDb.contracts?.update(input.id, { ...c, project_id: projectId })
      } else if (input.type === 'invoice') {
        const invs = demoDb.invoices?.list(input.companyId) as any[]
        const inv = invs.find((x: any) => x.id === input.id)
        if (inv) demoDb.invoices?.update(input.id, { ...inv, project_id: projectId })
      }
    } catch {
      // demoDb patch jest best-effort
    }
  },

  /** Wywołaj po zmianie client_id lub adresu dokumentu — usuwa stary pending i puszcza ponownie */
  async reEvaluate(input: AutoLinkInput): Promise<void> {
    if (!isDemoMode && supabase) {
      await supabase
        .from('assignment_queue')
        .delete()
        .match({ company_id: input.companyId, doc_type: input.type, doc_id: input.id })
    }
    await autoLinkService.link({ ...input, projectId: null })
  },
}
