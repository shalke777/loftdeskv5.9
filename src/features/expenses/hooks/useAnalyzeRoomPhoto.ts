// =============================================================================
// useAnalyzeRoomPhoto — Client hook for room/site photo vision analysis
// =============================================================================
// Calls the analyze-room-photo Netlify function and returns a canonical
// AnalysisResult envelope ready for the existing review UI + persistence.

import { useMutation } from '@tanstack/react-query'
import { netlifyFn } from '@/shared/lib/functions'
import { supabase } from '@/shared/lib/supabase'
import type { AnalysisResult } from '@/services/ai/analysis.types'

async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

const MAX_FILE_SIZE  = 8 * 1024 * 1024  // 8 MB (photos can be large)
const MAX_VISION_WIDTH  = 2048          // px — keep detail for room analysis

const IMAGE_MIME_SET = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/heic', 'image/heif',
])

// ── Image preprocessing (resize only, keep color for vision) ─────────────────
// Unlike OCR preprocessing, we keep colors — vision model needs them for
// material identification (tile color, paint, fixtures, etc.)

async function preprocessForVision(file: File): Promise<File> {
  const isImg = IMAGE_MIME_SET.has(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  if (!isImg || typeof document === 'undefined') return file

  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image()
      el.onload  = () => res(el)
      el.onerror = () => rej(new Error('img load failed'))
      el.src = url
    })
    URL.revokeObjectURL(url)

    const scale = Math.min(1, MAX_VISION_WIDTH / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale >= 1) return file  // already small enough

    const w = Math.round(img.naturalWidth  * scale)
    const h = Math.round(img.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(img, 0, 0, w, h)

    return await new Promise<File>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          const name = file.name.replace(/\.[^.]+$/, '') + '_vision.jpg'
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.92,
      )
    })
  } catch (err) {
    console.warn('[vision] image preprocessing failed, using original:', err)
    return file
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? result)
    }
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

// ── Netlify function call ────────────────────────────────────────────────────

interface RoomAnalysisRaw {
  room_type:            string | null
  detected_materials:   Array<{
    name: string; category: string; quantity?: number | null
    unit?: string | null; confidence: number; notes?: string | null
  }>
  work_scope: Array<{
    description: string; category: string; estimated_unit?: string | null
    estimated_qty?: number | null; confidence: number; notes?: string | null
  }>
  extraction_confidence: number
  extraction_warnings:   string[]
  notes:                string | null
}

export async function callAnalyzeRoomPhoto(file: File, context?: string): Promise<AnalysisResult> {
  if (file.size > MAX_FILE_SIZE) {
    return {
      input_type: 'room_photo',
      document_type: 'room_scan',
      detected_materials: [],
      work_scope: [],
      extraction_confidence: 0,
      extraction_warnings: ['Plik jest za duży (max 8 MB). Spróbuj zmniejszyć zdjęcie.'],
      requires_user_confirmation: true,
      parser_source: 'vision',
    }
  }

  const isImage = IMAGE_MIME_SET.has(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)
  if (!isImage) {
    return {
      input_type: 'room_photo',
      document_type: 'room_scan',
      detected_materials: [],
      work_scope: [],
      extraction_confidence: 0,
      extraction_warnings: ['Analiza pokoju wymaga zdjęcia (JPEG/PNG/WEBP). Wybierz plik graficzny.'],
      requires_user_confirmation: true,
      parser_source: 'vision',
    }
  }

  const processed = await preprocessForVision(file)
  const base64    = await fileToBase64(processed)

  let resp: Response
  try {
    resp = await fetch(netlifyFn('analyze-room-photo'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body:    JSON.stringify({
        image_base64: base64,
        image_type:   'image/jpeg',
        context,
      }),
    })
  } catch {
    throw new Error('Serwer analizy niedostępny.')
  }

  const data = await resp.json().catch(() => ({})) as Record<string, unknown>

  if (!resp.ok) {
    const errCode = String(data.error ?? '')
    if (resp.status === 401 || errCode === 'unauthorized')
      throw new Error('Sesja wygasła — zaloguj się ponownie.')
    if (resp.status === 429 || errCode === 'too_many_requests')
      throw new Error('Za dużo żądań. Spróbuj za chwilę.')
    if (errCode === 'ai_not_configured')
      throw new Error('AI nie jest skonfigurowane (brak OPENAI_API_KEY)')
    throw new Error(String(data.message ?? `HTTP ${resp.status}`))
  }

  const raw = (data.result ?? data) as RoomAnalysisRaw

  // Map to canonical AnalysisResult envelope
  const result: AnalysisResult = {
    input_type:     'room_photo',
    document_type:  'room_scan',

    detected_materials: raw.detected_materials ?? [],
    work_scope:         raw.work_scope ?? [],

    extraction_confidence:      raw.extraction_confidence ?? 0,
    extraction_warnings:        raw.extraction_warnings ?? [],
    requires_user_confirmation: true,  // always require confirmation for vision
    parser_source:              'vision',
  }

  if (raw.notes) {
    result.extraction_warnings = [
      ...result.extraction_warnings,
      ...(raw.notes ? [`Notatka AI: ${raw.notes}`] : []),
    ]
  }

  return result
}

// ── React Query mutation hook ────────────────────────────────────────────────

export function useAnalyzeRoomPhoto() {
  return useMutation({
    mutationFn: ({ file, context }: { file: File; context?: string }) =>
      callAnalyzeRoomPhoto(file, context),
  })
}
