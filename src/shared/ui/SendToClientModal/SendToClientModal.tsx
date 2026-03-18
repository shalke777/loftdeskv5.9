// =============================================================================
// SendToClientModal — wysyła dokument do klienta przez /.netlify/functions/send-document
// =============================================================================
// Użycie:
//   <SendToClientModal
//     open={open} onClose={() => setOpen(false)}
//     documentType="invoice" documentName="FV/2025/01"
//     defaultEmail={client?.email}
//     portalUrl={portalUrl}   // opcjonalne — dodaje przycisk CTA w emailu
//   />

import { useState, useEffect } from 'react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Button } from '@/shared/ui/Button/Button'
import { supabase } from '@/shared/lib/supabase'
import { useToast } from '@/shared/hooks/useToast'

const SEND_ENDPOINT = '/.netlify/functions/send-document'

const DOC_LABEL: Record<string, string> = {
  estimate: 'Wycena',
  contract: 'Umowa',
  invoice:  'Faktura',
}

interface Props {
  open:          boolean
  onClose:       () => void
  documentType:  'estimate' | 'invoice' | 'contract'
  documentName:  string
  defaultEmail?: string
  portalUrl?:    string
}

export function SendToClientModal({ open, onClose, documentType, documentName, defaultEmail, portalUrl }: Props) {
  const toast = useToast()
  const [email,   setEmail]   = useState(defaultEmail ?? '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? '')
      setMessage('')
      setSending(false)
    }
  }, [open, defaultEmail])

  async function handleSend() {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      toast.error('Nieprawidłowy adres email', 'Podaj poprawny adres email klienta.')
      return
    }

    setSending(true)
    try {
      if (!supabase) throw new Error('Brak połączenia z Supabase')
      const { data: session } = await supabase.auth.getSession()
      let jwt = session.session?.access_token
      if (!jwt) {
        const { data: fresh } = await supabase.auth.refreshSession()
        jwt = fresh.session?.access_token
      }
      if (!jwt) throw new Error('Brak aktywnej sesji — zaloguj się ponownie')

      const body: Record<string, string> = {
        to_email:      email.trim().toLowerCase(),
        document_type: documentType,
        document_name: documentName,
      }
      if (message.trim()) body.message = message.trim()
      if (portalUrl)       body.document_url = portalUrl

      const res = await fetch(SEND_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body:    JSON.stringify(body),
      })
      const data = await res.json() as { ok?: boolean; email_sent?: boolean; error?: string }

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Nie udało się wysłać wiadomości')
      }
      if (!data.email_sent) {
        toast.info(
          'Email nie został wysłany',
          'Serwis email nie jest skonfigurowany. Skontaktuj się z administratorem.',
        )
      } else {
        toast.success(
          `${DOC_LABEL[documentType] ?? 'Dokument'} wysłany`,
          `Email do ${email.trim()} wysłany pomyślnie.`,
        )
      }
      onClose()
    } catch (e) {
      toast.error('Błąd wysyłki', e instanceof Error ? e.message : 'Spróbuj ponownie.')
    } finally {
      setSending(false)
    }
  }

  const label = DOC_LABEL[documentType] ?? 'Dokument'

  return (
    <Modal open={open} onClose={onClose} title={`Wyślij ${label.toLowerCase()} do klienta`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="field__label" style={{ marginBottom: 4 }}>Dokument</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{label}: {documentName}</div>
        </div>

        <div>
          <label className="field__label" htmlFor="stc-email" style={{ display: 'block', marginBottom: 4 }}>
            Adres email klienta <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="stc-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@klient.pl"
            disabled={sending}
          />
        </div>

        <div>
          <label className="field__label" htmlFor="stc-msg" style={{ display: 'block', marginBottom: 4 }}>
            Wiadomość (opcjonalnie)
          </label>
          <textarea
            id="stc-msg"
            className="input"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Dzień dobry, przesyłamy dokumenty do zapoznania..."
            disabled={sending}
            style={{ resize: 'vertical', width: '100%' }}
          />
        </div>

        {portalUrl ? (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#166534',
            }}
          >
            ✓ Email b\u0119dzie zawiera\u0142 przycisk &ldquo;Otw\u00f3rz dokument w portalu&rdquo;
          </div>
        ) : (
          <div
            style={{
              background: '#fefce8',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#92400e',
            }}
          >
            Brak linku do portalu — klient otrzyma tylko informacj\u0119 o dokumencie.
            Wygeneruj link portalu (w sekcji &ldquo;Co dalej?&rdquo; na wycenie), aby do\u0142\u0105czy\u0107 bezpo\u015brednio do projektu.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Anuluj</Button>
          <Button onClick={handleSend} loading={sending}>
            {sending ? 'Wysyłanie…' : `Wyślij ${label.toLowerCase()}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
