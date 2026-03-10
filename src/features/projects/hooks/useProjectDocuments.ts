import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { projectDocumentsApi } from '@/features/projects/api/projectDocuments.api'
import { isDemoMode, supabase } from '@/shared/lib/supabase'
import { useToast } from '@/shared/hooks/useToast'
import { translateError } from '@/shared/lib/errorMessages'
import type { ProjectDocument, ProjectTimelineEntry } from '@/entities/project/model'
import { demoDb } from '@/shared/lib/demoDb'
import { buildEstimatePreview, buildInvoicePreview, buildContractPreview } from '@/services/pdf/documentPreview'

// ── Project Documents ────────────────────────────────────────────────────────

export function useProjectDocuments(projectId: string) {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['project_documents', projectId, companyId],
    queryFn: () => projectDocumentsApi.listForProject(projectId, companyId),
    enabled: !!projectId,
  })
}

export function useLinkDocument() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({
      projectId,
      docType,
      docId,
    }: {
      projectId: string
      docType: ProjectDocument['doc_type']
      docId: string
    }) => projectDocumentsApi.link(companyId, projectId, docType, docId, { manual: true }),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project_documents', projectId] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Dokument przypisany do projektu')
    },
    onError: (e) => toast.error('Błąd przypisania', translateError(e)),
  })
}

export function useUnlinkDocument() {
  const companyId = useCompanyId()
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({
      projectId,
      docType,
      docId,
    }: {
      projectId: string
      docType: string
      docId: string
    }) => projectDocumentsApi.unlink(companyId, projectId, docType, docId),
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['project_documents', projectId] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.info('Dokument odpięty od projektu')
    },
    onError: (e) => toast.error('Błąd odpinania', translateError(e)),
  })
}

// ── Assignment Queue ─────────────────────────────────────────────────────────

export function useAssignmentQueue() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['assignment_queue', companyId],
    queryFn: () => projectDocumentsApi.getPendingForCompany(companyId),
    refetchInterval: 30_000,
  })
}

export function useResolveAssignment() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({
      id,
      resolution,
      projectId,
    }: {
      id: string
      resolution: 'accepted' | 'rejected' | 'reassigned'
      projectId?: string
    }) => projectDocumentsApi.resolveAssignment(id, resolution, projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignment_queue'] })
      qc.invalidateQueries({ queryKey: ['project_documents'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Przypisanie zaktualizowane')
    },
    onError: (e) => toast.error('Błąd aktualizacji', translateError(e)),
  })
}

// ── Project Timeline ─────────────────────────────────────────────────────────

export function useProjectTimeline(projectId: string) {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: ['project_timeline', projectId, companyId],
    queryFn: async (): Promise<ProjectTimelineEntry[]> => {
      if (isDemoMode || !supabase) return []
      const { data, error } = await supabase
        .from('project_timeline')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    enabled: !!projectId,
  })
}

// ── Project Export (JSZip client-side) ───────────────────────────────────────

