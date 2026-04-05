// =============================================================================
// InvoiceImportModal — OCR/AI import of invoices from photos and PDFs
// =============================================================================
// Reuses the expense parsing pipeline (callParseInvoice / callParseInvoiceAI)
// and maps results into a synthetic Invoice object that pre-fills InvoiceForm.
// =============================================================================

import { useCallback, useRef, useState } from 'react'
import { Camera, FileUp, Loader2, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Button } from '@/shared/ui/Button/Button'
import { callParseInvoice, callParseInvoiceAI, screenImageForInvoice } from '@/features/expenses/hooks/useParseInvoice'
import type { ParseInvoiceResult } from '@/features/expenses/api/expenses.api'
import type { Invoice, InvoiceItem } from '@/entities/invoice/model'
import { generateId } from '@/shared/lib/generateId'
import { formatCurrency } from '@/shared/lib/formatters'
import { useToast } from '@/shared/hooks/useToast'

interface Props {
  open: boolean
  onClose: () => void
  onImport: (invoice: Invoice) => void
  companyId: string
}

type Step = 'upload' | 'processing' | 'preview' | 'error'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
const MAX_SIZE = 20 * 1024 * 1024

function mapLineItems(result: ParseInvoiceResult): InvoiceItem[] {
  if (!result.line_items?.length) {
    return [{
      id: generateId(),
      description: result.notes || 'Usługa',
      unit: 'kpl',
      quantity: 1,
      unit_price: result.net_amount ?? 0,
      vat_rate: result.vat_rate ?? 23,
      sort_order: 1,
    }]
  }
  return result.line_items.map((li, idx) => ({
    id: generateId(),
    description: li.name || `Pozycja ${idx + 1}`,
    unit: li.unit || 'kpl',
    quantity: li.quantity ?? 1,
    unit_price: li.unit_net ?? 0,
    vat_rate: li.vat_rate ?? 23,
    sort_order: idx + 1,
  }))
}

function mapToInvoice(result: ParseInvoiceResult, companyId: string): Invoice {
  const today = new Date().toISOString().slice(0, 10)
  const items = mapLineItems(result)
  const totalNet = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const totalGross = items.reduce((sum, i) => sum + i.quantity * i.unit_price * (1 + i.vat_rate / 100), 0)

  return {
    id: generateId(),
    company_id: companyId,
    client_id: null,
    project_id: null,
    contract_id: null,
    number: null,
    invoice_type: 'standard',
    status: 'draft',
    issue_date: result.issue_date || today,
    sale_date: result.sale_date || result.issue_date || today,
    issue_place: null,
    due_date: result.payment_due_date || null,
    payment_method: 'transfer',
    bank_account: null,
    tranche_id: null,
    advance_total: null,
    total_net: Math.round(totalNet * 100) / 100,
    total_gross: Math.round(totalGross * 100) / 100,
    ksef_status: null,
    ksef_ref: null,
    notes: [
      result.vendor_name ? `Sprzedawca: ${result.vendor_name}` : '',
      result.vendor_nip ? `NIP: ${result.vendor_nip}` : '',
      result.invoice_number ? `Nr dokumentu źródłowego: ${result.invoice_number}` : '',
      result.notes || '',
    ].filter(Boolean).join('\n'),
    created_at: new Date().toISOString(),
    items,
  }
}

function confidenceColor(conf: number): string {
  if (conf >= 80) return 'var(--color-success)'
  if (conf >= 60) return 'var(--color-warning)'
  return 'var(--color-error)'
}

