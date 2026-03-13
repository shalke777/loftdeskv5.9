import { useEffect, useRef, useState } from 'react'
import type { ParseInvoiceResult } from '@/features/expenses/api/expenses.api'

const OCR_STEPS = [
  'Przygotowuję obraz…',
  'Odczytuję tekst z faktury…',
  'Analizuję dane…',
  'Uzupełniam formularz…',
]

interface Props {
  file:        File | null
  parseResult: ParseInvoiceResult | null
  parsing:     boolean
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif']

export function ExpensePreviewPane({ file, parseResult, parsing }: Props) {
  const objectUrlRef = useRef<string | null>(null)
  const imgRef       = useRef<HTMLImageElement>(null)
  const [ocrStep, setOcrStep] = useState(0)

  // Cycle through OCR step messages while parsing is in progress
  useEffect(() => {
    if (!parsing) { setOcrStep(0); return }
    const id = setInterval(() => setOcrStep(s => Math.min(s + 1, OCR_STEPS.length - 1)), 4500)
    return () => clearInterval(id)
  }, [parsing])

  // Create and revoke object URL to avoid memory leaks
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    if (imgRef.current) imgRef.current.src = url
    return () => { URL.revokeObjectURL(url) }
  }, [file])

  if (!file && !parsing) return null

  const isImage = file ? IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name) : false
  const isPDF   = file ? file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') : false

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        background: 'var(--color-surface-soft, #f9fafb)',
        border: '1px solid var(--color-border, #e5e7eb)',
        borderRadius: 8, padding: 16, minHeight: 200,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted, #6b7280)' }}>
        Podgląd dokumentu
      </p>

      {/* File preview */}
      {file && isImage && (
        <img
          ref={imgRef}
          alt={file.name}
          style={{
            maxWidth: '100%', maxHeight: 320,
            objectFit: 'contain', borderRadius: 6,
            border: '1px solid var(--color-border, #e5e7eb)',
          }}
        />
      )}

      {file && isPDF && objectUrlRef.current && (
        <iframe
          src={objectUrlRef.current}
          title={file.name}
          style={{
            width: '100%', height: 320, border: 'none',
            borderRadius: 6, background: '#fff',
          }}
        />
      )}

      {file && !isImage && !isPDF && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#fff', borderRadius: 6 }}>
          <span style={{ fontSize: 28 }}>📎</span>
          <span style={{ fontSize: 13 }}>{file.name}</span>
        </div>
      )}

      {/* Parse status */}
      {parsing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted, #6b7280)' }}>
          <span className="spinner" style={{ width: 16, height: 16 }} />
          {OCR_STEPS[ocrStep]}
        </div>
      )}

      {parseResult && !parsing && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted, #6b7280)', lineHeight: 1.6 }}>
          {parseResult.vendor_name && <div>🏢 <strong>{parseResult.vendor_name}</strong></div>}
          {parseResult.invoice_number && <div>🔢 {parseResult.invoice_number}</div>}
          {parseResult.issue_date && <div>📅 {parseResult.issue_date}</div>}
          {parseResult.gross_amount != null && (
            <div>💰 {parseResult.gross_amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} {parseResult.currency}</div>
          )}
        </div>
      )}
    </div>
  )
}
