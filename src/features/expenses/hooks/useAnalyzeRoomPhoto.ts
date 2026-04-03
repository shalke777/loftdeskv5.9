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

// v2 response shape — matches RoomAnalysisResult in netlify/functions/analyze-room-photo.ts
interface RoomScopeItemRaw {
  library_id?:   string | null
  description:   string
  category:      string
  unit?:         string | null
  quantity?:     number | null
  priority:      'required' | 'likely' | 'optional'
  confidence:    number
  notes?:        string | null
  dependencies?: string[]
}

interface RoomAnalysisRaw {
  space_type:              string | null
  detected_materials:      Array<{
    name: string; category: string; quantity?: number | null
    unit?: string | null; confidence: number; notes?: string | null
  }>
  required_work_scope:     RoomScopeItemRaw[]
  likely_work_scope:       RoomScopeItemRaw[]
  optional_work_scope:     RoomScopeItemRaw[]
  suggested_estimate_items?: Array<{
    library_id?: string | null
    name: string; unit: string; quantity: number; unit_price?: number | null
    confidence: number; source: string; notes?: string | null
  }>
  clarification_questions?: unknown[]  // ClarificationQuestion[] — passed through as-is
  confidence:   number
  warnings:     string[]
  notes:        string | null
}

/** Clarification data from the guided form */
export interface BathroomClarification {
  area_m2?: number
  ceiling_height_m?: number
  tile_coverage?: 'full' | 'partial' | 'none'
  has_bathtub?: boolean
  has_shower?: boolean
  has_underfloor_heating?: boolean
  wc_type?: 'standing' | 'concealed'
  sink_count?: 1 | 2
  has_linear_drain?: boolean
  plumbing_scope?: 'none' | 'limited' | 'full'
  electrical_scope?: 'none' | 'limited' | 'full'
  has_boiler_casing?: boolean
  fixtures_standard?: 'budget' | 'standard' | 'premium'
  notes?: string
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
    if (errCode === 'daily_limit_exceeded')
      throw new Error('Dzienny limit analiz AI został wyczerpany. Spróbuj ponownie jutro.')
    if (errCode === 'ai_disabled')
      throw new Error('Moduł AI nie jest włączony na tym środowisku.')
    if (errCode === 'auth_not_configured')
      throw new Error('Autentykacja Supabase nie jest skonfigurowana — AI niedostępne.')
    if (errCode === 'plan_insufficient')
      throw new Error('AI Engine wymaga planu Pro lub Business. Zaktualizuj plan w ustawieniach.')
    if (errCode === 'project_access_denied')
      throw new Error('Brak dostępu do projektu lub projekt nie istnieje.')
    if (errCode === 'ai_not_configured')
      throw new Error('AI nie jest skonfigurowane (brak OPENAI_API_KEY)')
    throw new Error(String(data.message ?? `HTTP ${resp.status}`))
  }

  const raw = (data.result ?? data) as RoomAnalysisRaw

  // Flatten v2 scoped work scope into single AnalysisResult.work_scope array
  const work_scope = [
    ...(raw.required_work_scope ?? []),
    ...(raw.likely_work_scope ?? []),
    ...(raw.optional_work_scope ?? []),
  ].map(item => ({
    description:    item.description,
    category:       item.category,
    estimated_unit: item.unit ?? undefined,
    estimated_qty:  item.quantity ?? undefined,
    confidence:     item.confidence,
    notes:          item.notes ?? undefined,
  }))

  // Map to canonical AnalysisResult envelope
  const result: AnalysisResult = {
    input_type:     'room_photo',
    document_type:  'room_scan',

    detected_materials: raw.detected_materials ?? [],
    work_scope,
    suggested_estimate_items: (raw.suggested_estimate_items ?? []).map(item => ({
      ...item,
      source: (item.source || 'ai_suggestion') as 'ai_suggestion' | 'market_data' | 'historical',
    })),

    extraction_confidence:      raw.confidence ?? 0,
    extraction_warnings:        raw.warnings ?? [],
    requires_user_confirmation: true,  // always require confirmation for vision
    parser_source:              'vision',
  }

  if (raw.notes) {
    result.extraction_warnings = [
      ...result.extraction_warnings,
      `Notatka AI: ${raw.notes}`,
    ]
  }
  if (raw.clarification_questions && raw.clarification_questions.length > 0) {
    result.clarification_questions = raw.clarification_questions as AnalysisResult['clarification_questions']
  }
  return result
}

// ── React Query mutation hook ────────────────────────────────────────────────

export function useAnalyzeRoomPhoto() {
  return useMutation({
    mutationFn: ({ file, context }: { file: File; context?: string }) =>
      callAnalyzeRoomPhoto(file, context),
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false
      const msg = error instanceof Error ? error.message : ''
      return /502|503|504|niedostępny|network|fetch/i.test(msg)
    },
    retryDelay: 3000,
  })
}

// ── Multi-photo analysis ─────────────────────────────────────────────────────
// Sends multiple images in a single API call for richer context.

