import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { DOC_CONTENT, DOC_LABELS, type LegalDocKey } from '@/features/legal/lib/docContent'
import { parseMarkdown } from '@/features/legal/lib/parseMarkdown'
import { LEGAL_DOC_BY_KEY } from '@/features/legal/config/legalDocuments'

interface Props {
  docKey: LegalDocKey
  /** Show a back navigation button.  Default: true */
  showBack?: boolean
}

export function LegalDocPage({ docKey, showBack = true }: Props) {
  const raw = DOC_CONTENT[docKey]
  const label = DOC_LABELS[docKey] ?? docKey
  const meta = LEGAL_DOC_BY_KEY[docKey]

  const html = useMemo(() => (raw ? parseMarkdown(raw) : ''), [raw])

  if (!raw) {
    return (
      <div className="legal-page">
        <p className="muted">Dokument niedostępny.</p>
      </div>
    )
  }

  return (
    <div className="legal-page">
      {showBack && (
        <div style={{ marginBottom: 16 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" icon={<ArrowLeft size={16} />} size="sm">
              Wróć
            </Button>
          </Link>
        </div>
      )}

      <div className="legal-page__header">
        <h1 className="legal-page__title">{label}</h1>
        {meta && (
          <p className="legal-page__meta">
            Wersja {meta.version} · wejście w życie {meta.effectiveDate}
          </p>
        )}
      </div>

      <Card className="legal-page__card">
        {/* eslint-disable-next-line react/no-danger */}
        <div
          className="legal-prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Card>
    </div>
  )
}
