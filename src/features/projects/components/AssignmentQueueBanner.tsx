import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import { useAssignmentQueue, useResolveAssignment } from '@/features/projects/hooks/useProjectDocuments'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useEstimates } from '@/features/estimates/hooks/useEstimates'
import { useContracts } from '@/features/contracts/hooks/useContracts'
import { useInvoices } from '@/features/invoices/hooks/useInvoices'

const DOC_LABEL: Record<string, string> = {
  estimate: 'Wycena',
  contract: 'Umowa',
  invoice: 'Faktura',
  note: 'Notatka',
  protocol: 'Protokół',
  other: 'Dokument',
}

export function AssignmentQueueBanner() {
  const { data: queue = [] } = useAssignmentQueue()
  const { data: projects = [] } = useProjects()
  const resolve = useResolveAssignment()
  const { data: estimates = [] } = useEstimates()
  const { data: contracts = [] } = useContracts()
  const { data: invoices = [] } = useInvoices()

  const resolveDocName = (docType: string, docId: string): string => {
    if (docType === 'estimate') return estimates.find(e => e.id === docId)?.number ?? docId.slice(0, 8)
    if (docType === 'contract') return contracts.find(c => c.id === docId)?.number ?? docId.slice(0, 8)
    if (docType === 'invoice') return invoices.find(i => i.id === docId)?.number ?? docId.slice(0, 8)
    return docId.slice(0, 8)
  }

  if (queue.length === 0) return null

  const pending = queue.filter((item) => !item.resolved_at)
  if (pending.length === 0) return null

  return (
    <Card
      style={{
        border: '2px solid #f6ad55',
        marginBottom: 16,
        background: '#fffbf5',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ color: '#c05621', fontSize: 14 }}>
          ⚠ {pending.length} {pending.length === 1 ? 'dokument wymaga' : 'dokumenty wymagają'} przypisania do projektu
        </strong>
      </div>
      {pending.slice(0, 5).map((item) => {
        const suggested = item.suggested_project_id
          ? projects.find((p) => p.id === item.suggested_project_id)
          : null
        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '8px 0',
              borderTop: '1px solid #f6e05e',
              flexWrap: 'wrap',
              fontSize: 13,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>{DOC_LABEL[item.doc_type] ?? item.doc_type}</strong>
              <span style={{ color: '#718096', fontSize: 12, marginLeft: 6 }}>
                {resolveDocName(item.doc_type, item.doc_id)}
              </span>
              {suggested && (
                <span style={{ color: '#718096', marginLeft: 8 }}>
                  → sugerowany:{' '}
                  <strong style={{ color: '#2d3748' }}>{suggested.name}</strong>
                  <span style={{ color: '#a0aec0', fontSize: 11, marginLeft: 4 }}>
                    ({item.confidence}%)
                  </span>
                </span>
              )}
              {!suggested && (
                <span style={{ color: '#a0aec0', marginLeft: 8 }}>brak sugestii</span>
              )}
            </span>
            {suggested && (
              <Button
                variant="secondary"
                size="sm"
                loading={resolve.isPending}
                onClick={() =>
                  resolve.mutate({
                    id: item.id,
                    resolution: 'accepted',
                    projectId: suggested.id,
                  })
                }
              >
                Zatwierdź
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              loading={resolve.isPending}
              onClick={() => resolve.mutate({ id: item.id, resolution: 'rejected' })}
            >
              Pomiń
            </Button>
          </div>
        )
      })}
      {pending.length > 5 && (
        <p style={{ fontSize: 12, color: '#718096', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f6e05e' }}>
          … i {pending.length - 5} więcej
        </p>
      )}
    </Card>
  )
}
