import { useState } from 'react'
import type { Project } from '@/entities/project/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Card } from '@/shared/ui/Card/Card'
import {
  useProjectDocuments,
  useUnlinkDocument,
  useProjectExport,
} from '@/features/projects/hooks/useProjectDocuments'

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

export function ProjectDocuments({ project }: { project: Project }) {
  const { data: docs = [], isLoading } = useProjectDocuments(project.id)
  const unlink = useUnlinkDocument()
  const { exportZip, loading: exporting } = useProjectExport(project.id)
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
        <Button
          variant="secondary"
          size="sm"
          loading={exporting}
          onClick={() => exportZip(selected.size > 0 ? [...selected] : undefined)}
          disabled={docs.length === 0}
        >
          {selected.size > 0 ? `Pobierz zaznaczone (${selected.size})` : 'Pobierz paczkę'}
        </Button>
      </div>

      {isLoading ? (
        <p style={{ color: '#718096', fontSize: 14 }}>Ładowanie dokumentów…</p>
      ) : docs.length === 0 ? (
        <p style={{ color: '#718096', fontSize: 14 }}>
          Brak dokumentów. Dokumenty są przypisywane automatycznie po powiązaniu z projektem.
        </p>
      ) : (
        Object.entries(grouped).map(([type, typeDocs]) => (
          <div key={type} style={{ marginBottom: 16 }}>
            <p
              style={{
                fontWeight: 600,
                fontSize: 12,
                color: '#4a5568',
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
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid #f7fafc',
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(doc.doc_id)}
                  onChange={() => toggleSelect(doc.doc_id)}
                  style={{ flexShrink: 0 }}
                />
                <span
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: 11, color: '#718096' }}
                  title={doc.doc_id}
                >
                  {doc.doc_id.slice(0, 12)}…
                </span>
                {doc.linked_automatically && (
                  <Badge variant="default">auto</Badge>
                )}
                {doc.linked_manually && (
                  <Badge variant="warning">ręcznie</Badge>
                )}
                {doc.source_doc_type && (
                  <span style={{ fontSize: 11, color: '#a0aec0' }}>
                    z: {TYPE_LABEL[doc.source_doc_type] ?? doc.source_doc_type}
                  </span>
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
              </div>
            ))}
          </div>
        ))
      )}
    </Card>
  )
}

