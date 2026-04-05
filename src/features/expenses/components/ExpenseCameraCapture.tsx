import { useRef, useState } from 'react'
import type { ExpenseSourceType } from '@/features/expenses/api/expenses.api'
import { ROOM_TYPES } from '@/services/ai/room-types'
import type { RoomTypeId } from '@/services/ai/room-types'

const MAX_ROOM_PHOTOS = 10
const MIN_ROOM_PHOTOS = 1
const MAX_PHOTO_SIZE  = 8 * 1024 * 1024  // 8 MB per photo (matches analyze-room-photo server limit)

interface Props {
  onCapture: (file: File, sourceType: ExpenseSourceType) => void
  onRoomPhotos?: (files: File[], roomType: RoomTypeId) => void
  onManual:  () => void
  disabled?: boolean
  /** When true, skip invoice/manual buttons — show only room analysis flow */
  roomAnalysisOnly?: boolean
}

export function ExpenseCameraCapture({ onCapture, onRoomPhotos, onManual, disabled, roomAnalysisOnly }: Props) {
  const cameraRef    = useRef<HTMLInputElement>(null)
  const galleryRef   = useRef<HTMLInputElement>(null)
  const pdfRef       = useRef<HTMLInputElement>(null)
  const roomPhotoRef = useRef<HTMLInputElement>(null)
  const roomAddRef   = useRef<HTMLInputElement>(null)

  const [roomPhotos, setRoomPhotos] = useState<File[]>([])
  const [roomMode, setRoomMode]     = useState(false)
  const [selectedRoomType, setSelectedRoomType] = useState<RoomTypeId | null>(null)
  const [oversizeWarning, setOversizeWarning]   = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, sourceType: ExpenseSourceType) {
    const file = e.target.files?.[0]
    if (file) onCapture(file, sourceType)
    e.target.value = ''
  }

  function handleRoomFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (all.length === 0) return
    const oversize = all.filter(f => f.size > MAX_PHOTO_SIZE)
    const valid    = all.filter(f => f.size <= MAX_PHOTO_SIZE)
    if (oversize.length > 0) {
      const n = oversize.length
      setOversizeWarning(
        `${n} ${n === 1 ? 'zdjęcie jest za duże' : 'zdjęcia są za duże'} (maks. 8 MB) i ${n === 1 ? 'zostało pominięte' : 'zostały pominięte'}.`,
      )
    } else {
      setOversizeWarning(null)
    }
    if (valid.length === 0) return
    setRoomPhotos(prev => [...prev, ...valid].slice(0, MAX_ROOM_PHOTOS))
    setRoomMode(true)
  }

  function removeRoomPhoto(idx: number) {
    setRoomPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  function confirmRoomPhotos() {
    if (roomPhotos.length < MIN_ROOM_PHOTOS) return
    if (onRoomPhotos) {
      onRoomPhotos(roomPhotos, selectedRoomType ?? 'bathroom')
    } else {
      // Fallback: send first photo through legacy single-file path
      onCapture(roomPhotos[0], 'room_photo')
    }
  }

  function cancelRoomMode() {
    setRoomPhotos([])
    setRoomMode(false)
    setSelectedRoomType(null)
    setOversizeWarning(null)
  }

  // ── Room type selector view ──
  if (roomMode && !selectedRoomType) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, maxWidth: 440, margin: '0 auto' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
          📐 Typ pomieszczenia
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted, #6E6A60)', textAlign: 'center' }}>
          Wybierz typ — dostosujemy analizę i bibliotekę pozycji.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          {ROOM_TYPES.map(rt => (
            <button
              key={rt.id}
              type="button"
              onClick={() => {
                setSelectedRoomType(rt.id)
                // Auto-open file picker for first photo
                setTimeout(() => roomAddRef.current?.click(), 50)
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '16px 12px', borderRadius: 10,
                background: 'var(--color-bg-input, #2A2D32)',
                border: '1px solid var(--color-border, rgba(30,29,24,0.15))',
                cursor: 'pointer', transition: 'all .15s',
                fontSize: 13, fontWeight: 500,
                color: 'var(--color-text-primary, #E5E7EB)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary, #3E8C58)'; e.currentTarget.style.background = 'var(--color-primary-soft, rgba(59,130,246,.08))' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border, rgba(30,29,24,0.15))'; e.currentTarget.style.background = 'var(--color-bg-input, #2A2D32)' }}
            >
              <span style={{ fontSize: 24 }}>{rt.icon}</span>
              <span>{rt.name}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center' }}>{rt.description}</span>
              {rt.hasLibrary && (
                <span style={{ fontSize: 9, color: '#1A5C32', fontWeight: 600 }}>+ Biblioteka pozycji</span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={cancelRoomMode}
          style={{ fontSize: 14, padding: '12px 16px', marginTop: 4 }}
        >
          ← Wróć
        </button>
        {/* Hidden multi-file input (needed for auto-open after selection) */}
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

  // ── Room photo collector view ──
  if (roomMode && selectedRoomType) {
    const roomInfo = ROOM_TYPES.find(r => r.id === selectedRoomType)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, maxWidth: 440, margin: '0 auto' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
          {roomInfo?.icon ?? '🏠'} Zdjęcia — {roomInfo?.name ?? 'Pomieszczenie'}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted, #6E6A60)', textAlign: 'center' }}>
          Dodaj 1–{MAX_ROOM_PHOTOS} zdjęć z różnych kątów. Im więcej, tym lepsza analiza. Maks. 8 MB / zdjęcie.
        </p>

        {oversizeWarning && (
          <div style={{
            fontSize: 11, color: '#B5830A', padding: '5px 10px', borderRadius: 5,
            background: 'rgba(212,150,10,0.1)', border: '1px solid rgba(212,150,10,0.2)',
            textAlign: 'center',
          }}>
            ⚠ {oversizeWarning}
          </div>
        )}

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

  // ── roomAnalysisOnly: skip invoice buttons, go straight to room type selector ──
  if (roomAnalysisOnly && !roomMode) {
    // Auto-enter room mode on first render
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, maxWidth: 440, margin: '0 auto' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
          📐 Typ pomieszczenia
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted, #6E6A60)', textAlign: 'center' }}>
          Wybierz typ — dostosujemy analizę i bibliotekę pozycji.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          {ROOM_TYPES.map(rt => (
            <button
              key={rt.id}
              type="button"
              onClick={() => {
                setSelectedRoomType(rt.id)
                setRoomMode(true)
                setTimeout(() => roomAddRef.current?.click(), 50)
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '16px 12px', borderRadius: 10,
                background: 'var(--color-bg-input, #2A2D32)',
                border: '1px solid var(--color-border, rgba(30,29,24,0.15))',
                cursor: 'pointer', transition: 'all .15s',
                fontSize: 13, fontWeight: 500,
                color: 'var(--color-text-primary, #E5E7EB)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary, #3E8C58)'; e.currentTarget.style.background = 'var(--color-primary-soft, rgba(59,130,246,.08))' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border, rgba(30,29,24,0.15))'; e.currentTarget.style.background = 'var(--color-bg-input, #2A2D32)' }}
            >
              <span style={{ fontSize: 24 }}>{rt.icon}</span>
              <span>{rt.name}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center' }}>{rt.description}</span>
              {rt.hasLibrary && (
                <span style={{ fontSize: 9, color: '#1A5C32', fontWeight: 600 }}>+ Biblioteka pozycji</span>
              )}
            </button>
          ))}
        </div>
        {/* Hidden multi-file input */}
        <input ref={roomAddRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleRoomFiles} />
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
      <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-text-muted, #6E6A60)', textAlign: 'center' }}>
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

      <div style={{ margin: '4px 0', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted, #6E6A60)' }}>
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
          setSelectedRoomType(null)
          // Room type selector will appear — no auto-open file picker here
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
