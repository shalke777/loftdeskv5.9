import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Project } from '@/entities/project/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { SendToClientModal } from '@/shared/ui/SendToClientModal/SendToClientModal'
import {
  useProjectDocuments,
  useUnlinkDocument,
  useProjectExport,
} from '@/features/projects/hooks/useProjectDocuments'
import { useEstimates, useDeleteEstimate } from '@/features/estimates/hooks/useEstimates'
import { useContracts, useDeleteContract } from '@/features/contracts/hooks/useContracts'
import { useInvoices, useDeleteInvoice } from '@/features/invoices/hooks/useInvoices'
import { useClients } from '@/features/clients/hooks/useClients'
import { useProjectPortalAccess } from '@/features/portal/hooks/usePortalData'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { projectDocumentsApi } from '@/features/projects/api/projectDocuments.api'
import { getAppOrigin } from '@/shared/lib/native'
import { SignatureStatusBadge } from '@/features/signatures/components/SignatureStatusBadge'
import { SendToApprovalModal } from '@/features/signatures/components/SendToApprovalModal'

const TYPE_LABEL: Record<string, string> = {
  estimate: 'Wycena',
  contract: 'Umowa',
  invoice: 'Faktura',
  note: 'Notatka',
  protocol: 'Protokół',
  attachment: 'Załącznik',
  other: 'Inne',
}

const TYPE_ORDER: Record<string, number> = {
  note: 1, estimate: 2, contract: 3, invoice: 4, protocol: 5, attachment: 6, other: 7,
}

const MAILABLE_TYPES = new Set(['estimate', 'contract', 'invoice'])

const DELETABLE_TYPES = new Set(['estimate', 'contract', 'invoice'])

const APPROVAL_TYPES = new Set(['estimate', 'contract'])