export function useProjectExport(projectId: string) {
  const companyId = useCompanyId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportZip = useCallback(
    async (selectedDocIds?: string[]) => {
      setLoading(true)
      setError(null)
      try {
        const { default: JSZip } = await import('jszip')
        const docs = await projectDocumentsApi.listForProject(projectId, companyId)
        const active = docs.filter(
          (d) => !d.archived_at && (selectedDocIds ? selectedDocIds.includes(d.doc_id) : true),
        )

        const ORDER: Record<string, number> = {
          note: 1, estimate: 2, contract: 3, invoice: 4, protocol: 5, attachment: 6, other: 7,
        }
        active.sort((a, b) => (ORDER[a.doc_type] ?? 9) - (ORDER[b.doc_type] ?? 9))

        const zip = new JSZip()
        const manifest: unknown[] = []

        // Parse demoDb state once for demo-mode rendering
        const dbRaw = isDemoMode ? (JSON.parse(demoDb.exportState()) as Record<string, any[]>) : null
        const dbProfile = isDemoMode ? demoDb.companyProfile(companyId) : null
        const companyMeta = dbProfile ? {
          name: dbProfile.company_name || '',
          nip: dbProfile.nip || '',
          address: dbProfile.address || '',
          postalCity: `${dbProfile.postal_code || ''} ${dbProfile.city || ''}`.trim(),
          email: dbProfile.email || '',
          phone: dbProfile.phone || '',
          bankAccount: dbProfile.iban || '',
        } : undefined

        for (let i = 0; i < active.length; i++) {
          const doc = active[i]
          const idx = String(ORDER[doc.doc_type] ?? 9).padStart(2, '0')
          const fileName = `${idx}_${doc.doc_type}_${doc.doc_id.slice(0, 8)}.html`

          let html: string
          if (isDemoMode && dbRaw) {
            const clients = dbRaw.clients ?? []
            if (doc.doc_type === 'estimate') {
              const est = (dbRaw.estimates ?? []).find((e: any) => e.id === doc.doc_id)
              const cl = est ? clients.find((c: any) => c.id === est.client_id) : undefined
              const clientMeta = cl ? { name: cl.name, nip: cl.nip ?? '', address: cl.address ?? '', postalCity: `${cl.postal_code ?? ''} ${cl.city ?? ''}`.trim(), email: cl.email ?? '', phone: cl.phone ?? '' } : undefined
              html = est ? buildEstimatePreview(est, clientMeta, companyMeta) : `<p>Kosztorys ${doc.doc_id}</p>`
            } else if (doc.doc_type === 'invoice') {
              const inv = (dbRaw.invoices ?? []).find((f: any) => f.id === doc.doc_id)
              const cl = inv ? clients.find((c: any) => c.id === inv.client_id) : undefined
              const ct = inv ? (dbRaw.contracts ?? []).find((c: any) => c.id === inv.contract_id) : undefined
              const clientMeta = cl ? { name: cl.name, nip: cl.nip ?? '', address: cl.address ?? '', postalCity: `${cl.postal_code ?? ''} ${cl.city ?? ''}`.trim(), email: cl.email ?? '', phone: cl.phone ?? '' } : undefined
              const contractMeta = ct ? { contractNumber: ct.number, contractLocation: ct.location ?? '' } : undefined
              html = inv ? buildInvoicePreview(inv, clientMeta, contractMeta, companyMeta) : `<p>Faktura ${doc.doc_id}</p>`
            } else if (doc.doc_type === 'contract') {
              const ct = (dbRaw.contracts ?? []).find((c: any) => c.id === doc.doc_id)
              const cl = ct ? clients.find((c: any) => c.id === ct.client_id) : undefined
              const est = ct ? (dbRaw.estimates ?? []).find((e: any) => (e as any).project_id === ct.project_id) : undefined
              html = ct ? buildContractPreview(ct, cl?.name ?? '', est?.name ?? ct?.notes ?? '', companyMeta) : `<p>Umowa ${doc.doc_id}</p>`
            } else {
              html = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>${doc.doc_type}</title></head><body><h1>LoftDesk – ${doc.doc_type.toUpperCase()}</h1><p>ID: ${doc.doc_id}</p></body></html>`
            }
          } else {
            html = `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><title>${doc.doc_type} ${doc.doc_id.slice(0, 8)}</title></head>
<body>
  <h1>LoftDesk — ${doc.doc_type.toUpperCase()}</h1>
  <p><strong>ID dokumentu:</strong> ${doc.doc_id}</p>
  <p><strong>Projekt:</strong> ${projectId}</p>
  <p><strong>Przypisany:</strong> ${doc.linked_automatically ? 'automatycznie' : 'ręcznie'}</p>
  <p><strong>Data powiązania:</strong> ${new Date(doc.created_at).toLocaleDateString('pl-PL')}</p>
</body>
</html>`
          }

          zip.file(fileName, html)
          manifest.push({
            index: i + 1,
            type: doc.doc_type,
            id: doc.doc_id,
            file: fileName,
            auto: doc.linked_automatically,
          })
        }

        zip.file('manifest.json', JSON.stringify(manifest, null, 2))

        const blob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `projekt_${projectId.slice(0, 8)}_paczka.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [projectId, companyId],
  )

  return { exportZip, loading, error }
}
