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
import { recomputeCompleteness } from '@/services/project/autoLinkService'

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
      recomputeCompleteness(projectId, companyId).catch((err) =>
        console.warn('[link] completeness recompute failed:', err)
      )
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
      recomputeCompleteness(projectId, companyId).catch((err) =>
        console.warn('[unlink] completeness recompute failed:', err)
      )
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
    refetchIntervalInBackground: false,
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
    async (selectedDocIds?: string[], projectName?: string) => {
      setLoading(true)
      setError(null)
      try {
        const [{ default: JSZip }, { generatePdfBlob }] = await Promise.all([
          import('jszip'),
          import('@/services/pdf/pdfGenerator'),
        ])
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

        // Demo mode: read from localStorage
        const dbRaw = isDemoMode ? (JSON.parse(demoDb.exportState()) as Record<string, any[]>) : null
        const dbProfile = isDemoMode ? demoDb.companyProfile(companyId) : null
        let companyMeta: { name?: string; nip?: string; address?: string; postalCity?: string; email?: string; phone?: string; bankAccount?: string; logoUrl?: string } | undefined = dbProfile ? {
          name: dbProfile.company_name || '',
          nip: dbProfile.nip || '',
          address: dbProfile.address || '',
          postalCity: `${dbProfile.postal_code || ''} ${dbProfile.city || ''}`.trim(),
          email: dbProfile.email || '',
          phone: dbProfile.phone || '',
          bankAccount: dbProfile.iban || '',
        } : undefined

        // Production mode: batch-fetch real document data
        let prodEstimates: any[] = []
        let prodContracts: any[] = []
        let prodInvoices: any[] = []
        let prodClients: any[] = []
        if (!isDemoMode && supabase) {
          const estIds = active.filter(d => d.doc_type === 'estimate').map(d => d.doc_id)
          const ctIds  = active.filter(d => d.doc_type === 'contract').map(d => d.doc_id)
          const invIds = active.filter(d => d.doc_type === 'invoice').map(d => d.doc_id)
          const [estRes, ctRes, invRes, coRes] = await Promise.all([
            estIds.length ? supabase.from('cost_estimates').select('*, items:cost_estimate_items(*)').in('id', estIds) : Promise.resolve({ data: [] }),
            ctIds.length  ? supabase.from('contracts').select('*').in('id', ctIds)  : Promise.resolve({ data: [] }),
            invIds.length ? supabase.from('invoices').select('*').in('id', invIds)  : Promise.resolve({ data: [] }),
            supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),
          ])
          prodEstimates = estRes.data ?? []
          prodContracts = ctRes.data ?? []
          prodInvoices  = invRes.data ?? []
          const co = coRes.data as any
          if (co) {
            companyMeta = {
              name: co.name || '',
              nip: co.nip || co.ksef_nip || '',
              address: co.address || '',
              postalCity: [co.postal_code, co.city].filter(Boolean).join(' ').trim(),
              email: co.email || '',
              phone: co.phone || '',
              bankAccount: co.iban || '',
              logoUrl: co.logo_url || '',
            }
          }
          const clientIds = [...new Set([
            ...prodEstimates.map((e: any) => e.client_id),
            ...prodContracts.map((c: any) => c.client_id),
            ...prodInvoices.map((i: any) => i.client_id),
          ].filter(Boolean))]
          if (clientIds.length > 0) {
            const { data: clData } = await supabase.from('clients').select('*').in('id', clientIds)
            prodClients = clData ?? []
          }
        }

        for (let i = 0; i < active.length; i++) {
          const doc = active[i]
          const idx = String(ORDER[doc.doc_type] ?? 9).padStart(2, '0')

          // Resolve human-readable document number for filename
          const docPool = isDemoMode && dbRaw
            ? (doc.doc_type === 'estimate' ? dbRaw.estimates : doc.doc_type === 'invoice' ? dbRaw.invoices : doc.doc_type === 'contract' ? dbRaw.contracts : null)
            : (doc.doc_type === 'estimate' ? prodEstimates : doc.doc_type === 'invoice' ? prodInvoices : doc.doc_type === 'contract' ? prodContracts : null)
          const rawNum: string | undefined = (docPool as any[] | null | undefined)?.find((x: any) => x.id === doc.doc_id)?.number
          const safeNum = rawNum
            ? rawNum.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, '_')
            : doc.doc_id.slice(0, 8)
          // Extension is .pdf – ZIP will contain real binary PDF files
          const fileName = `${idx}_${safeNum}.pdf`

          let html: string
          if (isDemoMode && dbRaw) {
            const clients = dbRaw.clients ?? []
            if (doc.doc_type === 'estimate') {
              const est = (dbRaw.estimates ?? []).find((e: any) => e.id === doc.doc_id)
              const cl = est ? clients.find((c: any) => c.id === est.client_id) : undefined
              const clientMeta = cl ? { name: cl.name, nip: cl.nip ?? '', address: cl.address ?? '', postalCity: `${cl.postal_code ?? ''} ${cl.city ?? ''}`.trim(), email: cl.email ?? '', phone: cl.phone ?? '' } : undefined
              html = est ? buildEstimatePreview(est, clientMeta, companyMeta) : `<!DOCTYPE html><html><body><p>Kosztorys ${doc.doc_id}</p></body></html>`
            } else if (doc.doc_type === 'invoice') {
              const inv = (dbRaw.invoices ?? []).find((f: any) => f.id === doc.doc_id)
              const cl = inv ? clients.find((c: any) => c.id === inv.client_id) : undefined
              const ct = inv ? (dbRaw.contracts ?? []).find((c: any) => c.id === inv.contract_id) : undefined
              const clientMeta = cl ? { name: cl.name, nip: cl.nip ?? '', address: cl.address ?? '', postalCity: `${cl.postal_code ?? ''} ${cl.city ?? ''}`.trim(), email: cl.email ?? '', phone: cl.phone ?? '' } : undefined
              const contractMeta = ct ? { contractNumber: ct.number, contractLocation: ct.location ?? '' } : undefined
              html = inv ? buildInvoicePreview(inv, clientMeta, contractMeta, companyMeta) : `<!DOCTYPE html><html><body><p>Faktura ${doc.doc_id}</p></body></html>`
            } else if (doc.doc_type === 'contract') {
              const ct = (dbRaw.contracts ?? []).find((c: any) => c.id === doc.doc_id)
              const cl = ct ? clients.find((c: any) => c.id === ct.client_id) : undefined
              const est = ct ? (dbRaw.estimates ?? []).find((e: any) => (e as any).project_id === ct.project_id) : undefined
              html = ct ? buildContractPreview(ct, cl?.name ?? '', est?.name ?? ct?.notes ?? '', companyMeta, est?.number, cl ? { name: cl.name, address: cl.address ?? undefined, postal_code: cl.postal_code ?? undefined, city: cl.city ?? undefined, phone: cl.phone ?? undefined, email: cl.email ?? undefined, nip: cl.nip ?? undefined, pesel: cl.pesel ?? undefined, contact_person: cl.contact_person ?? undefined } : undefined) : `<!DOCTYPE html><html><body><p>Umowa ${doc.doc_id}</p></body></html>`
            } else {
              html = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>${doc.doc_type}</title></head><body><h1>LoftDesk – ${doc.doc_type.toUpperCase()}</h1><p>ID: ${doc.doc_id}</p></body></html>`
            }
          } else {
            // Production mode: render real documents fetched from Supabase
            const cl = (clientId: string | null) => prodClients.find((c: any) => c.id === clientId)
            const mkClient = (c: any) => c ? {
              name: c.name ?? '', nip: c.nip ?? '', address: c.address ?? '',
              postalCity: `${c.postal_code ?? ''} ${c.city ?? ''}`.trim(),
              email: c.email ?? '', phone: c.phone ?? '',
            } : undefined
            if (doc.doc_type === 'estimate') {
              const est = prodEstimates.find((e: any) => e.id === doc.doc_id)
              html = est ? buildEstimatePreview(est, mkClient(cl(est.client_id)), companyMeta) : `<!DOCTYPE html><html><body><p>Kosztorys ${doc.doc_id.slice(0, 8)}</p></body></html>`
            } else if (doc.doc_type === 'invoice') {
              const inv = prodInvoices.find((i: any) => i.id === doc.doc_id)
              const ct  = inv?.contract_id ? prodContracts.find((c: any) => c.id === inv.contract_id) : undefined
              const contractMeta = ct ? { contractNumber: ct.number, contractLocation: ct.location ?? '' } : undefined
              html = inv ? buildInvoicePreview(inv, mkClient(cl(inv.client_id)), contractMeta, companyMeta) : `<!DOCTYPE html><html><body><p>Faktura ${doc.doc_id.slice(0, 8)}</p></body></html>`
            } else if (doc.doc_type === 'contract') {
              const ct  = prodContracts.find((c: any) => c.id === doc.doc_id)
              const est = ct?.estimate_id ? prodEstimates.find((e: any) => e.id === ct.estimate_id) : undefined
              const clObj = ct ? cl(ct.client_id) : undefined
              html = ct ? buildContractPreview(ct, clObj?.name ?? '', est?.name ?? ct?.notes ?? '', companyMeta, est?.number, clObj ? { name: clObj.name, address: clObj.address ?? undefined, postal_code: clObj.postal_code ?? undefined, city: clObj.city ?? undefined, phone: clObj.phone ?? undefined, email: clObj.email ?? undefined, nip: clObj.nip ?? undefined, pesel: clObj.pesel ?? undefined, contact_person: clObj.contact_person ?? undefined } : undefined) : `<!DOCTYPE html><html><body><p>Umowa ${doc.doc_id.slice(0, 8)}</p></body></html>`
            } else {
              html = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>${doc.doc_type}</title></head><body><h1>LoftDesk – ${doc.doc_type.toUpperCase()}</h1><p>ID: ${doc.doc_id}</p></body></html>`
            }
          }

          // Convert HTML → real binary PDF blob (application/pdf)
          const pdfBlob = await generatePdfBlob(html)

          // Safety guard: refuse to pack HTML strings / non-PDF blobs into a .pdf file
          if (!(pdfBlob instanceof Blob)) {
            throw new Error(`[LoftDesk] ZIP Export: expected Blob for ${fileName} but got ${typeof pdfBlob}`)
          }
          if (!pdfBlob.type.includes('pdf')) {
            throw new Error(`[LoftDesk] ZIP Export: expected application/pdf Blob for ${fileName} but got MIME "${pdfBlob.type}"`)
          }

          zip.file(fileName, pdfBlob)
          manifest.push({
            index: i + 1,
            type: doc.doc_type,
            id: doc.doc_id,
            file: fileName,
            mimeType: pdfBlob.type,
            sizeBytes: pdfBlob.size,
            auto: doc.linked_automatically,
          })
        }

        zip.file('manifest.json', JSON.stringify(manifest, null, 2))

        const blob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const safeProjectName = projectName
          ? projectName.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, '_').slice(0, 50)
          : projectId.slice(0, 8)
        a.download = `projekt_${safeProjectName}_dokumenty.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
        console.error('[LoftDesk] ZIP Export – error', e)
      } finally {
        setLoading(false)
      }
    },
    [projectId, companyId],
  )

  return { exportZip, loading, error }
}