export function InvoiceImportModal({ open, onClose, onImport, companyId }: Props) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<ParseInvoiceResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const reset = useCallback(() => {
    setStep('upload')
    setStatusMsg('')
    setErrorMsg('')
    setResult(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }, [previewUrl])

  const handleClose = () => { reset(); onClose() }

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.endsWith('.pdf')) {
      setStep('error')
      setErrorMsg('Nieobsługiwany format pliku. Akceptowane: JPG, PNG, WEBP, HEIC, PDF.')
      return
    }
    if (file.size > MAX_SIZE) {
      setStep('error')
      setErrorMsg('Plik zbyt duży. Maksymalny rozmiar: 20 MB.')
      return
    }

    setStep('processing')

    // Preview for images
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file))
    }

    try {
      // Screen image first
      setStatusMsg('Sprawdzam plik...')
      if (file.type.startsWith('image/')) {
        const screenResult = await screenImageForInvoice(file)
        if (screenResult === 'non_document_image') {
          setStep('error')
          setErrorMsg('Plik nie wygląda na fakturę ani dokument kosztowy. Spróbuj z innym zdjęciem.')
          return
        }
      }

      // OCR extraction
      setStatusMsg('Analizuję dokument (OCR)...')
      let parseResult: ParseInvoiceResult | null = null
      try {
        parseResult = await callParseInvoice(file, file.type.startsWith('image/') ? 'camera' : 'pdf')
      } catch {
        // OCR failed, try AI
      }

      // AI fallback if OCR failed or low confidence
      if (!parseResult || (parseResult.extraction_confidence < 60) || (!parseResult.net_amount && !parseResult.gross_amount)) {
        setStatusMsg('Analizuję przez AI...')
        try {
          const aiResult = await callParseInvoiceAI(file)
          if (!parseResult || (aiResult.extraction_confidence > (parseResult?.extraction_confidence ?? 0))) {
            parseResult = aiResult
          }
        } catch {
          // AI also failed — use whatever OCR gave us
        }
      }

      if (!parseResult) {
        setStep('error')
        setErrorMsg('Nie udało się odczytać danych z dokumentu. Spróbuj z lepszym zdjęciem lub wpisz dane ręcznie.')
        return
      }

      setResult(parseResult)
      setStep('preview')
    } catch (err) {
      setStep('error')
      setErrorMsg('Wystąpił błąd podczas analizy dokumentu. Spróbuj ponownie.')
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleImport = () => {
    if (!result) return
    const invoice = mapToInvoice(result, companyId)
    onImport(invoice)
    toast.success('Dane zaimportowane', 'Sprawdź i uzupełnij formularz przed zapisaniem.')
    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import faktury z dokumentu">
      {step === 'upload' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Prześlij zdjęcie lub PDF faktury — system odczyta dane automatycznie przez OCR i AI.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? 'var(--color-brand)' : 'var(--color-border)'}`,
              borderRadius: 12,
              padding: '40px 24px',
              textAlign: 'center',
              background: dragOver ? 'var(--color-brand-soft)' : 'var(--color-surface)',
              transition: 'all 0.15s',
              cursor: 'pointer',
            }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Przeciągnij plik tutaj</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              lub kliknij, aby wybrać • JPG, PNG, PDF • maks. 20 MB
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileChange} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} style={{ flex: 1 }}>
              <FileUp size={16} style={{ marginRight: 6 }} /> Wybierz plik
            </Button>
            <Button variant="secondary" onClick={() => cameraRef.current?.click()} style={{ flex: 1 }}>
              <Camera size={16} style={{ marginRight: 6 }} /> Zrób zdjęcie
            </Button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Loader2 size={40} style={{ color: 'var(--color-brand)', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 600, marginTop: 16 }}>{statusMsg || 'Przetwarzam...'}</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            To może zająć kilka sekund.
          </p>
          {previewUrl && (
            <img src={previewUrl} alt="Preview" style={{ maxWidth: 200, maxHeight: 120, borderRadius: 8, marginTop: 16, opacity: 0.7 }} />
          )}
        </div>
      )}

      {step === 'preview' && result && (
        <div>
          {/* Confidence badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            padding: '10px 14px', borderRadius: 8,
            background: result.extraction_confidence >= 70 ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
          }}>
            {result.extraction_confidence >= 70
              ? <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
              : <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />}
            <span style={{ fontSize: 13 }}>
              Pewność odczytu: <strong style={{ color: confidenceColor(result.extraction_confidence) }}>
                {result.extraction_confidence}%
              </strong>
              {result.extraction_confidence < 70 && ' — sprawdź dane przed zapisaniem'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
              {result.parser_source}
            </span>
          </div>

          {/* Extracted data summary */}
          <div style={{ display: 'grid', gap: 8, fontSize: 14, marginBottom: 16 }}>
            {result.invoice_number && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--color-text-muted)', minWidth: 100 }}>Nr faktury</span>
                <strong>{result.invoice_number}</strong>
              </div>
            )}
            {result.vendor_name && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--color-text-muted)', minWidth: 100 }}>Sprzedawca</span>
                <span>{result.vendor_name}{result.vendor_nip ? ` (NIP: ${result.vendor_nip})` : ''}</span>
              </div>
            )}
            {result.buyer_name && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--color-text-muted)', minWidth: 100 }}>Nabywca</span>
                <span>{result.buyer_name}{result.buyer_nip ? ` (NIP: ${result.buyer_nip})` : ''}</span>
              </div>
            )}
            {result.issue_date && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--color-text-muted)', minWidth: 100 }}>Data wystawienia</span>
                <span>{result.issue_date}</span>
              </div>
            )}
            {(result.net_amount != null || result.gross_amount != null) && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--color-text-muted)', minWidth: 100 }}>Kwota</span>
                <strong>
                  {result.gross_amount != null ? formatCurrency(result.gross_amount) : '—'} brutto
                  {result.net_amount != null ? ` (${formatCurrency(result.net_amount)} netto)` : ''}
                </strong>
              </div>
            )}
            {result.line_items && result.line_items.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--color-text-muted)', minWidth: 100 }}>Pozycje</span>
                <span>{result.line_items.length} {result.line_items.length === 1 ? 'pozycja' : 'pozycji'}</span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {result.extraction_warnings?.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--color-warning-soft)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <strong>Uwagi:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {result.extraction_warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={handleImport} style={{ flex: 1 }}>
              Utwórz fakturę z tych danych
            </Button>
            <Button variant="secondary" onClick={reset}>
              Spróbuj inny plik
            </Button>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <AlertTriangle size={40} style={{ color: 'var(--color-error)', marginBottom: 12 }} />
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Nie udało się zaimportować</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>{errorMsg}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button onClick={reset}>Spróbuj ponownie</Button>
            <Button variant="secondary" onClick={handleClose}>Zamknij</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
