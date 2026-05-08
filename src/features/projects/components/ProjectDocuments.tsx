import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Calculator, FileText, Receipt, StickyNote, ClipboardList, Paperclip, File,
  Send, UserCheck, Unlink, Trash2, Download, Package, Link2,
} from 'lucide-react'
import type { Project } from '@/entities/project/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Card } from '@/shared/ui/Card/Card'
import { SendToClientModal } from '@/shared/ui/SendToClientModal/SendToClientModal'
import {
  useProjectDocuments,
  useUnlinkDocument,
  useLinkDocument,
  useProjectExport,
} from '@/features/projects/hooks/useProjectDocuments'
import { useProjectEstimatesWithItems, useDeleteEstimate } from '@/features/estimates/hooks/useEstimates'
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

const TYPE_ICON: Record<string, typeof File> = {
  estimate: Calculator,
  contract: FileText,
  invoice: Receipt,
  note: StickyNote,
  protocol: ClipboardList,
  attachment: Paperclip,
  other: File,
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
  const link   = useLinkDocument()
  const { exportZip, loading: exporting } = useProjectExport(project.id)
  const [sendDoc, setSendDoc] = useState<{ type: 'estimate' | 'contract' | 'invoice'; name: string; defaultEmail?: string } | null>(null)
  const [packageSendOpen, setPackageSendOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [linkPickerOpen, setLinkPickerOpen] = useState(false)
  const [linkType, setLinkType] = useState<'estimate' | 'contract' | 'invoice'>('estimate')
  const [linkDocId, setLinkDocId] = useState('')
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

  async function handleDelete(docId: string, docType: string) {
    try {
      if (docType === 'estimate') await deleteEstimate.mutateAsync(docId)
      else if (docType === 'contract') await deleteContract.mutateAsync(docId)
      else if (docType === 'invoice') await deleteInvoice.mutateAsync(docId)
      await projectDocumentsApi.unlink(companyId, project.id, docType, docId)
      qc.invalidateQueries({ queryKey: ['project_documents', project.id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    } catch {
      // error toast raised by domain hook
    } finally {
      setConfirmDeleteId(null)
    }
  }

  const { data: estimates = [], isLoading: estLoading } = useProjectEstimatesWithItems(project.id)
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
    ? (clients.find(c => c.id === project.client_id)?.email || undefined) : undefined
  const projectClientName = project.client_id
    ? (clients.find(c => c.id === project.client_id)?.name || undefined) : undefined
  const portalClientEmail = portalAccess?.email || undefined
  const portalClientName  = portalAccess?.fullName || undefined
  const resolveApprovalEmail = (docType: string, docId: string): string | undefined =>
    resolveClientEmail(docType, docId) ?? projectClientEmail ?? portalClientEmail
  const resolveApprovalName  = (docType: string, docId: string): string | undefined =>
    resolveClientName(docType, docId) ?? projectClientName ?? portalClientName

  const mailableDocs = docs.filter(d => MAILABLE_TYPES.has(d.doc_type))

  const sorted = [...docs].sort(
    (a, b) => (TYPE_ORDER[a.doc_type] ?? 9) - (TYPE_ORDER[b.doc_type] ?? 9),
  )

  // Compute already-linked doc IDs per type for filtering
  const linkedEstimateIds = new Set(docs.filter(d => d.doc_type === 'estimate').map(d => d.doc_id))
  const linkedContractIds = new Set(docs.filter(d => d.doc_type === 'contract').map(d => d.doc_id))
  const linkedInvoiceIds  = new Set(docs.filter(d => d.doc_type === 'invoice').map(d => d.doc_id))

  const linkableItems = linkType === 'estimate'
    ? estimates.filter(e => !linkedEstimateIds.has(e.id)).map(e => ({ id: e.id, label: `${e.number} – ${e.name || ''}`.trim() }))
    : linkType === 'contract'
    ? contracts.filter(c => !linkedContractIds.has(c.id)).map(c => ({ id: c.id, label: c.number }))
    : invoices.filter(i => !linkedInvoiceIds.has(i.id)).map(i => ({ id: i.id, label: i.number }))

  function handleLink() {
    if (!linkDocId) return
    link.mutate({ projectId: project.id, docType: linkType, docId: linkDocId })
    setLinkPickerOpen(false)
    setLinkDocId('')
  }

  return (
    <Card>
      {/* Header + toolbar */}
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>Dokumenty ({docs.length})</h4>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="doc-icon-btn"
            title="Dołącz istniejący dokument do projektu"
            onClick={() => { setLinkPickerOpen(v => !v); setLinkDocId('') }}
          >
            <Link2 size={16} />
          </button>
          <button
            type="button"
            className="doc-icon-btn"
            title="Wyślij pakiet dokumentów"
            disabled={mailableDocs.length === 0}
            onClick={() => setPackageSendOpen(true)}
          >
            <Package size={16} />
          </button>
          <button
            type="button"
            className="doc-icon-btn"
            title={exporting ? 'Pobieranie…' : 'Pobierz wszystkie jako ZIP'}
            disabled={docs.length === 0 || exporting}
            onClick={() => exportZip(undefined, project.name)}
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Link picker inline panel */}
      {linkPickerOpen && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Dołącz istniejący dokument
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['estimate', 'contract', 'invoice'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setLinkType(t); setLinkDocId('') }}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--color-border)',
                  background: linkType === t ? 'var(--color-brand)' : 'var(--color-surface-soft)',
                  color: linkType === t ? '#fff' : 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                {t === 'estimate' ? 'Wycena' : t === 'contract' ? 'Umowa' : 'Faktura'}
              </button>
            ))}
          </div>
          <select
            value={linkDocId}
            onChange={e => setLinkDocId(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)', color: 'var(--color-text-primary)', width: '100%' }}
          >
            <option value="">— wybierz —</option>
            {linkableItems.map(item => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          {linkableItems.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>Brak nieprzypiętych dokumentów tego typu.</p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setLinkPickerOpen(false)}>Anuluj</button>
            <button type="button" className="btn" style={{ fontSize: 13 }} disabled={!linkDocId || link.isPending} onClick={handleLink}>
              {link.isPending ? 'Przypisuję…' : 'Dołącz'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Ładowanie dokumentów…</p>
      ) : docs.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>
            Brak dokumentów. Zacznij od wyceny — po akceptacji naturalnie przejdziesz do umowy i faktury.
          </p>
          {onCreateEstimate && (
            <button type="button" className="doc-create-hint" onClick={onCreateEstimate}>
              + Nowa wycena
            </button>
          )}
        </div>
      ) : (
        <ul className="doc-list">
          {sorted.map((doc) => {
            const docName = docNamesLoading ? '…' : resolveDocName(doc.doc_type, doc.doc_id)
            const TypeIcon = TYPE_ICON[doc.doc_type] ?? File
            const isConfirmDelete = confirmDeleteId === doc.id

            return (
              <li key={doc.id} className={`doc-list__row${isConfirmDelete ? ' doc-list__row--danger' : ''}`}>
                {/* Left: type icon + name + badges */}
                <span className="doc-list__type-icon" title={TYPE_LABEL[doc.doc_type] ?? doc.doc_type}>
                  <TypeIcon size={15} />
                </span>
                <div className="doc-list__info">
                  <span className="doc-list__name" title={doc.doc_id}>{docName}</span>
                  <div className="doc-list__badges">
                    {(doc.doc_type === 'estimate' || doc.doc_type === 'contract') && (
                      <SignatureStatusBadge
                        documentType={doc.doc_type as 'estimate' | 'contract'}
                        documentId={doc.doc_id}
                      />
                    )}
                    {doc.linked_automatically && <Badge variant="default">Auto</Badge>}
                    {doc.source_doc_type && (
                      <span className="doc-list__source">z: {TYPE_LABEL[doc.source_doc_type] ?? doc.source_doc_type}</span>
                    )}
                  </div>
                </div>

                {/* Right: action icon buttons */}
                <div className="doc-list__actions">
                  {APPROVAL_TYPES.has(doc.doc_type) && (
                    <button
                      type="button"
                      className="doc-icon-btn"
                      title="Wyślij do akceptacji klienta"
                      onClick={() => {
                        const est = doc.doc_type === 'estimate' ? estimates.find(e => e.id === doc.doc_id) : null
                        const ctr = doc.doc_type === 'contract' ? contracts.find(c => c.id === doc.doc_id) : null
                        if (!est && !ctr) return
                        setApprovalDoc(est
                          ? {
                              type: 'estimate', id: est.id,
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
                              type: 'contract', id: ctr!.id, label: ctr!.number,
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
                      <UserCheck size={15} />
                    </button>
                  )}
                  {MAILABLE_TYPES.has(doc.doc_type) && (
                    <button
                      type="button"
                      className="doc-icon-btn"
                      title="Wyślij do klienta"
                      onClick={() => setSendDoc({
                        type: doc.doc_type as 'estimate' | 'contract' | 'invoice',
                        name: docName,
                        defaultEmail: resolveClientEmail(doc.doc_type, doc.doc_id) ?? projectClientEmail ?? portalClientEmail,
                      })}
                    >
                      <Send size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="doc-icon-btn"
                    title="Odepnij od projektu"
                    disabled={unlink.isPending}
                    onClick={() => unlink.mutate({ projectId: project.id, docType: doc.doc_type, docId: doc.doc_id })}
                  >
                    <Unlink size={15} />
                  </button>
                  {DELETABLE_TYPES.has(doc.doc_type) && (
                    <button
                      type="button"
                      className={`doc-icon-btn${isConfirmDelete ? ' doc-icon-btn--danger' : ''}`}
                      title={isConfirmDelete ? 'Kliknij ponownie, aby potwierdzić usunięcie' : 'Usuń dokument'}
                      disabled={isDeleting}
                      onClick={() => {
                        if (isConfirmDelete) {
                          handleDelete(doc.doc_id, doc.doc_type)
                        } else {
                          setConfirmDeleteId(doc.id)
                          setTimeout(() => setConfirmDeleteId(cur => cur === doc.id ? null : cur), 3000)
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Contextual next-step */}
      {docs.length > 0 && (() => {
        const flags = (project.completeness_flags ?? {}) as Record<string, boolean>
        if (flags.has_estimate && !flags.has_contract && onCreateContract) {
          return (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--color-surface-soft)' }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>
                Następny krok: utwórz umowę na podstawie wyceny
              </p>
              <button type="button" className="doc-create-hint" onClick={onCreateContract}>
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
              <button type="button" className="doc-create-hint" onClick={onCreateInvoice}>
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
        docSummary={mailableDocs.map(d => resolveDocName(d.doc_type, d.doc_id))}
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

