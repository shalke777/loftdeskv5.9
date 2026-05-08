import { memo, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, ClipboardCheck, Edit2, FileText, Mail, ReceiptText, Trash2 } from 'lucide-react'
import type { Client } from '@/entities/client/model'
import type { Contract } from '@/entities/contract/model'
import { Button } from '@/shared/ui/Button/Button'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildContractPreview } from '@/services/pdf/documentPreview'
import { formatCurrency } from '@/shared/lib/formatters'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'
import { SendToClientModal } from '@/shared/ui/SendToClientModal/SendToClientModal'
import { SendToApprovalModal } from '@/features/signatures/components/SendToApprovalModal'
import { SignatureStatusBadge } from '@/features/signatures/components/SignatureStatusBadge'
import { ApprovalEventList } from '@/features/signatures/components/ApprovalEventList'
import { useSignatureRequestsForDocumentWithParts } from '@/features/signatures/hooks/useSignatureRequests'
import { getAppOrigin } from '@/shared/lib/native'

const STATUS_LABEL: Record<Contract['status'], string> = {
  unsigned: 'W przygotowaniu', signed: 'Podpisana',
}
const STATUS_CLASS: Record<Contract['status'], string> = {
  unsigned: 'proj-status proj-status--unsigned',
  signed:   'proj-status proj-status--signed',
}

const TRANCHE_CLASS: Record<string, string> = {
  paid:     'proj-status proj-status--paid',
  invoiced: 'proj-status proj-status--sent',
  planned:  'proj-status proj-status--draft',
}

interface Props {
  contract: Contract
  clientName: string | null
  client?: Client | null
  projectName: string | null
  onEdit: (c: Contract) => void
  onDelete: (id: string) => void
  onSign: (id: string) => void
  onCreateInvoice?: (id: string) => void
  canDelete?: boolean
  canSign?: boolean
}

