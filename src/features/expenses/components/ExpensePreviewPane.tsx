import { useEffect, useState } from 'react'
import type { AnalysisResult } from '@/services/ai/analysis.types'

const OCR_STEPS = [
  'Przygotowuję obraz…',
  'Odczytuję tekst z faktury…',
  'Analizuję dane…',
  'Uzupełniam formularz…',
]

interface Props {
  file:        File | null
  parseResult: AnalysisResult | null
  parsing:     boolean
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif']

export function ExpensePreviewPane({ file, parseResult, parsing }: Props) {
  // useState (not useRef) so React re-renders when the blob URL is ready
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [ocrStep, setOcrStep] = useState(0)

  // Cycle through OCR step messages while parsing is in progress
  useEffect(() => {
    if (!parsing) { setOcrStep(0); return }
    const id = setInterval(() => setOcrStep(s => Math.min(s + 1, OCR_STEPS.length - 1)), 4500)
    return () => clearInterval(id)
  }, [parsing])

  // Create and revoke object URL — stored in state so JSX re-renders when ready
  useEffect(() => {
    if (!file) { setBlobUrl(null); return }
    const url = URL.createObjectURL(file)
    setBlobUrl(url)
    return () => { URL.revokeObjectURL(url); setBlobUrl(null) }
  }, [file])

  if (!file && !parsing) return null

  const isImage = file ? IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name) : false
  const isPDF   = file ? file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') : false

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        background: 'var(--color-surface-soft)',
        border: '1px solid var(--color-border)',
        borderRadius: 8, padding: 16, minHeight: 200,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
        Podgląd dokumentu
      </p>

      {/* Image preview — src set via state blobUrl to guarantee re-render */}
      {file && isImage && blobUrl && (
        <img
          src={blobUrl}
          alt={file.name}
          style={{
            maxWidth: '100%', maxHeight: 320,
            objectFit: 'contain', borderRadius: 6,
            border: '1px solid var(--color-border)',
          }}
        />
      )}

      {/* PDF preview — file info card (no iframe to avoid CSP / chrome-error cascade) */}
      {file && isPDF && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', background: 'var(--color-surface)', borderRadius: 6,
          border: '1px solid var(--color-border)',
        }}>
          <span style={{ fontSize: 40, flexShrink: 0, lineHeight: 1 }}>📄</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
              {(file.size / 1024).toFixed(0)} KB · PDF
            </div>
          </div>
        </div>
      )}

      {file && !isImage && !isPDF && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'var(--color-surface)', borderRadius: 6 }}>
          <span style={{ fontSize: 28 }}>📎</span>
          <span style={{ fontSize: 13 }}>{file.name}</span>
        </div>
      )}

      {/* Parse status */}
      {parsing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <span className="spinner" style={{ width: 16, height: 16 }} />
          {OCR_STEPS[ocrStep]}
        </div>
      )}

      {parseResult && !parsing && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          {parseResult.document_fields?.vendor_name && <div>🏢 <strong>{parseResult.document_fields.vendor_name}</strong></div>}
          {parseResult.document_fields?.document_number && <div>🔢 {parseResult.document_fields.document_number}</div>}
          {parseResult.document_fields?.issue_date && <div>📅 {parseResult.document_fields.issue_date}</div>}
          {parseResult.document_fields?.gross_amount != null && (
            <div>💰 {parseResult.document_fields.gross_amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} {parseResult.document_fields.currency ?? 'PLN'}</div>
          )}
        </div>
      )}
    </div>
  )
}
