// =============================================================================
// uploadProjectAsset — shared file upload utility for project photos + message attachments
// =============================================================================
// One upload pipeline for both:
//   - project photos → project_photo_docs.image_url
//   - message attachments → project_messages.attachment_url
//
// Storage bucket: 'company-files' (already exists, used by expenses)
// Paths:
//   - photos:    {companyId}/project-photos/{ts}_{safeName}
//   - messages:  {companyId}/messages/{ts}_{safeName}
//
// Compression strategy (images only):
//   - If image > 3 MB → resize to max 1920px longest edge, JPEG quality 0.82
//   - If image ≤ 3 MB → upload as-is (preserves original quality)
//   - PDF/other → upload as-is, no resize
//   - HEIC/HEIF → pass through (browser accepts as Blob; server handles)
//   - Caller receives feedback via optional onProgress callback
// =============================================================================

import { isDemoMode, supabase } from '@/shared/lib/supabase'

export const PHOTO_MAX_INPUT_BYTES  = 15 * 1024 * 1024  // 15 MB hard limit
export const PHOTO_COMPRESS_TRIGGER = 3  * 1024 * 1024  // compress above 3 MB
export const PHOTO_MAX_DIMENSION    = 1920               // px longest edge after resize
export const PHOTO_JPEG_QUALITY     = 0.82

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
]
export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
]

export type UploadFolder = 'project-photos' | 'messages'

interface UploadResult {
  url:          string
  storagePath:  string
  name:         string
  mime:         string
  /** Size after optional compression (bytes) */
  size:         number
  /** true when client-side resize was applied */
  compressed:   boolean
}

/** Remove diacritics and replace characters unsafe for storage paths */
function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Resize image to at most PHOTO_MAX_DIMENSION px on the longest edge,
 * encode as JPEG at PHOTO_JPEG_QUALITY.
 * Only called for image/* files larger than PHOTO_COMPRESS_TRIGGER.
 */
async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(blobUrl)
      const { naturalWidth: w, naturalHeight: h } = img

      let targetW = w
      let targetH = h

      if (w > PHOTO_MAX_DIMENSION || h > PHOTO_MAX_DIMENSION) {
        if (w >= h) {
          targetW = PHOTO_MAX_DIMENSION
          targetH = Math.round((h / w) * PHOTO_MAX_DIMENSION)
        } else {
          targetH = PHOTO_MAX_DIMENSION
          targetW = Math.round((w / h) * PHOTO_MAX_DIMENSION)
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, targetW, targetH)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          resolve(blob)
        },
        'image/jpeg',
        PHOTO_JPEG_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl)
      reject(new Error('Image load failed during resize'))
    }

    img.src = blobUrl
  })
}

/**
 * Upload a file (photo or attachment) to Supabase Storage.
 *
 * In demo mode returns a local blob URL — no real upload.
 *
 * @throws Error with a user-facing Polish message when validation fails.
 * @throws Error with Supabase message when storage write fails.
 */
export async function uploadProjectAsset(
  file:      File,
  companyId: string,
  folder:    UploadFolder,
  onStatus?: (msg: string) => void,
): Promise<UploadResult> {
  // ── Size guard ────────────────────────────────────────────────────────────
  if (file.size > PHOTO_MAX_INPUT_BYTES) {
    throw new Error(
      `Plik jest za duży (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksymalny rozmiar to ${PHOTO_MAX_INPUT_BYTES / 1024 / 1024} MB.`,
    )
  }

  // ── Type guard ────────────────────────────────────────────────────────────
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
  const isPdf   = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isImage && !isPdf) {
    const ext = file.name.split('.').pop()?.toUpperCase() ?? '?'
    throw new Error(
      `Nieobsługiwany format pliku (.${ext}). Dozwolone: JPG, PNG, WEBP, HEIC, PDF.`,
    )
  }

  // ── Demo mode — return local blob URL ────────────────────────────────────
  if (isDemoMode || !supabase) {
    return {
      url:         URL.createObjectURL(file),
      storagePath: `demo/${folder}/${file.name}`,
      name:        file.name,
      mime:        file.type,
      size:        file.size,
      compressed:  false,
    }
  }

  // ── Optional client-side resize ───────────────────────────────────────────
  let uploadBlob: Blob = file
  let uploadMime       = file.type
  let compressed       = false
  const safeName       = sanitizeFilename(file.name)

  if (isImage && file.size > PHOTO_COMPRESS_TRIGGER) {
    onStatus?.('Optymalizuję obraz…')
    try {
      uploadBlob = await resizeImage(file)
      uploadMime = 'image/jpeg'
      compressed = true
    } catch {
      // Compression failed — upload original
      uploadBlob = file
    }
  }

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  onStatus?.('Przesyłam…')

  const storagePath = `${companyId}/${folder}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage
    .from('company-files')
    .upload(storagePath, uploadBlob, { upsert: false, contentType: uploadMime })

  if (error) throw error

  const { data } = supabase.storage.from('company-files').getPublicUrl(storagePath)

  return {
    url:         data.publicUrl,
    storagePath,
    name:        file.name,
    mime:        uploadMime,
    size:        uploadBlob.size,
    compressed,
  }
}