export function ContractRowImpl({
  contract, clientName, client, projectName,
  onEdit, onDelete, onSign, onCreateInvoice,
  canDelete = true, canSign = true,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)

  const { user } = useAuth()
  const companyMeta = useCompanyMeta()
  const { data: sigReqs } = useSignatureRequestsForDocumentWithParts('contract', contract.id)

  const tabs = useMemo(() => [{
    key: 'pdf', label: 'Podgląd PDF', type: 'html' as const,
    content: buildContractPreview(
      contract,
      clientName ?? undefined,
      projectName ?? undefined,
      {
        name: companyMeta.name || user?.companyName, nip: companyMeta.nip,
        address: companyMeta.address, postalCity: companyMeta.postalCity,
        email: companyMeta.email || user?.email, phone: companyMeta.phone,
        logoUrl: companyMeta.logoUrl,
      },
      undefined,
      client ? {
        name: client.name,
        address: client.address ?? undefined,
        postal_code: client.postal_code ?? undefined,
        city: client.city ?? undefined,
        phone: client.phone ?? undefined,
        email: client.email ?? undefined,
        nip: client.nip ?? undefined,
        pesel: client.pesel ?? undefined,
        contact_person: client.contact_person ?? undefined,
      } : undefined,
    ),
  }], [clientName, client, projectName, companyMeta, contract, user?.companyName, user?.email])

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDelete) { onDelete(contract.id); setConfirmDelete(false) }
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000) }
  }

  return (
    <div className={`proj-row${expanded ? ' proj-row--open' : ''}`}>
      <div
        className="proj-row__header"
        role="button"
        tabIndex={0}
        onClick={() => { setExpanded(v => !v); setConfirmDelete(false) }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(v => !v) }}
      >
        <span className="proj-row__chevron">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        <div className="proj-row__info">
          <span className="proj-row__name">{contract.number}</span>
          <span className="proj-row__meta">
            {clientName && <span className="proj-row__client">{clientName}</span>}
            {projectName && <span className="proj-row__number">{projectName}</span>}
          </span>
        </div>

        <div className="proj-row__right" onClick={e => e.stopPropagation()}>
          {contract.sign_date && (
            <span className="proj-row__number">{contract.sign_date}</span>
          )}
          <span className={STATUS_CLASS[contract.status]}>{STATUS_LABEL[contract.status]}</span>
          <SignatureStatusBadge documentType="contract" documentId={contract.id} />
          <div className="proj-row__actions">
            <button
              className="proj-action-btn"
              title="Wyślij do akceptacji"
              onClick={e => { e.stopPropagation(); setApprovalOpen(true) }}
            >
              <ClipboardCheck size={14} />
            </button>
            <button
              className="proj-action-btn"
              title="Podgląd PDF"
              onClick={e => { e.stopPropagation(); setPreviewOpen(true) }}
            >
              <FileText size={14} />
            </button>
            <button
              className="proj-action-btn"              title="Wyślij do klienta"
              onClick={e => { e.stopPropagation(); setSendOpen(true) }}
            >
              <Mail size={14} />
            </button>
            <button
              className="proj-action-btn"              title="Edytuj"
              onClick={e => { e.stopPropagation(); onEdit(contract) }}
            >
              <Edit2 size={14} />
            </button>
            {contract.status !== 'signed' && canSign && (
              <button
                className="proj-action-btn"
                title="Oznacz jako podpisaną"
                onClick={e => { e.stopPropagation(); onSign(contract.id) }}
              >
                <CheckCircle size={14} />
              </button>
            )}
            {canDelete && (
              <button
                className={`proj-action-btn proj-action-btn--danger${confirmDelete ? ' proj-action-btn--confirm' : ''}`}
                title="Usuń"
                onClick={handleDelete}
              >
                <Trash2 size={14} />
                {confirmDelete && <span className="proj-action-btn__label">Potwierdź</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="proj-row__detail">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '8px 16px', marginBottom: 16, fontSize: 13,
          }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Wartość umowy</span>
              <br />
              <strong>{formatCurrency(contract.value)}</strong>
            </div>
            {contract.sign_date && (
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Data podpisu</span>
                <br />{contract.sign_date}
              </div>
            )}
            {contract.start_date && (
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Start</span>
                <br />{contract.start_date}
              </div>
            )}
            {contract.end_date && (
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Koniec</span>
                <br />{contract.end_date}
              </div>
            )}
            {contract.location && (
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Lokalizacja</span>
                <br />{contract.location}
              </div>
            )}
          </div>

          {contract.tranches && contract.tranches.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Transze ({contract.tranches.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {contract.tranches.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span>{t.label}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>
                        {formatCurrency(t.amount)}
                      </span>
                      <span className={TRANCHE_CLASS[t.status] ?? 'proj-status proj-status--draft'} style={{ fontSize: 11 }}>
                        {t.status}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {contract.notes && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              {contract.notes}
            </p>
          )}

          <div className="actions-row">
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>PDF</Button>
            <Button variant="secondary" onClick={() => setSendOpen(true)}>Wyślij do klienta</Button>
            {onCreateInvoice && (
              <Button variant="secondary" onClick={() => onCreateInvoice(contract.id)}>
                <ReceiptText size={14} style={{ marginRight: 4 }} />
                Wystaw fakturę
              </Button>
            )}
            {contract.status !== 'signed' && canSign && (
              <Button onClick={() => onSign(contract.id)}>Oznacz jako podpisaną</Button>
            )}
          </div>

          {(() => {
            const active = sigReqs?.find(r => r.status !== 'cancelled' && r.status !== 'expired')
            return active ? <ApprovalEventList signatureRequestId={active.id} /> : null
          })()}
        </div>
      )}

      <DocumentPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${contract.number} · Podgląd dokumentu`}
        tabs={tabs}
      />
      <SendToClientModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        documentType="contract"
        documentName={contract.number}
        defaultEmail={client?.email ?? undefined}
        pdfHtml={tabs[0]?.content}
        portalUrl={contract.project_id ? `${getAppOrigin()}/client/project/${contract.project_id}` : undefined}
      />

      <SendToApprovalModal
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        documentType="contract"
        documentId={contract.id}
        documentLabel={contract.number}
        documentContentForHash={JSON.stringify({
          id: contract.id,
          number: contract.number,
          value: contract.value,
          start_date: contract.start_date ?? null,
          end_date: contract.end_date ?? null,
          location: contract.location ?? null,
          tranches: contract.tranches ?? [],
        })}
        projectId={contract.project_id ?? null}
      />
    </div>
  )
}

export const ContractRow = memo(ContractRowImpl)

