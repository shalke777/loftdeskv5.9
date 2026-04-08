// =============================================================================
// InvoiceImportModal — OCR/AI import of invoices from photos and PDFs
// =============================================================================
// Reuses the expense parsing pipeline (callParseInvoice / callParseInvoiceAI)
// and maps results into a synthetic Invoice object that pre-fills InvoiceForm.
//
// F1.1 improvements:
//   • Editable preview: vendor/buyer fields + full line-items table with inline editing
//   • Auto-match client by buyer_nip against existing clients
//   • All warnings displayed with inline correction capability
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, FileUp, Loader2, Upload, AlertTriangle, CheckCircle2, Plus, Trash2, User } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Button } from '@/shared/ui/Button/Button'
import { callParseInvoice, callParseInvoiceAI, screenImageForInvoice } from '@/features/expenses/hooks/useParseInvoice'
import type { ParseInvoiceResult } from '@/features/expenses/api/expenses.api'
import type { Invoice, InvoiceItem } from '@/entities/invoice/model'
import { generateId } from '@/shared/lib/generateId'
import { formatCurrency } from '@/shared/lib/formatters'
import { useToast } from '@/shared/hooks/useToast'
import { useClients } from '@/features/clients/hooks/useClients'

interface Props {
  open: boolean
  onClose: () => void
  onImport: (invoice: Invoice) => void
  companyId: string
}

type Step = 'upload' | 'processing' | 'preview' | 'error'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
const MAX_SIZE = 20 * 1024 * 1024

// Editable line item (subset of InvoiceItem with string prices for inputs)
interface EditableItem {
  id: string
  description: string
  unit: string
  quantity: string
  unit_price: string
  vat_rate: string
}

function resultToEditableItems(result: ParseInvoiceResult): EditableItem[] {
  if (!result.line_items?.length) {
    return [{
      id: generateId(),
      description: result.notes || 'Usługa',
      unit: 'kpl',
      quantity: '1',
      unit_price: String(result.net_amount ?? 0),
      vat_rate: String(result.vat_rate ?? 23),
    }]
  }
  return result.line_items.map((li, idx) => ({
    id: generateId(),
    description: li.name || `Pozycja ${idx + 1}`,
    unit: li.unit || 'kpl',
    quantity: String(li.quantity ?? 1),
    unit_price: String(li.unit_net ?? 0),
    vat_rate: String(li.vat_rate ?? 23),
  }))
}

function editableToInvoiceItems(items: EditableItem[]): InvoiceItem[] {
  return items.map((item, idx) => ({
    id: item.id,
    description: item.description || `Pozycja ${idx + 1}`,
    unit: item.unit || 'kpl',
    quantity: Math.max(0.001, parseFloat(item.quantity) || 1),
    unit_price: parseFloat(item.unit_price) || 0,
    vat_rate: parseFloat(item.vat_rate) || 23,
    sort_order: idx + 1,
  }))
}

function buildInvoice(
  companyId: string,
  clientId: string | null,
  vendorName: string,
  vendorNip: string,
  result: ParseInvoiceResult,
  items: EditableItem[],
): Invoice {
  const today = new Date().toISOString().slice(0, 10)
  const invoiceItems = editableToInvoiceItems(items)
  const totalNet   = invoiceItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const totalGross = invoiceItems.reduce((s, i) => s + i.quantity * i.unit_price * (1 + i.vat_rate / 100), 0)

  return {
    id: generateId(),
    company_id: companyId,
    client_id: clientId,
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
    total_net:   Math.round(totalNet   * 100) / 100,
    total_gross: Math.round(totalGross * 100) / 100,
    ksef_status: null,
    ksef_ref: null,
    notes: [
      vendorName ? `Sprzedawca: ${vendorName}` : '',
      vendorNip  ? `NIP sprzedawcy: ${vendorNip}` : '',
      result.invoice_number ? `Nr dokumentu źródłowego: ${result.invoice_number}` : '',
      result.notes || '',
    ].filter(Boolean).join('\n'),
    created_at: new Date().toISOString(),
    items: invoiceItems,
  }
}

function confidenceColor(conf: number): string {
  if (conf >= 80) return 'var(--color-success)'
  if (conf >= 60) return 'var(--color-warning)'
  return 'var(--color-error)'
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  padding: '3px 6px',
  fontSize: 13,
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  width: '100%',
  boxSizing: 'border-box',
}

