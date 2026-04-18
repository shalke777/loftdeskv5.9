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
import { useCompanyMeta } from '@/features/settings/hooks/useCompanyMeta'

import { netlifyFn } from '@/shared/lib/functions'

const SEND_ENDPOINT = netlifyFn('send-document')

const DOC_LABEL: Record<string, string> = {
  estimate: 'Wycena',
  contract: 'Umowa',
  invoice:  'Faktura',
  package:  'Pakiet dokumentów',
}

function buildDefaultMessage(companyName: string) {
  const name = companyName.trim() || 'LoftDesk'
  return `Dzień dobry,

Serdecznie witamy i dziękujemy za zaufanie.

W załączeniu przesyłamy przygotowany dokument do wglądu. Prosimy o zapoznanie się z jego treścią. W razie jakichkolwiek pytań lub potrzeby wyjaśnień pozostajemy do pełnej dyspozycji.

Cieszymy się na możliwość współpracy i jesteśmy do Państwa dyspozycji na każdym etapie realizacji.

Z wyrazami szacunku,
Zespół ${name}`
}

interface Props {
  open:          boolean
  onClose:       () => void
  documentType:  'estimate' | 'invoice' | 'contract' | 'package'
  documentName:  string
  defaultEmail?: string
  portalUrl?:    string
  /** HTML content for client-side PDF generation (attached when no portalUrl) */
  pdfHtml?:      string
  /** For package sends: list of document numbers included (shown in modal + appended to message) */
  docSummary?:   string[]
}

export function SendToClientModal({ open, onClose, documentType, documentName, defaultEmail, portalUrl, pdfHtml, docSummary }: Props) {
  const toast = useToast()
  const companyMeta = useCompanyMeta()
  const [email,   setEmail]   = useState(defaultEmail ?? '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? '')
      if (documentType === 'package' && docSummary && docSummary.length > 0) {
        setMessage(`W załączeniu przesyłam pakiet dokumentów projektu:\n${docSummary.map(n => `• ${n}`).join('\n')}`)
      } else {
        setMessage(buildDefaultMessage(companyMeta.name || ''))
      }
      setSending(false)
    }
  }, [open, defaultEmail, documentType, docSummary, companyMeta.name])

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

      const body: Record<string, unknown> = {
        to_email:      email.trim().toLowerCase(),
        document_type: documentType,
        document_name: documentName,
      }
      if (message.trim()) body.message = message.trim()
      if (portalUrl)       body.document_url = portalUrl

      // Generate PDF attachment when pdfHtml is provided
      if (pdfHtml) {
        try {
          const { generatePdfBlob } = await import('@/services/pdf/pdfGenerator')
          const blob = await generatePdfBlob(pdfHtml)
          const buffer = await blob.arrayBuffer()
          const bytes = new Uint8Array(buffer)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          body.pdf_base64 = btoa(binary)
          body.pdf_filename = `${documentName.replace(/[/\\:*?"<>|]/g, '_')}.pdf`
        } catch (pdfErr) {
          console.warn('[SendToClientModal] PDF generation failed, sending without attachment:', pdfErr)
        }
      }

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
  const isPackage = documentType === 'package'

  return (
    <Modal open={open} onClose={onClose} title={isPackage ? 'Wyślij pakiet dokumentów do klienta' : `Wyślij ${label.toLowerCase()} do klienta`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isPackage ? (
          <div style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.30)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--color-info)' }}>
            <strong>Projekt:</strong> {documentName.replace(/^Dokumenty projektu – /, '')}
            {docSummary && docSummary.length > 0 && (
              <div style={{ marginTop: 6, lineHeight: 1.7 }}>
                <span style={{ fontWeight: 600 }}>Dokumenty w pakiecie:</span>
                {docSummary.map(n => <div key={n} style={{ paddingLeft: 8 }}>• {n}</div>)}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
              Klient otrzyma email z linkiem do projektu. Żadne pliki nie są dołączane bezpośrednio — dokumenty są dostępne w portalu klienta.
            </div>
          </div>
        ) : (
          <div>
            <div className="field__label" style={{ marginBottom: 4 }}>Dokument</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{label}: {documentName}</div>
          </div>
        )}

        <div>
          <label className="field__label" htmlFor="stc-email" style={{ display: 'block', marginBottom: 4 }}>
            Adres email klienta <span style={{ color: 'var(--color-error)' }}>*</span>
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
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Dzień dobry, przesyłamy dokumenty do zapoznania..."
            disabled={sending}
            style={{ resize: 'vertical', width: '100%' }}
          />
        </div>

        {pdfHtml && (
          <div style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.30)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--color-info)' }}>
            📎 PDF dokumentu zostanie dołączony do emaila jako załącznik.
          </div>
        )}

        {portalUrl ? (
          <div style={{ background: 'rgba(26,92,50,0.12)', border: '1px solid rgba(26,92,50,0.30)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--color-brand)' }}>
            ✓ Email będzie zawierał przycisk &ldquo;{isPackage ? 'Otwórz projekt w portalu' : 'Otwórz dokument w portalu'}&rdquo;
          </div>
        ) : !pdfHtml ? (
          <div style={{ background: 'rgba(212,150,10,0.12)', border: '1px solid rgba(212,150,10,0.30)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--color-accent)' }}>
            Brak linku do portalu — klient otrzyma tylko informację o dokumencie.
          </div>
        ) : null}

        <div className="actions-row" style={{ marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Anuluj</Button>
          <Button onClick={handleSend} loading={sending}>
            {sending ? 'Wysyłanie…' : isPackage ? 'Wyślij pakiet' : `Wyślij ${label.toLowerCase()}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
