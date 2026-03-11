import { useRef } from 'react'
import type { ExpenseSourceType } from '@/features/expenses/api/expenses.api'

interface Props {
  onCapture: (file: File, sourceType: ExpenseSourceType) => void
  onManual:  () => void
  disabled?: boolean
}

export function ExpenseCameraCapture({ onCapture, onManual, disabled }: Props) {
  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const pdfRef     = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, sourceType: ExpenseSourceType) {
    const file = e.target.files?.[0]
    if (file) onCapture(file, sourceType)
    // Reset so the same file can be re-picked
    e.target.value = ''
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: 24, maxWidth: 400, margin: '0 auto',
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-text-muted, #6b7280)', textAlign: 'center' }}>
        Wybierz źródło faktury / paragonu
      </p>

      {/* Camera — mobile: triggers native camera */}
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', fontSize: 15, padding: '14px 20px' }}
      >
        <span>📷</span> Zrób zdjęcie
      </button>

      {/* Gallery — mobile: photo picker; desktop: file open dialog */}
      <button
        type="button"
        className="btn btn-secondary"
        disabled={disabled}
        onClick={() => galleryRef.current?.click()}
        style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', fontSize: 15, padding: '14px 20px' }}
      >
        <span>🖼️</span> Wybierz z galerii
      </button>

      {/* PDF */}
      <button
        type="button"
        className="btn btn-secondary"
        disabled={disabled}
        onClick={() => pdfRef.current?.click()}
        style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', fontSize: 15, padding: '14px 20px' }}
      >
        <span>📄</span> Dodaj PDF
      </button>

      <div style={{ margin: '4px 0', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted, #6b7280)' }}>
        — lub —
      </div>

      {/* Manual entry — no file */}
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled}
        onClick={() => onManual()}
        style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', fontSize: 14, padding: '12px 20px' }}
      >
        <span>✏️</span> Wpisz ręcznie
      </button>

      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e, 'camera')}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e, 'gallery')}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e, 'pdf')}
      />
    </div>
  )
}
