// =============================================================================
// SendToApprovalModal.tsx — operator wysyła dokument do akceptacji klienta
// =============================================================================

import { useState, useEffect } from 'react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Button } from '@/shared/ui/Button/Button'
import { computeDocumentHash } from '@/features/signatures/api/signature-requests.api'
import { useCreateSignatureRequest } from '@/features/signatures/hooks/useSignatureRequests'
import { useAuth, useCompanyId } from '@/features/auth/hooks/useAuth'
import type { SignatureDocumentType } from '@/features/signatures/types/signature.types'

interface Props {
  open: boolean
  onClose: () => void
  documentType: SignatureDocumentType
  documentId: string
  documentLabel: string
  /** Deterministic JSON/text string of the document — used to compute SHA-256 */
  documentContentForHash: string
  projectId: string | null
  defaultClientEmail?: string
  defaultClientName?: string
  onSent?: () => void
}

export function SendToApprovalModal({
  open, onClose,
  documentType, documentId, documentLabel, documentContentForHash,
  projectId, defaultClientEmail, defaultClientName,
  onSent,
}: Props) {
  const { user } = useAuth()
  const companyId = useCompanyId()
  const [email, setEmail]   = useState(defaultClientEmail ?? '')
  const [name, setName]     = useState(defaultClientName ?? '')
  const [hash, setHash]     = useState<string | null>(null)
  const [error, setError]   = useState('')
  const createRequest = useCreateSignatureRequest(documentType, documentId)

  useEffect(() => {
    if (!open) return
    setEmail(defaultClientEmail ?? '')
    setName(defaultClientName ?? '')
    setError('')
    setHash(null)
    computeDocumentHash(documentContentForHash)
      .then(setHash)
      .catch(() => setHash('error'))
  }, [open, defaultClientEmail, defaultClientName, documentContentForHash])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimEmail = email.trim().toLowerCase()
    const trimName  = name.trim()
    if (!trimEmail || !trimName) { setError('Podaj e-mail i imię klienta.'); return }
    if (!hash || hash === 'error') { setError('Nie udało się obliczyć skrótu dokumentu.'); return }
    if (!companyId || !user) { setError('Brak informacji o firmie. Odśwież stronę.'); return }
    try {
      await createRequest.mutateAsync({
        companyId,
        createdByUserId: user.id,
        projectId,
        documentType,
        documentId,
        documentHash:  hash,
        documentLabel,
        mode:          'approval_only',
        participants:  [{ role: 'approver', name: trimName, email: trimEmail }],
      })
      onSent?.()
      onClose()
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Nie udało się wysłać. Spróbuj ponownie.')
    }
  }

  return (
    <Modal title="Wyślij dokument do akceptacji" open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Document info block */}
        <div style={{
          padding: '12px 14px',
          background: 'var(--color-surface-alt)',
          borderRadius: 10,
          fontSize: 13,
        }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Dokument
          </div>
          <div style={{ fontWeight: 600 }}>{documentLabel}</div>
          <div style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>
            SHA-256: {hash && hash !== 'error' ? hash.slice(0, 16) + '…' : hash === 'error' ? 'błąd obliczeń' : 'obliczanie…'}
          </div>
        </div>

        {/* Client email */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            E-mail klienta
          </label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="klient@przykład.pl"
            required
            autoComplete="off"
          />
        </div>

        {/* Client name */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Imię i nazwisko klienta
          </label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jan Kowalski"
            required
          />
        </div>

        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
          Klient zobaczy prośbę o akceptację w zakładce <strong>Akceptacje</strong> swojego portalu.
          Jego decyzja zostanie zapisana z datą, skrótem dokumentu i identyfikatorem sesji.
        </p>

        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: 12, margin: 0 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <Button type="button" variant="ghost" onClick={onClose}>Anuluj</Button>
          <Button
            type="submit"
            disabled={createRequest.isPending || !hash || hash === 'error'}
          >
            {createRequest.isPending ? 'Wysyłanie…' : 'Wyślij do akceptacji'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