function buildClarificationContext(c?: BathroomClarification): string {
  if (!c) return ''
  const parts: string[] = []
  if (c.area_m2) parts.push(`Powierzchnia: ${c.area_m2} m²`)
  if (c.ceiling_height_m) parts.push(`Wysokość: ${c.ceiling_height_m} m`)
  if (c.tile_coverage) parts.push(`Płytki: ${c.tile_coverage === 'full' ? 'pełna wysokość' : c.tile_coverage === 'partial' ? 'częściowa' : 'brak'}`)
  if (c.has_bathtub) parts.push('Wanna: tak')
  if (c.has_shower) parts.push('Prysznic: tak')
  if (c.has_underfloor_heating) parts.push('Ogrzewanie podłogowe: tak')
  if (c.wc_type) parts.push(`WC: ${c.wc_type === 'concealed' ? 'podtynkowe' : 'stojące (kompakt)'}`)
  if (c.sink_count) parts.push(`Umywalki: ${c.sink_count}`)
  if (c.has_linear_drain) parts.push('Odpływ liniowy: tak')
  if (c.plumbing_scope) parts.push(`Przeróbki hydrauliczne: ${c.plumbing_scope === 'full' ? 'całość' : c.plumbing_scope === 'limited' ? 'częściowe' : 'brak'}`)
  if (c.electrical_scope) parts.push(`Przeróbki elektryczne: ${c.electrical_scope === 'full' ? 'całość' : c.electrical_scope === 'limited' ? 'częściowe' : 'brak'}`)
  if (c.has_boiler_casing) parts.push('Zabudowa kotła/bojlera: tak')
  if (c.fixtures_standard) parts.push(`Standard: ${c.fixtures_standard}`)
  if (c.notes) parts.push(`Uwagi: ${c.notes}`)
  return parts.join('. ')
}

export async function callAnalyzeRoomPhotos(
  files: File[],
  clarification?: BathroomClarification,
  roomType?: string,
  projectId?: string,
): Promise<AnalysisResult> {
  if (files.length === 0) {
    return {
      input_type: 'room_photo', document_type: 'room_scan',
      detected_materials: [], work_scope: [],
      extraction_confidence: 0, extraction_warnings: ['Nie dodano zdjęć.'],
      requires_user_confirmation: true, parser_source: 'vision',
    }
  }

  // Validate all files
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      return {
        input_type: 'room_photo', document_type: 'room_scan',
        detected_materials: [], work_scope: [],
        extraction_confidence: 0,
        extraction_warnings: [`Plik "${f.name}" jest za duży (max 8 MB).`],
        requires_user_confirmation: true, parser_source: 'vision',
      }
    }
  }

  // Preprocess and encode all images
  const images: Array<{ base64: string; type: string }> = []
  for (const f of files) {
    const processed = await preprocessForVision(f)
    const base64 = await fileToBase64(processed)
    images.push({ base64, type: 'image/jpeg' })
  }

  const context = buildClarificationContext(clarification)

  let resp: Response
  try {
    resp = await fetch(netlifyFn('analyze-room-photo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body: JSON.stringify({
        images,
        image_base64: images[0].base64,  // backward compat
        image_type: 'image/jpeg',
        context: context || undefined,
        clarification,
        room_type: roomType || undefined,
        project_id: projectId || undefined,
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
    if (errCode === 'daily_limit_exceeded')
      throw new Error('Dzienny limit analiz AI został wyczerpany. Spróbuj ponownie jutro.')
    if (errCode === 'ai_disabled')
      throw new Error('Moduł AI nie jest włączony na tym środowisku.')
    if (errCode === 'auth_not_configured')
      throw new Error('Autentykacja Supabase nie jest skonfigurowana — AI niedostępne.')
    if (errCode === 'plan_insufficient')
      throw new Error('AI Engine wymaga planu Pro lub Business. Zaktualizuj plan w ustawieniach.')
    if (errCode === 'project_access_denied')
      throw new Error('Brak dostępu do projektu lub projekt nie istnieje.')
    if (errCode === 'ai_not_configured')
      throw new Error('AI nie jest skonfigurowane (brak OPENAI_API_KEY)')
    throw new Error(String(data.message ?? `HTTP ${resp.status}`))
  }

  const raw = (data.result ?? data) as RoomAnalysisRaw

  // Flatten v2 scoped work scope into single AnalysisResult.work_scope array
  const work_scope_multi = [
    ...(raw.required_work_scope ?? []),
    ...(raw.likely_work_scope ?? []),
    ...(raw.optional_work_scope ?? []),
  ].map(item => ({
    description:    item.description,
    category:       item.category,
    estimated_unit: item.unit ?? undefined,
    estimated_qty:  item.quantity ?? undefined,
    confidence:     item.confidence,
    notes:          item.notes ?? undefined,
  }))

  const result: AnalysisResult = {
    input_type: 'room_photo',
    document_type: 'room_scan',
    detected_materials: raw.detected_materials ?? [],
    work_scope: work_scope_multi,
    suggested_estimate_items: (raw.suggested_estimate_items ?? []).map(item => ({
      ...item,
      source: (item.source || 'ai_suggestion') as 'ai_suggestion' | 'market_data' | 'historical',
    })),
    extraction_confidence: raw.confidence ?? 0,
    extraction_warnings: raw.warnings ?? [],
    requires_user_confirmation: true,
    parser_source: 'vision',
  }

  if (raw.notes) {
    result.extraction_warnings = [
      ...result.extraction_warnings,
      `Notatka AI: ${raw.notes}`,
    ]
  }

  if (raw.clarification_questions && raw.clarification_questions.length > 0) {
    result.clarification_questions = raw.clarification_questions as AnalysisResult['clarification_questions']
  }

  return result
}

export function useAnalyzeRoomPhotos() {
  return useMutation({
    mutationFn: ({ files, clarification, roomType, projectId }: { files: File[]; clarification?: BathroomClarification; roomType?: string; projectId?: string }) =>
      callAnalyzeRoomPhotos(files, clarification, roomType, projectId),
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false
      const msg = error instanceof Error ? error.message : ''
      return /502|503|504|niedostępny|network|fetch/i.test(msg)
    },
    retryDelay: 3000,
  })
}
