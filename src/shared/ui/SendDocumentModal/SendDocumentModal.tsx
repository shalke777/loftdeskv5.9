// =============================================================================
// SendDocumentModal — wysyłka dokumentu na email
// =============================================================================
// Wyświetla prosty modal z prefillowanym adresem email kontrahenta.
// Po kliknięciu "Wyślij" wywołuje /.netlify/functions/send-document.
// Jeśli RESEND_API_KEY nie jest skonfigurowany, funkcja zwraca ok=false
// i wyświetlamy czytelny komunikat.
// =============================================================================
import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Input } from '@/shared/ui/Input/Input'
import { Button } from '@/shared/ui/Button/Button'
import { supabase } from '@/shared/lib/supabase'

export type DocType = 'estimate' | 'contract' | 'invoice'

const DOC_LABEL: Record<DocType, string> = {
  estimate: 'wycenę',
  contract: 'umowę',
  invoice:  'fakturę',
}

interface Props {
  open:          boolean
  onClose:       () => void
  documentType:  DocType
  documentName:  string
  /** Pre-filled email from the linked client — user can override */
  defaultEmail?: string | null
}

export function SendDocumentModal({
  open,
  onClose,
  documentType,
  documentName,
  defaultEmail,
}: Props) {
  const [email,    setEmail]    = useState(defaultEmail ?? '')
  const [message,  setMessage]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [result,   setResult]   = useState<'idle' | 'ok' | 'no-provider' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset state every time the modal opens (or when defaultEmail changes)
  useEffect(() => {
    if (!open) return
    setEmail(defaultEmail ?? '')
    setMessage('')
    setSending(false)
    setResult('idle')
    setErrorMsg(null)
  }, [open, defaultEmail])

  async function handleSend() {
    if (!email.trim()) return
    setSending(true)
    setResult('idle')
    setErrorMsg(null)
    try {
      // Get operator JWT for authorization
      const { data: sessionData } = await supabase!.auth.getSession()
      let jwt = sessionData.session?.access_token
      if (!jwt) {
        const { data: fresh } = await supabase!.auth.refreshSession()
        jwt = fresh.session?.access_token
      }
      if (!jwt) throw new Error('Brak aktywnej sesji')

      const resp = await fetch('/.netlify/functions/send-document', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          to_email:      email.trim(),
          document_type: documentType,
          document_name: documentName,
          message:       message.trim() || null,
        }),
      })

      const body = await resp.json() as { ok?: boolean; email_sent?: boolean; error?: string; message?: string }

      if (!resp.ok || !body.ok) {
        if (body.error === 'email_provider_not_configured') {
          setResult('no-provider')
        } else {
          setResult('error')
          setErrorMsg(body.error ?? body.message ?? `HTTP ${resp.status}`)
        }
      } else if (body.email_sent === false) {
        setResult('no-provider')
      } else {
        setResult('ok')
      }
    } catch (e: unknown) {
      setResult('error')
      setErrorMsg(e instanceof Error ? e.message : 'Błąd wysyłki')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      title={`Wyślij ${DOC_LABEL[documentType]}: ${documentName}`}
      open={open}
      onClose={onClose}
    >
      {result === 'ok' ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Wysłano!</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Dokument został wysłany na <strong>{email}</strong>.
          </p>
          <div className="actions-row" style={{ justifyContent: 'center', marginTop: 20 }}>
            <Button onClick={onClose}>Zamknij</Button>
          </div>
        </div>
      ) : result === 'no-provider' ? (
        <div style={{ padding: '16px 0' }}>
          <div
            style={{
              background: 'var(--color-surface-soft)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '14px 16px',
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--color-text-secondary)',
            }}
          >
            <strong style={{ color: 'var(--color-text-primary)' }}>Wysyłka email nie jest skonfigurowana.</strong>
            <br />
            Aby wysyłać dokumenty automatycznie, ustaw zmienne{' '}
            <code>RESEND_API_KEY</code> i <code>RESEND_FROM_EMAIL</code> w ustawieniach Netlify.
            <br /><br />
            Możesz ręcznie wysłać dokument pobierając PDF z podglądu (ikona 📄) i dołączając do emaila.
          </div>
          <div className="actions-row">
            <Button variant="secondary" onClick={onClose}>Zamknij</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <Input
            label="Adres email odbiorcy"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kontrahent@firma.pl"
          />
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
              Wiadomość (opcjonalnie)
            </label>
            <textarea
              className="input"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Przekazuję w załączeniu dokument do akceptacji…"
              style={{ width: '100%', resize: 'vertical', fontSize: 13, padding: '8px 10px', boxSizing: 'border-box' }}
            />
          </div>

          {result === 'error' && errorMsg && (
            <div style={{ color: '#dc2626', fontSize: 13, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              Błąd: {errorMsg}
            </div>
          )}

          <div className="actions-row">
            <Button variant="secondary" onClick={onClose} disabled={sending}>Anuluj</Button>
            <Button
              onClick={handleSend}
              disabled={!email.trim() || sending}
              icon={<Send size={14} />}
            >
              {sending ? 'Wysyłam…' : 'Wyślij dokument'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
