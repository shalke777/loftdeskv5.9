import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardCheck, Edit2, FileText, Mail, Trash2 } from 'lucide-react'
import type { Estimate } from '@/entities/estimate/model'
import { Button } from '@/shared/ui/Button/Button'
import { DocumentPreviewModal } from '@/shared/ui/DocumentPreview/DocumentPreviewModal'
import { buildEstimatePreview } from '@/services/pdf/documentPreview'
import { formatCurrency } from '@/shared/lib/formatters'
import { useClients } from '@/features/clients/hooks/useClients'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'
import { SendToClientModal } from '@/shared/ui/SendToClientModal/SendToClientModal'
import { SendToApprovalModal } from '@/features/signatures/components/SendToApprovalModal'
import { SignatureStatusBadge } from '@/features/signatures/components/SignatureStatusBadge'
import { ApprovalEventList } from '@/features/signatures/components/ApprovalEventList'
import { useSignatureRequestsForDocumentWithParts } from '@/features/signatures/hooks/useSignatureRequests'
import { EstimateNextActions } from './EstimateNextActions'
import { getAppOrigin } from '@/shared/lib/native'

const STATUS_LABEL: Record<Estimate['status'], string> = {
  draft: 'Szkic', sent: 'Wysłane', accepted: 'Zaakceptowane', rejected: 'Odrzucone',
}
const STATUS_CLASS: Record<Estimate['status'], string> = {
  draft:    'proj-status proj-status--draft',
  sent:     'proj-status proj-status--sent',
  accepted: 'proj-status proj-status--accepted',
  rejected: 'proj-status proj-status--rejected',
}

interface Props {
  estimate: Estimate
  clientName: string | null
  projectName?: string | null
  onEdit: (e: Estimate) => void
  onDelete?: (id: string) => void
  onCreateContract?: (id: string) => void
}

export function EstimateRow({ estimate, clientName, projectName, onEdit, onDelete, onCreateContract }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)

  const { data: clients = [] } = useClients()
  const { user } = useAuth()
  const companyMeta = useCompanyMeta()
  const { data: sigReqs } = useSignatureRequestsForDocumentWithParts('estimate', estimate.id)

  const client = clients.find(c => c.id === estimate.client_id)

  const tabs = useMemo(() => [{
    key: 'pdf', label: 'Podgląd PDF', type: 'html' as const,
    content: buildEstimatePreview(
      estimate,
      client ? {
        name: client.name, address: client.address,
        postalCity: `${client.postal_code || ''} ${client.city || ''}`.trim(),
        nip: client.nip, email: client.email, phone: client.phone,
      } : undefined,
      {
        name: companyMeta.name || user?.companyName, nip: companyMeta.nip,
        address: companyMeta.address, postalCity: companyMeta.postalCity,
        email: companyMeta.email || user?.email, phone: companyMeta.phone,
        bankAccount: companyMeta.bankAccount, logoUrl: companyMeta.logoUrl,
      },
    ),
  }], [client, companyMeta, estimate, user?.companyName, user?.email])

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDelete) { onDelete?.(estimate.id); setConfirmDelete(false) }
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
          <span className="proj-row__name">{estimate.number} · {estimate.name}</span>
          <span className="proj-row__meta">
            {clientName && <span className="proj-row__client">{clientName}</span>}
            {projectName && <span className="proj-row__number">📁 {projectName}</span>}
            {estimate.valid_until && (
              <span className="proj-row__number">ważna do {estimate.valid_until}</span>
            )}
          </span>
        </div>

        <div className="proj-row__right" onClick={e => e.stopPropagation()}>
          <span className="proj-row__number" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(estimate.total_gross)}
          </span>
          <span className={STATUS_CLASS[estimate.status]}>{STATUS_LABEL[estimate.status]}</span>
          <SignatureStatusBadge documentType="estimate" documentId={estimate.id} />
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
              title="Wyślij do klienta"
              onClick={e => { e.stopPropagation(); setSendOpen(true) }}
            >
              <Mail size={14} />
            </button>
            <button
              className="proj-action-btn"
              title="Podgląd PDF"
              onClick={e => { e.stopPropagation(); setPreviewOpen(true) }}
            >
              <FileText size={14} />
            </button>
            <button
              className="proj-action-btn"
              title="Edytuj"
              onClick={e => { e.stopPropagation(); onEdit(estimate) }}
            >
              <Edit2 size={14} />
            </button>
            {onDelete && (
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
          {estimate.items.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Pozycje ({estimate.items.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {estimate.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 16 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {item.name}
                      {item.catalog_item_id && (
                        <span title="Z katalogu usług" style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'var(--color-success-soft, #dcfce7)', color: 'var(--color-success, #16a34a)', fontWeight: 600 }}>📚</span>
                      )}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="actions-row" style={{ marginBottom: 16 }}>
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>PDF</Button>
            <Button variant="secondary" onClick={() => setSendOpen(true)}>Wyślij do klienta</Button>
            {estimate.status === 'accepted' && onCreateContract && (
              <Button variant="secondary" onClick={() => onCreateContract(estimate.id)}>
                Utwórz umowę
              </Button>
            )}
          </div>

          <EstimateNextActions estimate={estimate} />

          {(() => {
            const active = sigReqs?.find(r => r.status !== 'cancelled' && r.status !== 'expired')
            return active ? <ApprovalEventList signatureRequestId={active.id} /> : null
          })()}
        </div>
      )}

      <DocumentPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${estimate.number} · Podgląd dokumentu`}
        tabs={tabs}
      />

      <SendToClientModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        documentType="estimate"
        documentName={estimate.number}
        defaultEmail={client?.email}
        portalUrl={estimate.project_id ? `${getAppOrigin()}/client/project/${estimate.project_id}` : undefined}
      />

      <SendToApprovalModal
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        documentType="estimate"
        documentId={estimate.id}
        documentLabel={`${estimate.number} \u2013 ${estimate.name}`}
        documentContentForHash={JSON.stringify({
          id: estimate.id,
          number: estimate.number,
          name: estimate.name,
          total_gross: estimate.total_gross,
          valid_until: estimate.valid_until ?? null,
          items: estimate.items.map(i => ({
            id: i.id, name: i.name, quantity: i.quantity,
            unit: i.unit, unit_price: i.unit_price, vat_rate: i.vat_rate,
          })),
        })}
        projectId={estimate.project_id ?? null}
        defaultClientEmail={client?.email}
        defaultClientName={client?.name}
      />
    </div>
  )
}