export function ProjectDocuments({
  project,
  onCreateEstimate,
  onCreateContract,
  onCreateInvoice,
}: {
  project: Project
  onCreateEstimate?: () => void
  onCreateContract?: () => void
  onCreateInvoice?: () => void
}) {
  const qc = useQueryClient()
  const companyId = useCompanyId()
  const { data: docs = [], isLoading } = useProjectDocuments(project.id)
  const unlink = useUnlinkDocument()
  const { exportZip, loading: exporting } = useProjectExport(project.id)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sendDoc, setSendDoc] = useState<{ type: 'estimate' | 'contract' | 'invoice'; name: string; defaultEmail?: string } | null>(null)
  const [packageSendOpen, setPackageSendOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [approvalDoc, setApprovalDoc] = useState<{
    type: 'estimate' | 'contract'
    id: string
    label: string
    contentForHash: string
    clientEmail?: string
    clientName?: string
  } | null>(null)

  const deleteEstimate = useDeleteEstimate()
  const deleteContract = useDeleteContract()
  const deleteInvoice = useDeleteInvoice()
  const isDeleting = deleteEstimate.isPending || deleteContract.isPending || deleteInvoice.isPending

  async function handleDelete(docId: string, docType: string, pdRowId: string) {
    try {
      if (docType === 'estimate') await deleteEstimate.mutateAsync(docId)
      else if (docType === 'contract') await deleteContract.mutateAsync(docId)
      else if (docType === 'invoice') await deleteInvoice.mutateAsync(docId)
      // Archive the project_documents link row directly (avoids a duplicate unlink toast)
      await projectDocumentsApi.unlink(companyId, project.id, docType, docId)
      qc.invalidateQueries({ queryKey: ['project_documents', project.id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    } catch {
      // error toast already raised by the domain delete hook
    } finally {
      setConfirmDeleteId(null)
    }
  }

  const { data: estimates = [], isLoading: estLoading } = useEstimates()
  const { data: contracts = [], isLoading: ctLoading } = useContracts()
  const { data: invoices = [], isLoading: invLoading } = useInvoices()
  const { data: clients = [] } = useClients()
  const { data: portalAccess } = useProjectPortalAccess(project.id)
  const docNamesLoading = estLoading || ctLoading || invLoading
  const resolveDocName = (docType: string, docId: string): string => {
    if (docType === 'estimate') return estimates.find(e => e.id === docId)?.number ?? docId.slice(0, 8)
    if (docType === 'contract') return contracts.find(c => c.id === docId)?.number ?? docId.slice(0, 8)
    if (docType === 'invoice') return invoices.find(i => i.id === docId)?.number ?? docId.slice(0, 8)
    return docId.slice(0, 8)
  }
  const resolveClientEmail = (docType: string, docId: string): string | undefined => {
    const clientId =
      docType === 'estimate' ? estimates.find(e => e.id === docId)?.client_id :
      docType === 'contract' ? contracts.find(c => c.id === docId)?.client_id :
      docType === 'invoice'  ? invoices.find(i => i.id === docId)?.client_id  : undefined
    return clientId ? (clients.find(c => c.id === clientId)?.email || undefined) : undefined
  }
  const resolveClientName = (docType: string, docId: string): string | undefined => {
    const clientId =
      docType === 'estimate' ? estimates.find(e => e.id === docId)?.client_id :
      docType === 'contract' ? contracts.find(c => c.id === docId)?.client_id : undefined
    return clientId ? (clients.find(c => c.id === clientId)?.name || undefined) : undefined
  }
  const projectClientEmail = project.client_id
    ? (clients.find(c => c.id === project.client_id)?.email || undefined)
    : undefined
  const projectClientName = project.client_id
    ? (clients.find(c => c.id === project.client_id)?.name || undefined)
    : undefined
  // new-portal fallback: project_client_access → client_accounts
  const portalClientEmail = portalAccess?.email || undefined
  const portalClientName  = portalAccess?.fullName || undefined
  // Resolved email/name for approvals: doc → project (legacy) → portal access (new)
  const resolveApprovalEmail = (docType: string, docId: string): string | undefined =>
    resolveClientEmail(docType, docId) ?? projectClientEmail ?? portalClientEmail
  const resolveApprovalName  = (docType: string, docId: string): string | undefined =>
    resolveClientName(docType, docId) ?? projectClientName ?? portalClientName

  const mailableDocs = docs.filter(d => MAILABLE_TYPES.has(d.doc_type))
  // Mailable docs selected by the user (or all mailable if none explicitly selected)
  const packageDocIds: string[] = selected.size > 0
    ? [...selected].filter(id => mailableDocs.some(d => d.doc_id === id))
    : mailableDocs.map(d => d.doc_id)
  const packageDocNames = packageDocIds
    .map(id => { const d = mailableDocs.find(x => x.doc_id === id); return d ? resolveDocName(d.doc_type, id) : null })
    .filter(Boolean) as string[]

  const sorted = [...docs].sort(
    (a, b) => (TYPE_ORDER[a.doc_type] ?? 9) - (TYPE_ORDER[b.doc_type] ?? 9),
  )

  const grouped = sorted.reduce<Record<string, typeof docs>>((acc, d) => {
    acc[d.doc_type] = [...(acc[d.doc_type] ?? []), d]
    return acc
  }, {})

  const toggleSelect = (docId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(docId) ? next.delete(docId) : next.add(docId)
      return next
    })
  }

  return (
    <Card>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>Dokumenty ({docs.length})</h4>
        <div className="proj-doc-toolbar-actions">
          <Button
            variant="ghost"
            size="sm"
            disabled={mailableDocs.length === 0}
            onClick={() => setPackageSendOpen(true)}
            title={packageDocNames.length > 0 ? `Wyślij: ${packageDocNames.join(', ')}` : undefined}
          >
            {packageDocIds.length > 0 && packageDocIds.length < mailableDocs.length
              ? `Wyślij pakiet (${packageDocIds.length})`
              : 'Wyślij pakiet'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={exporting}
            onClick={() => exportZip(selected.size > 0 ? [...selected] : undefined, project.name)}
            disabled={docs.length === 0}
          >
            {selected.size > 0 ? `Pobierz zaznaczone (${selected.size})` : 'Pobierz paczkę'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Ładowanie dokumentów…</p>
      ) : docs.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>
            Brak dokumentów. Zacznij od wyceny — po akceptacji naturalnie przejdziesz do umowy i faktury.
          </p>
          {onCreateEstimate && (
            <button
              type="button"
              onClick={onCreateEstimate}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: '1px dashed var(--color-brand)',
                background: 'rgba(26,92,50,0.07)', color: 'var(--color-brand)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', width: 'fit-content',
              }}
            >
              + Nowa wycena
            </button>
          )}
        </div>
      ) : (
        Object.entries(grouped).map(([type, typeDocs]) => (
          <div key={type} style={{ marginBottom: 16 }}>
            <p
              style={{
                fontWeight: 600,
                fontSize: 12,
                color: 'var(--color-border)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 6,
              }}
            >
              {TYPE_LABEL[type] ?? type} ({typeDocs.length})
            </p>
            {typeDocs.map((doc) => (
              <div
                key={doc.id}
                className="proj-doc-row"
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--color-surface-soft)',
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(doc.doc_id)}
                  onChange={() => toggleSelect(doc.doc_id)}
                  style={{ flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 13 }} title={doc.doc_id}>
                  {docNamesLoading ? '…' : resolveDocName(doc.doc_type, doc.doc_id)}
                </span>
                {(doc.doc_type === 'estimate' || doc.doc_type === 'contract') && (
                  <SignatureStatusBadge
                    documentType={doc.doc_type as 'estimate' | 'contract'}
                    documentId={doc.doc_id}
                  />
                )}
                {doc.linked_automatically && (
                  <Badge variant="default">Automat.</Badge>
                )}
                {doc.linked_manually && (
                  <Badge variant="warning">ręcznie</Badge>
                )}
                {doc.source_doc_type && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    z: {TYPE_LABEL[doc.source_doc_type] ?? doc.source_doc_type}
                  </span>
                )}
                {APPROVAL_TYPES.has(doc.doc_type) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Wyślij do akceptacji klienta"
                    onClick={() => {
                      const est = doc.doc_type === 'estimate' ? estimates.find(e => e.id === doc.doc_id) : null
                      const ctr = doc.doc_type === 'contract' ? contracts.find(c => c.id === doc.doc_id) : null
                      if (!est && !ctr) return
                      setApprovalDoc(est
                        ? {
                            type: 'estimate',
                            id: est.id,
                            label: `${est.number} – ${est.name}`,
                            contentForHash: JSON.stringify({
                              id: est.id, number: est.number, name: est.name,
                              total_gross: est.total_gross, valid_until: est.valid_until ?? null,
                              items: est.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, vat_rate: i.vat_rate })),
                            }),
                            clientEmail: resolveApprovalEmail('estimate', est.id),
                            clientName:  resolveApprovalName('estimate', est.id),
                          }
                        : {
                            type: 'contract',
                            id: ctr!.id,
                            label: ctr!.number,
                            contentForHash: JSON.stringify({
                              id: ctr!.id, number: ctr!.number, value: ctr!.value,
                              start_date: ctr!.start_date ?? null, end_date: ctr!.end_date ?? null,
                              location: ctr!.location ?? null, tranches: ctr!.tranches ?? [],
                            }),
                            clientEmail: resolveApprovalEmail('contract', ctr!.id),
                            clientName:  resolveApprovalName('contract', ctr!.id),
                          }
                      )
                    }}
                  >
                    Do akceptacji
                  </Button>
                )}
                {MAILABLE_TYPES.has(doc.doc_type) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setSendDoc({
                        type: doc.doc_type as 'estimate' | 'contract' | 'invoice',
                        name: resolveDocName(doc.doc_type, doc.doc_id),
                        defaultEmail: resolveClientEmail(doc.doc_type, doc.doc_id),
                      })
                    }
                  >
                    Wyślij
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    unlink.mutate({
                      projectId: project.id,
                      docType: doc.doc_type,
                      docId: doc.doc_id,
                    })
                  }
                  disabled={unlink.isPending}
                >
                  Odepnij
                </Button>
                {DELETABLE_TYPES.has(doc.doc_type) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    style={confirmDeleteId === doc.id ? { color: 'var(--color-danger)' } : {}}
                    disabled={isDeleting}
                    onClick={() => {
                      if (confirmDeleteId === doc.id) {
                        handleDelete(doc.doc_id, doc.doc_type, doc.id)
                      } else {
                        setConfirmDeleteId(doc.id)
                        setTimeout(() => setConfirmDeleteId(cur => cur === doc.id ? null : cur), 3000)
                      }
                    }}
                  >
                    {confirmDeleteId === doc.id ? 'Potwierdź usunięcie' : 'Usuń'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Contextual next-step footer — only when docs exist */}
      {docs.length > 0 && (() => {
        const flags = (project.completeness_flags ?? {}) as Record<string, boolean>
        if (flags.has_estimate && !flags.has_contract && onCreateContract) {
          return (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--color-surface-soft)' }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>
                Następny krok: utwórz umowę na podstawie wyceny
              </p>
              <button
                type="button"
                onClick={onCreateContract}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, border: '1px dashed var(--color-brand)',
                  background: 'rgba(26,92,50,0.07)', color: 'var(--color-brand)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Nowa umowa
              </button>
            </div>
          )
        }
        if (flags.has_contract && !flags.has_invoice && onCreateInvoice) {
          return (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--color-surface-soft)' }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>
                Następny krok: wygeneruj fakturę do umowy
              </p>
              <button
                type="button"
                onClick={onCreateInvoice}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, border: '1px dashed var(--color-brand)',
                  background: 'rgba(26,92,50,0.07)', color: 'var(--color-brand)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Generuj fakturę
              </button>
            </div>
          )
        }
        return null
      })()}

      {sendDoc && (
        <SendToClientModal
          open={!!sendDoc}
          onClose={() => setSendDoc(null)}
          documentType={sendDoc.type}
          documentName={sendDoc.name}
          defaultEmail={sendDoc.defaultEmail}
          portalUrl={`${getAppOrigin()}/client/project/${project.id}`}
        />
      )}

      <SendToClientModal
        open={packageSendOpen}
        onClose={() => setPackageSendOpen(false)}
        documentType="package"
        documentName={`Dokumenty projektu – ${project.name}`}
        defaultEmail={projectClientEmail}
        portalUrl={`${getAppOrigin()}/client/project/${project.id}`}
        docSummary={packageDocNames}
      />

      {approvalDoc && (
        <SendToApprovalModal
          open={!!approvalDoc}
          onClose={() => setApprovalDoc(null)}
          documentType={approvalDoc.type}
          documentId={approvalDoc.id}
          documentLabel={approvalDoc.label}
          documentContentForHash={approvalDoc.contentForHash}
          projectId={project.id}
          defaultClientEmail={approvalDoc.clientEmail}
          defaultClientName={approvalDoc.clientName}
          onSent={() => setApprovalDoc(null)}
        />
      )}
    </Card>
  )
}