export function InvoiceImportModal({ open, onClose, onImport, companyId }: Props) {
  const toast = useToast()
  const fileRef   = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const { data: clients = [] } = useClients()

  const [step,      setStep]      = useState<Step>('upload')
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg,  setErrorMsg]  = useState('')
  const [result,    setResult]    = useState<ParseInvoiceResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver,  setDragOver]  = useState(false)

  // Editable preview state
  const [vendorName,  setVendorName]  = useState('')
  const [vendorNip,   setVendorNip]   = useState('')
  const [buyerName,   setBuyerName]   = useState('')
  const [buyerNip,    setBuyerNip]    = useState('')
  const [editItems,   setEditItems]   = useState<EditableItem[]>([])
  const [matchedClientId, setMatchedClientId] = useState<string | null>(null)
  const [matchedClientName, setMatchedClientName] = useState<string | null>(null)

  // Auto-match client when buyer_nip or clients change
  useEffect(() => {
    if (!buyerNip || !clients.length) { setMatchedClientId(null); setMatchedClientName(null); return }
    const normalized = buyerNip.replace(/[\s\-]/g, '')
    const match = clients.find(c => c.nip && c.nip.replace(/[\s\-]/g, '') === normalized)
    if (match) {
      setMatchedClientId(match.id)
      setMatchedClientName(match.name)
    } else {
      setMatchedClientId(null)
      setMatchedClientName(null)
    }
  }, [buyerNip, clients])

  const reset = useCallback(() => {
    setStep('upload')
    setStatusMsg('')
    setErrorMsg('')
    setResult(null)
    setVendorName(''); setVendorNip('')
    setBuyerName(''); setBuyerNip('')
    setEditItems([])
    setMatchedClientId(null); setMatchedClientName(null)
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
    if (file.type.startsWith('image/')) setPreviewUrl(URL.createObjectURL(file))

    try {
      setStatusMsg('Sprawdzam plik...')
      if (file.type.startsWith('image/')) {
        const screenResult = await screenImageForInvoice(file)
        if (screenResult === 'non_document_image') {
          setStep('error')
          setErrorMsg('Plik nie wygląda na fakturę ani dokument kosztowy. Spróbuj z innym zdjęciem.')
          return
        }
      }

      setStatusMsg('Analizuję dokument (OCR)...')
      let parseResult: ParseInvoiceResult | null = null
      try {
        parseResult = await callParseInvoice(file, file.type.startsWith('image/') ? 'camera' : 'pdf')
      } catch { /* OCR failed, try AI */ }

      if (!parseResult || (parseResult.extraction_confidence < 60) || (!parseResult.net_amount && !parseResult.gross_amount)) {
        setStatusMsg('Analizuję przez AI...')
        try {
          const aiResult = await callParseInvoiceAI(file)
          if (!parseResult || (aiResult.extraction_confidence > (parseResult?.extraction_confidence ?? 0))) {
            parseResult = aiResult
          }
        } catch { /* AI also failed */ }
      }

      if (!parseResult) {
        setStep('error')
        setErrorMsg('Nie udało się odczytać danych z dokumentu. Spróbuj z lepszym zdjęciem lub wpisz dane ręcznie.')
        return
      }

      // Populate editable fields
      setVendorName(parseResult.vendor_name ?? '')
      setVendorNip(parseResult.vendor_nip ?? '')
      setBuyerName(parseResult.buyer_name ?? '')
      setBuyerNip(parseResult.buyer_nip ?? '')
      setEditItems(resultToEditableItems(parseResult))
      setResult(parseResult)
      setStep('preview')
    } catch {
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

  const updateItem = (id: string, field: keyof EditableItem, value: string) => {
    setEditItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }
  const removeItem = (id: string) => setEditItems(prev => prev.filter(it => it.id !== id))
  const addItem = () => setEditItems(prev => [...prev, {
    id: generateId(), description: '', unit: 'kpl', quantity: '1', unit_price: '0', vat_rate: '23',
  }])

  const calcTotal = () => {
    let net = 0, gross = 0
    for (const it of editItems) {
      const q = parseFloat(it.quantity) || 0
      const p = parseFloat(it.unit_price) || 0
      const v = parseFloat(it.vat_rate) || 0
      net   += q * p
      gross += q * p * (1 + v / 100)
    }
    return { net: Math.round(net * 100) / 100, gross: Math.round(gross * 100) / 100 }
  }

  const handleImport = () => {
    if (!result) return
    const invoice = buildInvoice(companyId, matchedClientId, vendorName, vendorNip, result, editItems)
    onImport(invoice)
    toast.success('Dane zaimportowane', 'Sprawdź i uzupełnij formularz przed zapisaniem.')
    handleClose()
  }

  const totals = step === 'preview' ? calcTotal() : null

  return (
    <Modal open={open} onClose={handleClose} title="Import faktury z dokumentu">
      {/* ── Upload step ── */}
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
              borderRadius: 12, padding: '40px 24px', textAlign: 'center',
              background: dragOver ? 'var(--color-brand-soft)' : 'var(--color-surface)',
              transition: 'all 0.15s', cursor: 'pointer',
            }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Przeciągnij plik tutaj</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>lub kliknij, aby wybrać • JPG, PNG, PDF • maks. 20 MB</p>
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

      {/* ── Processing step ── */}
      {step === 'processing' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Loader2 size={40} style={{ color: 'var(--color-brand)', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 600, marginTop: 16 }}>{statusMsg || 'Przetwarzam...'}</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>To może zająć kilka sekund.</p>
          {previewUrl && <img src={previewUrl} alt="Preview" style={{ maxWidth: 200, maxHeight: 120, borderRadius: 8, marginTop: 16, opacity: 0.7 }} />}
        </div>
      )}

      {/* ── Preview + editable step ── */}
      {step === 'preview' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Confidence badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
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
              {result.extraction_confidence < 70 && ' — popraw dane przed importem'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
              {result.parser_source}
            </span>
          </div>

          {/* Warnings */}
          {result.extraction_warnings?.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--color-warning-soft)', borderRadius: 8, fontSize: 13 }}>
              <strong>⚠️ Uwagi AI:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {result.extraction_warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Document meta */}
          {result.invoice_number && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Nr dokumentu źródłowego: <strong style={{ color: 'var(--color-text)' }}>{result.invoice_number}</strong>
              {result.issue_date && <span style={{ marginLeft: 12 }}>Data: <strong style={{ color: 'var(--color-text)' }}>{result.issue_date}</strong></span>}
            </div>
          )}

          {/* Vendor / Buyer grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Sprzedawca (wystawca)
              </div>
              <input style={inputStyle} placeholder="Nazwa sprzedawcy" value={vendorName} onChange={e => setVendorName(e.target.value)} />
              <input style={{ ...inputStyle, marginTop: 4 }} placeholder="NIP sprzedawcy" value={vendorNip} onChange={e => setVendorNip(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nabywca (kupujący)
              </div>
              <input style={inputStyle} placeholder="Nazwa nabywcy" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
              <input style={{ ...inputStyle, marginTop: 4 }} placeholder="NIP nabywcy" value={buyerNip} onChange={e => setBuyerNip(e.target.value)} />
              {matchedClientName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--color-success)' }}>
                  <User size={13} />
                  <span>Dopasowano klienta: <strong>{matchedClientName}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Line items table */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pozycje ({editItems.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-soft)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)' }}>Nazwa</th>
                    <th style={{ padding: '6px 4px', width: 55, fontSize: 12, color: 'var(--color-text-muted)' }}>Ilość</th>
                    <th style={{ padding: '6px 4px', width: 40, fontSize: 12, color: 'var(--color-text-muted)' }}>Jm</th>
                    <th style={{ padding: '6px 4px', width: 80, fontSize: 12, color: 'var(--color-text-muted)' }}>Cena netto</th>
                    <th style={{ padding: '6px 4px', width: 50, fontSize: 12, color: 'var(--color-text-muted)' }}>VAT%</th>
                    <th style={{ padding: '6px 4px', width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '4px 8px 4px 4px' }}>
                        <input style={inputStyle} value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                      </td>
                      <td style={{ padding: '4px 2px' }}>
                        <input style={{ ...inputStyle, textAlign: 'right' }} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} />
                      </td>
                      <td style={{ padding: '4px 2px' }}>
                        <input style={inputStyle} value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} />
                      </td>
                      <td style={{ padding: '4px 2px' }}>
                        <input style={{ ...inputStyle, textAlign: 'right' }} value={item.unit_price} onChange={e => updateItem(item.id, 'unit_price', e.target.value)} />
                      </td>
                      <td style={{ padding: '4px 2px' }}>
                        <input style={{ ...inputStyle, textAlign: 'right' }} value={item.vat_rate} onChange={e => updateItem(item.id, 'vat_rate', e.target.value)} />
                      </td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}>
                        <button
                          onClick={() => removeItem(item.id)}
                          title="Usuń pozycję"
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addItem}
              style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
            >
              <Plus size={14} /> Dodaj pozycję
            </button>
          </div>

          {/* Calculated totals */}
          {totals && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, fontSize: 14, padding: '10px 0', borderTop: '1px solid var(--color-border-light)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Netto: <strong>{formatCurrency(totals.net)}</strong></span>
              <span>Brutto: <strong style={{ fontSize: 16 }}>{formatCurrency(totals.gross)}</strong></span>
            </div>
          )}

          {/* Actions */}
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

      {/* ── Error step ── */}
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
