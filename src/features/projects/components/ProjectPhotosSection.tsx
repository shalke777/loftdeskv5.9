// =============================================================================
// ProjectPhotosSection — zdjęcia z realizacji projektu
// =============================================================================
// Wejście: aparat (capture), galeria, URL zewnętrzny
// Upload: company-files bucket, prefix {companyId}/project-photos/
// Kompresja: obrazy > 3 MB → resize do max 1920 px, JPEG 0.82
// Source of truth: project_photo_docs (Supabase) — klient widzi te same zdjęcia w portalu
// =============================================================================

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Image as ImageIcon, Link, Trash2, AlertCircle } from 'lucide-react'
import type { Project } from '@/entities/project/model'
import type { PhotoDocumentation } from '@/entities/documentation/model'
import { Badge } from '@/shared/ui/Badge/Badge'
import { Button } from '@/shared/ui/Button/Button'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import {
  useProjectPhotos,
  useCreatePhoto,
  useDeletePhoto,
} from '@/features/documentation/hooks/useDocumentation'
import {
  uploadProjectAsset,
  PHOTO_MAX_INPUT_BYTES,
} from '@/shared/lib/uploadProjectAsset'

// ── Typy ─────────────────────────────────────────────────────────────────────

type PhotoCategory = PhotoDocumentation['category']
type AddMode = 'camera' | 'gallery' | 'url' | null

const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  before:   'Przed realizacją',
  progress: 'W trakcie',
  after:    'Po realizacji',
  issue:    'Problem',
  handover: 'Odbiór',
}

const CATEGORY_BADGE: Record<PhotoCategory, 'default' | 'success' | 'warning' | 'danger'> = {
  before:   'default',
  progress: 'warning',
  after:    'success',
  issue:    'danger',
  handover: 'default',
}

const EMPTY_DRAFT = {
  title:     '',
  category:  'progress' as PhotoCategory,
  note:      '',
  url:       '',
}

// ── Komponent ─────────────────────────────────────────────────────────────────

