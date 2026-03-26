import { useRef, useState } from 'react'
import type { ExpenseSourceType } from '@/features/expenses/api/expenses.api'

const MAX_ROOM_PHOTOS = 10
const MIN_ROOM_PHOTOS = 1

interface Props {
  onCapture: (file: File, sourceType: ExpenseSourceType) => void
  onRoomPhotos?: (files: File[]) => void
  onManual:  () => void
  disabled?: boolean
}

export function ExpenseCameraCapture({ onCapture, onRoomPhotos, onManual, disabled }: Props) {
  const cameraRef    = useRef<HTMLInputElement>(null)
  const galleryRef   = useRef<HTMLInputElement>(null)
  const pdfRef       = useRef<HTMLInputElement>(null)
  const roomPhotoRef = useRef<HTMLInputElement>(null)
  const roomAddRef   = useRef<HTMLInputElement>(null)

  const [roomPhotos, setRoomPhotos] = useState<File[]>([])
  const [roomMode, setRoomMode]     = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, sourceType: ExpenseSourceType) {
    const file = e.target.files?.[0]
    if (file) onCapture(file, sourceType)
    e.target.value = ''
  }

  function handleRoomFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_ROOM_PHOTOS)
    e.target.value = ''
    if (files.length === 0) return
    setRoomPhotos(prev => [...prev, ...files].slice(0, MAX_ROOM_PHOTOS))
    setRoomMode(true)
  }

  function removeRoomPhoto(idx: number) {
    setRoomPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  function confirmRoomPhotos() {
    if (roomPhotos.length < MIN_ROOM_PHOTOS) return
    if (onRoomPhotos) {
      onRoomPhotos(roomPhotos)
    } else {
      // Fallback: send first photo through legacy single-file path
      onCapture(roomPhotos[0], 'room_photo')
    }
  }

  function cancelRoomMode() {
    setRoomPhotos([])
    setRoomMode(false)
  }

  // ── Room photo collector view ──
  if (roomMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, maxWidth: 440, margin: '0 auto' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
          🏠 Zdjęcia łazienki / pomieszczenia
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted, #8A8F98)', textAlign: 'center' }}>
          Dodaj 1–{MAX_ROOM_PHOTOS} zdjęć z różnych kątów. Im więcej, tym lepsza analiza.
        </p>

        {/* Photo thumbnails */}
        {roomPhotos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
            {roomPhotos.map((f, i) => (
              <div key={`${f.name}-${i}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <img
                  src={URL.createObjectURL(f)}
                  alt={`Zdjęcie ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                />
                <button
                  type="button"
                  onClick={() => removeRoomPhoto(i)}
                  style={{
                    position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,.7)', color: '#fff', border: 'none', cursor: 'pointer',
                    fontSize: 12, display: 'grid', placeItems: 'center', lineHeight: 1,
                  }}
                  aria-label={`Usuń zdjęcie ${i + 1}`}
                >×</button>
                <div style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,.6)', padding: '1px 4px', borderRadius: 4 }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
          <span>{roomPhotos.length} / {MAX_ROOM_PHOTOS} zdjęć</span>
        </div>

        {roomPhotos.length < MAX_ROOM_PHOTOS && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={disabled}
            onClick={() => roomAddRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 14, padding: '12px 16px' }}
          >
            ＋ Dodaj kolejne zdjęcie
          </button>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={cancelRoomMode}
            style={{ flex: 1, fontSize: 14, padding: '12px 16px' }}
          >
            ← Wróć
          </button>
          <button
            type="button"
            className="btn"
            disabled={disabled || roomPhotos.length < MIN_ROOM_PHOTOS}
            onClick={confirmRoomPhotos}
            style={{ flex: 2, fontSize: 14, padding: '12px 16px', fontWeight: 600 }}
          >
            🔍 Analizuj {roomPhotos.length > 1 ? `(${roomPhotos.length} zdjęć)` : ''}
          </button>
        </div>

        {/* Hidden multi-file input */}
        <input
          ref={roomAddRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleRoomFiles}
        />
      </div>
    )
  }

  // ── Default capture view ──
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: 24, maxWidth: 400, margin: '0 auto',
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-text-muted, #8A8F98)', textAlign: 'center' }}>
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

      <div style={{ margin: '4px 0', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted, #8A8F98)' }}>
        — lub —
      </div>

      {/* Room / site photo — vision analysis (materials + work scope) */}
      <button
        type="button"
        className="btn btn-secondary"
        disabled={disabled}
        onClick={() => {
          setRoomPhotos([])
          setRoomMode(true)
          // Auto-open file picker for first photo
          setTimeout(() => roomAddRef.current?.click(), 50)
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', fontSize: 15, padding: '14px 20px' }}
      >
        <span>🏠</span> Analiza pomieszczenia (1–{MAX_ROOM_PHOTOS} zdjęć)
      </button>

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
      {/* Hidden multi-file input for room photos (also used when entering room mode) */}
      <input
        ref={roomAddRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleRoomFiles}
      />
    </div>
  )
}
