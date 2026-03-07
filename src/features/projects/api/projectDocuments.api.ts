import type { AssignmentQueueItem, ProjectDocument } from '@/entities/project/model'
import { demoDb } from '@/shared/lib/demoDb'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { applyScope, getDataScope } from '@/shared/lib/dataScope'

export const projectDocumentsApi = {
  async listForProject(projectId: string, companyId: string): Promise<ProjectDocument[]> {
    if (isDemoMode || !supabase) return []
    const scope = await getDataScope(companyId)
    const { data, error } = await applyScope(
      supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      scope,
    )
    if (error) throw error
    return data ?? []
  },

  async link(
    companyId: string,
    projectId: string,
    docType: ProjectDocument['doc_type'],
    docId: string,
    opts: { auto?: boolean; manual?: boolean; sourceDocType?: string | null; sourceDocId?: string | null } = {},
  ): Promise<void> {
    if (isDemoMode || !supabase) return
    const { error } = await supabase.from('project_documents').upsert(
      {
        company_id: companyId,
        project_id: projectId,
        doc_type: docType,
        doc_id: docId,
        assignment_status: 'confirmed',
        linked_automatically: opts.auto ?? false,
        linked_manually: opts.manual ?? false,
        source_doc_type: opts.sourceDocType ?? null,
        source_doc_id: opts.sourceDocId ?? null,
      },
      { onConflict: 'company_id,project_id,doc_type,doc_id' },
    )
    if (error) throw error
  },

  async unlink(companyId: string, projectId: string, docType: string, docId: string): Promise<void> {
    if (isDemoMode || !supabase) return
    const { error } = await supabase
      .from('project_documents')
      .update({ archived_at: new Date().toISOString() })
      .match({ company_id: companyId, project_id: projectId, doc_type: docType, doc_id: docId })
    if (error) throw error
  },

  async getPendingForCompany(companyId: string): Promise<AssignmentQueueItem[]> {
    if (isDemoMode || !supabase) return []
    const { data, error } = await supabase
      .from('assignment_queue')
      .select('*')
      .eq('company_id', companyId)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async resolveAssignment(
    id: string,
    resolution: 'accepted' | 'rejected' | 'reassigned',
    projectId?: string,
  ): Promise<void> {
    if (isDemoMode || !supabase) return
    const { error } = await supabase
      .from('assignment_queue')
      .update({ resolved_at: new Date().toISOString(), resolution })
      .eq('id', id)
    if (error) throw error
    // Jeśli accepted/reassigned i mamy projectId — zaktualizuj doc.project_id
    if ((resolution === 'accepted' || resolution === 'reassigned') && projectId) {
      // Pobierz doc_type i doc_id z kolejki
      const { data: qItem } = await supabase.from('assignment_queue').select('doc_type,doc_id,company_id').eq('id', id).single()
      if (qItem) {
        const tableMap: Record<string, string> = {
          estimate: 'cost_estimates', contract: 'contracts', invoice: 'invoices',
        }
        const table = tableMap[qItem.doc_type]
        if (table) {
          await supabase.from(table).update({ project_id: projectId }).eq('id', qItem.doc_id)
        }
        await supabase.from('project_documents').upsert(
          {
            company_id: qItem.company_id,
            project_id: projectId,
            doc_type: qItem.doc_type,
            doc_id: qItem.doc_id,
            assignment_status: 'confirmed',
            linked_manually: true,
          },
          { onConflict: 'company_id,project_id,doc_type,doc_id' },
        )
      }
    }
  },
}