export function ProjectPhotosSection({ project }: { project: Project }) {
  const companyId   = useCompanyId()
  const qc          = useQueryClient()
  const { data: photos = [], isLoading, isError } = useProjectPhotos(project.id)
  const createPhoto = useCreatePhoto()
  const deletePhoto = useDeletePhoto()

  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [addMode,     setAddMode]     = useState<AddMode>(null)
  const [draft,       setDraft]       = useState(EMPTY_DRAFT)
  const [uploadMsg,   setUploadMsg]   = useState<string | null>(null)  // status/feedback
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null)  // local blob preview
  const [uploading,   setUploading]   = useState(false)
  const [lightbox,    setLightbox]    = useState<string | null>(null)  // full-size preview URL

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['documentation', 'project-photos', project.id] })
  }

  function resetForm() {
    setAddMode(null)
    setDraft(EMPTY_DRAFT)
    setUploadMsg(null)
    setUploadError(null)
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }
    setUploading(false)
  }

  // ── Wybór pliku z aparatu lub galerii ─────────────────────────────────────

  async function handleFileChosen(file: File) {
    setUploadError(null)
    setUploadMsg(null)

    // Early size check before upload
    if (file.size > PHOTO_MAX_INPUT_BYTES) {
      setUploadError(`Plik jest za duży (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks. 15 MB.`)
      return
    }

    // Local blob preview — immediately shown before upload completes
    const localUrl = URL.createObjectURL(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(localUrl)

    // Auto-fill title from filename if empty
    if (!draft.title.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
      setDraft(d => ({ ...d, title: nameWithoutExt }))
    }
  }

  // ── Zapis ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    const titleTrimmed = draft.title.trim()
    if (!titleTrimmed) {
      setUploadError('Podaj tytuł zdjęcia')
      return
    }

    let finalUrl: string | null = null

    // URL mode — use the URL directly
    if (addMode === 'url') {
      const urlTrimmed = draft.url.trim()
      if (!urlTrimmed) { setUploadError('Podaj URL zdjęcia'); return }
      finalUrl = urlTrimmed
    } else {
      // Camera or gallery — find the chosen file from the right ref
      const inputEl = addMode === 'camera' ? cameraRef.current : galleryRef.current
      const file    = inputEl?.files?.[0]

      if (!file && !previewUrl) {
        setUploadError('Wybierz zdjęcie lub plik')
        return
      }

      if (file) {
        setUploading(true)
        setUploadError(null)
        try {
          const result = await uploadProjectAsset(
            file,
            companyId,
            'project-photos',
            (msg) => setUploadMsg(msg),
          )
          finalUrl = result.url
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : 'Błąd przesyłania pliku')
          setUploading(false)
          return
        }
        setUploading(false)
      }
    }

    setUploadMsg('Zapisuję…')
    createPhoto.mutate(
      {
        company_id: companyId,
        client_id:  project.client_id ?? null,
        project_id: project.id,
        title:      titleTrimmed,
        category:   draft.category,
        taken_at:   new Date().toISOString(),
        image_url:  finalUrl ?? '',
        note:       draft.note.trim(),
      },
      {
        onSuccess: () => { invalidate(); resetForm() },
        onError:   (err) => {
          setUploadMsg(null)
          setUploadError(err instanceof Error ? err.message : 'Błąd zapisu')
        },
      },
    )
  }

  function handleDelete(id: string) {
    deletePhoto.mutate(id, { onSuccess: invalidate })
  }

  // ── Render — lista zdjęć ─────────────────────────────────────────────────

  const photoList = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {photos.map((photo, idx) => (
        <div
          key={photo.id}
          style={{
            display:      'flex',
            gap:          12,
            alignItems:   'flex-start',
            padding:      '12px 0',
            borderBottom: idx < photos.length - 1 ? '1px solid var(--color-border)' : 'none',
          }}
        >
          {/* Miniatura — klikalny lightbox */}
          <button
            type="button"
            onClick={() => photo.image_url && setLightbox(photo.image_url)}
            style={{
              background:    'none',
              border:        'none',
              padding:       0,
              cursor:        photo.image_url ? 'zoom-in' : 'default',
              flexShrink:    0,
              borderRadius:  6,
              overflow:      'hidden',
            }}
            title={photo.image_url ? 'Powiększ' : undefined}
          >
            {photo.image_url ? (
              <img
                src={photo.image_url}
                alt={photo.title}
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                loading="lazy"
              />
            ) : (
              <div
                style={{
                  width:          64,
                  height:         64,
                  borderRadius:   6,
                  background:     'var(--color-surface-soft, rgba(160,170,180,0.08))',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  color:          'var(--color-text-muted)',
                }}
              >
                <ImageIcon size={24} />
              </div>
            )}
          </button>

          {/* Metadane */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {photo.title}
            </p>
            <Badge variant={CATEGORY_BADGE[photo.category] ?? 'default'}>
              {CATEGORY_LABELS[photo.category] ?? photo.category}
            </Badge>
            {photo.note && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                {photo.note}
              </p>
            )}
            {photo.taken_at && (
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-muted)', opacity: 0.7 }}>
                {new Date(photo.taken_at).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Usuń */}
          <button
            type="button"
            onClick={() => handleDelete(photo.id)}
            disabled={deletePhoto.isPending}
            title="Usuń zdjęcie"
            style={{
              background: 'none',
              border:     'none',
              cursor:     deletePhoto.isPending ? 'default' : 'pointer',
              color:      'var(--color-danger, #E55)',
              padding:    '2px 4px',
              opacity:    deletePhoto.isPending ? 0.4 : 0.6,
              flexShrink: 0,
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )

  // ── Render — formularz dodawania ──────────────────────────────────────────

  const addForm = addMode !== null && (
    <div
      style={{
        display:      'flex',
        flexDirection: 'column',
        gap:          12,
        padding:      16,
        marginTop:    12,
        borderRadius: 8,
        border:       '1px solid var(--color-border)',
        background:   'var(--color-surface-soft, rgba(160,170,180,0.05))',
      }}
    >
      {/* Nagłówek formularza */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          {addMode === 'camera' ? '📷 Zdjęcie z aparatu' : addMode === 'gallery' ? '🖼 Z galerii / pliku' : '🔗 URL zdjęcia'}
        </span>
        <button
          type="button"
          onClick={resetForm}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
        >
          ✕
        </button>
      </div>

      {/* Plik (aparat / galeria) */}
      {addMode !== 'url' && (
        <>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f) }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*,.pdf"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f) }}
          />

          {/* Upload area / podgląd */}
          {previewUrl ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={previewUrl}
                alt="Podgląd"
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, objectFit: 'contain', border: '1px solid var(--color-border)' }}
              />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(previewUrl)
                  setPreviewUrl(null)
                  // Reset file input
                  if (addMode === 'camera' && cameraRef.current)  cameraRef.current.value = ''
                  if (addMode === 'gallery' && galleryRef.current) galleryRef.current.value = ''
                }}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (addMode === 'camera')  cameraRef.current?.click()
                else                       galleryRef.current?.click()
              }}
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            8,
                padding:        '24px 16px',
                border:         '2px dashed var(--color-border)',
                borderRadius:   8,
                background:     'none',
                cursor:         'pointer',
                color:          'var(--color-text-muted)',
                fontSize:       13,
                width:          '100%',
              }}
            >
              {addMode === 'camera'
                ? <><Camera size={28} /><span>Zrób zdjęcie aparatem</span></>
                : <><ImageIcon size={28} /><span>Wybierz zdjęcie / PDF</span><span style={{ fontSize: 11, opacity: 0.6 }}>JPG, PNG, WEBP, HEIC, PDF · maks. 15 MB</span></>
              }
            </button>
          )}
        </>
      )}

      {/* URL */}
      {addMode === 'url' && (
        <input
          type="url"
          placeholder="https://…"
          value={draft.url}
          onChange={e => setDraft(d => ({ ...d, url: e.target.value }))}
          style={{
            padding:      '8px 10px',
            borderRadius: 6,
            border:       '1px solid var(--color-border)',
            background:   'var(--color-surface)',
            color:        'var(--color-text)',
            fontSize:     14,
            width:        '100%',
            boxSizing:    'border-box',
          }}
        />
      )}

      {/* Tytuł */}
      <input
        placeholder="Tytuł zdjęcia *"
        value={draft.title}
        onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
        style={{
          padding:      '8px 10px',
          borderRadius: 6,
          border:       '1px solid var(--color-border)',
          background:   'var(--color-surface)',
          color:        'var(--color-text)',
          fontSize:     14,
          width:        '100%',
          boxSizing:    'border-box',
        }}
      />

      {/* Kategoria */}
      <select
        value={draft.category}
        onChange={e => setDraft(d => ({ ...d, category: e.target.value as PhotoCategory }))}
        style={{
          padding:      '8px 10px',
          borderRadius: 6,
          border:       '1px solid var(--color-border)',
          background:   'var(--color-surface)',
          color:        'var(--color-text)',
          fontSize:     14,
          width:        '100%',
          boxSizing:    'border-box',
        }}
      >
        <option value="before">Przed realizacją</option>
        <option value="progress">W trakcie</option>
        <option value="after">Po realizacji</option>
        <option value="issue">Problem / usterka</option>
        <option value="handover">Odbiór</option>
      </select>

      {/* Notatka */}
      <input
        placeholder="Notatka (opcjonalnie)"
        value={draft.note}
        onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
        style={{
          padding:      '8px 10px',
          borderRadius: 6,
          border:       '1px solid var(--color-border)',
          background:   'var(--color-surface)',
          color:        'var(--color-text)',
          fontSize:     14,
          width:        '100%',
          boxSizing:    'border-box',
        }}
      />

      {/* Status / error */}
      {uploadMsg && !uploadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <span style={{ display: 'inline-flex', width: 14, height: 14 }}><Spinner /></span>
          {uploadMsg}
        </div>
      )}
      {uploadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-danger, #E55)', borderRadius: 6, padding: '8px 10px', background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.2)' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {uploadError}
        </div>
      )}

      {/* Akcje */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          type="button"
          onClick={handleSave}
          disabled={uploading || createPhoto.isPending}
        >
          {uploading || createPhoto.isPending ? 'Zapisuję…' : 'Zapisz zdjęcie'}
        </Button>
        <Button variant="secondary" type="button" onClick={resetForm}>
          Anuluj
        </Button>
      </div>
    </div>
  )

  // ── Render — widok główny ─────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>

      {/* Nagłówek + licznik */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          Zdjęcia z realizacji
          {photos.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)' }}>
              ({photos.length})
            </span>
          )}
        </h3>
      </div>

      {/* Przyciski dodawania — zawsze widoczne (aparat / galeria / URL) */}
      {addMode === null && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setAddMode('camera')}
            style={addBtnStyle}
          >
            <Camera size={16} style={{ flexShrink: 0 }} />
            Aparat
          </button>
          <button
            type="button"
            onClick={() => setAddMode('gallery')}
            style={addBtnStyle}
          >
            <ImageIcon size={16} style={{ flexShrink: 0 }} />
            Galeria / plik
          </button>
          <button
            type="button"
            onClick={() => setAddMode('url')}
            style={{ ...addBtnStyle, opacity: 0.7 }}
          >
            <Link size={16} style={{ flexShrink: 0 }} />
            URL
          </button>
        </div>
      )}

      {/* Formularz dodawania */}
      {addForm}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <span style={{ display: 'inline-flex', width: 16, height: 16 }}><Spinner /></span>
          Ładowanie zdjęć…
        </div>
      )}

      {/* Query error */}
      {isError && !isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-danger, #E55)', borderRadius: 6, padding: '10px 12px', background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.2)' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          Nie udało się załadować zdjęć. Odśwież stronę.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && photos.length === 0 && addMode === null && (
        <div
          style={{
            textAlign:    'center',
            padding:      '36px 24px',
            border:       '2px dashed var(--color-border)',
            borderRadius: 10,
            color:        'var(--color-text-muted)',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
          <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 14 }}>Brak zdjęć z realizacji</p>
          <p style={{ margin: 0, fontSize: 13 }}>Dodaj pierwsze zdjęcie — z aparatu, galerii lub przez URL.</p>
        </div>
      )}

      {/* Lista zdjęć */}
      {!isLoading && photos.length > 0 && photoList}

      {/* Lightbox */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          style={{
            position:       'fixed',
            inset:          0,
            zIndex:         9999,
            background:     'rgba(0,0,0,0.88)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            cursor:         'zoom-out',
          }}
        >
          <img
            src={lightbox}
            alt="Powiększone zdjęcie"
            style={{ maxWidth: '95vw', maxHeight: '92vh', borderRadius: 6, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', lineHeight: 1, padding: 4 }}
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const addBtnStyle: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  gap:            6,
  padding:        '8px 14px',
  borderRadius:   6,
  border:         '1px solid var(--color-border)',
  background:     'var(--color-surface)',
  color:          'var(--color-text)',
  fontSize:       13,
  fontWeight:     500,
  cursor:         'pointer',
  whiteSpace:     'nowrap',
}
