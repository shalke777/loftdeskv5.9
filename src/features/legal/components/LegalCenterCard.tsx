import { ExternalLink, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { Card } from '@/shared/ui/Card/Card'
import { useLegalAcceptances } from '@/features/legal/hooks/useLegal'
import { LEGAL_DOCUMENTS, REQUIRED_VERSIONS } from '@/features/legal/config/legalDocuments'
import { Spinner } from '@/shared/ui/Spinner/Spinner'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function LegalCenterCard() {
  const { data: acceptances, isLoading } = useLegalAcceptances()

  const acceptedMap: Record<string, string> = {} // key → accepted_at for current version
  for (const a of acceptances ?? []) {
    const current = REQUIRED_VERSIONS[a.document_key]
    if (current && a.document_version === current) {
      acceptedMap[a.document_key] = a.accepted_at
    }
  }

  return (
    <Card>
      <h3>Dokumenty prawne i zgody</h3>
      <p className="field__label" style={{ marginBottom: 16 }}>
        Poniżej widoczne są dokumenty wymagające akceptacji oraz status Twoich zgód.
      </p>

      {isLoading ? (
        <Spinner />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {LEGAL_DOCUMENTS.map((doc) => {
            const acceptedAt = doc.required ? acceptedMap[doc.key] : undefined
            const isCurrent = acceptedAt !== undefined
            const isRequired = doc.required

            return (
              <div key={doc.key} className="list-row" style={{ alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {isRequired ? (
                    isCurrent ? (
                      <CheckCircle2 size={18} style={{ color: 'var(--color-success)', marginTop: 2, flexShrink: 0 }} />
                    ) : (
                      <AlertCircle size={18} style={{ color: 'var(--color-warning)', marginTop: 2, flexShrink: 0 }} />
                    )
                  ) : (
                    <Clock size={18} style={{ color: 'var(--color-text-tertiary)', marginTop: 2, flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{doc.label}</div>
                    <div className="field__label" style={{ fontSize: 12 }}>
                      Wersja {doc.version} · {doc.effectiveDate}
                      {isRequired && isCurrent && (
                        <> · <span style={{ color: 'var(--color-success)' }}>Zaakceptowano {formatDate(acceptedAt)}</span></>
                      )}
                      {isRequired && !isCurrent && (
                        <> · <span style={{ color: 'var(--color-warning)' }}>Brak akceptacji bieżącej wersji</span></>
                      )}
                    </div>
                  </div>
                </div>
                {doc.path && (
                  <a
                    href={doc.path}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-brand)', textDecoration: 'none', flexShrink: 0 }}
                  >
                    Otwórz <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="field__label" style={{ marginTop: 16, fontSize: 12 }}>
        Dokumenty dostępne pod adresem{' '}
        <a href="/legal/regulamin" target="_blank" rel="noreferrer">
          /legal
        </a>
        . Kontakt: szalecki.p@gmail.com
      </p>
    </Card>
  )
}
