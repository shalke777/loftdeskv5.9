import type { ClientDecision, DocumentationOverview, HandoverProtocol, PhotoDocumentation, TechnicalStandard } from '@/entities/documentation/model'
import { documentationStore } from '@/shared/lib/documentationStore'
import { supabase } from '@/shared/lib/supabase'

export const documentationApi = {
  async overview(companyId: string): Promise<DocumentationOverview> {
    // Decisions / protocols / standards come from localStorage (current implementation).
    // Photos are fetched from Supabase so they are visible to invited clients in the portal.
    const storeData = documentationStore.getOverview(companyId)
    if (!supabase || !companyId) return storeData

    const { data: photos } = await supabase
      .from('project_photo_docs')
      .select('id, company_id, client_id, project_id, title, category, taken_at, image_url, note')
      .eq('company_id', companyId)
      .order('taken_at', { ascending: false, nullsFirst: false })

    return {
      ...storeData,
      photos: (photos ?? []) as PhotoDocumentation[],
    }
  },
  async createDecision(input: Omit<ClientDecision, 'id' | 'requested_at' | 'decided_at'>) {
    return documentationStore.decisions.create(input)
  },
  async updateDecision(id: string, input: Partial<ClientDecision>) {
    return documentationStore.decisions.update(id, input)
  },
  async decide(id: string, status: ClientDecision['status'], comment?: string) {
    return documentationStore.decisions.decide(id, status, comment)
  },
  async deleteDecision(id: string) {
    documentationStore.decisions.remove(id)
    return { ok: true }
  },
  async createProtocol(input: Omit<HandoverProtocol, 'id'>) {
    return documentationStore.protocols.create(input)
  },
  async updateProtocol(id: string, input: Partial<HandoverProtocol>) {
    return documentationStore.protocols.update(id, input)
  },
  async decideProtocol(id: string, status: HandoverProtocol['status']) {
    return documentationStore.protocols.decide(id, status)
  },
  async deleteProtocol(id: string) {
    documentationStore.protocols.remove(id)
    return { ok: true }
  },

  // ── Photo documentation — reads and writes go to Supabase (project_photo_docs). ──
  // This ensures photos added by the operator are immediately visible to invited clients
  // via the portal. Migration 065 adds the client SELECT RLS policy on project_photo_docs.
  // Operator CRUD is covered by migration 019 policies (ppd_insert / ppd_update / ppd_delete).
  async createPhoto(input: Omit<PhotoDocumentation, 'id'>): Promise<PhotoDocumentation> {
    if (!supabase) return documentationStore.photos.create(input)
    const { data, error } = await supabase
      .from('project_photo_docs')
      .insert({
        company_id: input.company_id,
        client_id:  input.client_id  ?? null,
        project_id: input.project_id ?? null,
        title:      input.title,
        category:   input.category,
        taken_at:   input.taken_at   ?? null,
        image_url:  input.image_url  || null,
        note:       input.note       || null,
      })
      .select()
      .single()
    if (error) throw error
    if (!data) throw new Error('Photo insert returned no data')
    return data as PhotoDocumentation
  },
  async updatePhoto(id: string, input: Partial<PhotoDocumentation>): Promise<PhotoDocumentation> {
    if (!supabase) return documentationStore.photos.update(id, input) as PhotoDocumentation
    const patch: Record<string, unknown> = {}
    if (input.title     !== undefined) patch.title     = input.title
    if (input.category  !== undefined) patch.category  = input.category
    if (input.taken_at  !== undefined) patch.taken_at  = input.taken_at  ?? null
    if (input.image_url !== undefined) patch.image_url = input.image_url || null
    if (input.note      !== undefined) patch.note      = input.note      || null
    const { data, error } = await supabase
      .from('project_photo_docs')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (!data) throw new Error('Photo update returned no data')
    return data as PhotoDocumentation
  },
  async deletePhoto(id: string) {
    if (!supabase) { documentationStore.photos.remove(id); return { ok: true } }
    const { error } = await supabase.from('project_photo_docs').delete().eq('id', id)
    if (error) throw error
    return { ok: true }
  },
  async listByProject(projectId: string): Promise<PhotoDocumentation[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('project_photo_docs')
      .select('id, company_id, client_id, project_id, title, category, taken_at, image_url, note')
      .eq('project_id', projectId)
      .order('taken_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data ?? []) as PhotoDocumentation[]
  },
  async createStandard(input: Omit<TechnicalStandard, 'id'>) {
    return documentationStore.standards.create(input)
  },
  async updateStandard(id: string, input: Partial<TechnicalStandard>) {
    return documentationStore.standards.update(id, input)
  },
  async acceptStandard(id: string) {
    return documentationStore.standards.accept(id)
  },
  async deleteStandard(id: string) {
    documentationStore.standards.remove(id)
    return { ok: true }
  },
}
