// =============================================================================
// Netlify Function: analyze-room-photo  (v1 — Room/Site Vision Analysis)
// =============================================================================
// AI analysis of room/bathroom/site photos via OpenAI vision.
// Returns detected materials, work scope, and confidence metadata.
//
// Request (POST /.netlify/functions/analyze-room-photo):
//   Content-Type: application/json
//   Authorization: Bearer <supabase-jwt>
//   {
//     image_base64: string   // base64-encoded image JPEG/PNG/WEBP
//     image_type:   string   // MIME, e.g. "image/jpeg"
//     context?:     string   // optional user hint, e.g. "łazienka do remontu"
//   }
//
// Response 200: { ok: true, result: RoomAnalysisResult }
// Response 4xx/5xx: { ok: false, error: string, message: string }

import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

interface DetectedMaterial {
  name:        string
  category:    string
  quantity?:   number | null
  unit?:       string | null
  confidence:  number
  notes?:      string | null
}

interface WorkScopeItem {
  description:    string
  category:       string
  estimated_unit?: string | null
  estimated_qty?:  number | null
  confidence:     number
  notes?:         string | null
}

export interface RoomAnalysisResult {
  room_type:            string | null
  detected_materials:   DetectedMaterial[]
  work_scope:           WorkScopeItem[]
  extraction_confidence: number
  extraction_warnings:   string[]
  notes:                string | null
}

// ── Infra ────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

async function verifyRequestAuth(event: HandlerEvent): Promise<string | null> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn('[analyze-room-photo] Supabase not configured — skipping JWT check (dev only)')
    return 'dev'
  }
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization']
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser(authHeader.slice(7))
    return user?.id ?? null
  } catch {
    return null
  }
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_MAX       = 8
const RATE_WINDOW_MS = 10 * 60 * 1000

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_MAX
}

function ok(result: RoomAnalysisResult) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, result }) }
}

function err(statusCode: number, error: string, message: string) {
  console.error(`[analyze-room-photo] ${error}: ${message}`)
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, error, message }) }
}

// ── JSON Schema for Structured Output ────────────────────────────────────────

const ns = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const nn = { anyOf: [{ type: 'number' }, { type: 'null' }] }

const MATERIAL_SCHEMA = {
  type: 'object',
  properties: {
    name:       { type: 'string' },
    category:   { type: 'string' },
    quantity:   nn,
    unit:       ns,
    confidence: { type: 'number' },
    notes:      ns,
  },
  required: ['name', 'category', 'quantity', 'unit', 'confidence', 'notes'],
  additionalProperties: false,
}

const WORK_SCOPE_SCHEMA = {
  type: 'object',
  properties: {
    description:    { type: 'string' },
    category:       { type: 'string' },
    estimated_unit: ns,
    estimated_qty:  nn,
    confidence:     { type: 'number' },
    notes:          ns,
  },
  required: ['description', 'category', 'estimated_unit', 'estimated_qty', 'confidence', 'notes'],
  additionalProperties: false,
}

const ROOM_ANALYSIS_SCHEMA_FORMAT = {
  type:   'json_schema',
  name:   'room_analysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      room_type:          ns,
      detected_materials: { type: 'array', items: MATERIAL_SCHEMA },
      work_scope:         { type: 'array', items: WORK_SCOPE_SCHEMA },
      confidence:         { type: 'number' },
      warnings:           { type: 'array', items: { type: 'string' } },
      notes:              ns,
    },
    required: ['room_type', 'detected_materials', 'work_scope', 'confidence', 'warnings', 'notes'],
    additionalProperties: false,
  },
}

// ── System instructions ──────────────────────────────────────────────────────

const INSTRUCTIONS = `Jesteś ekspertem od remontów i wykończeń wnętrz w Polsce.
Analizujesz zdjęcia pomieszczeń (łazienka, kuchnia, pokój, korytarz, itp.) i identyfikujesz:
1. Widoczne materiały wykończeniowe (płytki, farba, panele, gres, itp.)
2. Proponowany zakres prac remontowych / wykończeniowych

Zwróć TYLKO poprawny JSON zgodny z podanym schematem.

Zasady analizy materiałów (detected_materials):
- Identyfikuj widoczne materiały: typ, kategoria, przybliżona ilość jeśli możliwa
- Kategorie: okładziny_ścian, okładziny_podłóg, instalacja_sanitarna, instalacja_elektryczna, stolarka, farby_tynki, oświetlenie, meble_zabudowa, inne
- Podaj confidence 0-100 dla każdego materiału
- Jeśli nie jesteś pewien materiału, daj niski confidence i dodaj notes
- Szacuj ilość (quantity + unit) TYLKO gdy wystarczające wskazówki wizualne

Zasady zakresu prac (work_scope):
- Proponuj realne prace remontowe / wykończeniowe pasujące do widocznego stanu
- Kategorie: demolition, tiling, plumbing, electrical, painting, flooring, carpentry, installation, finishing, cleanup
- Opisz po polsku
- estimated_unit: m², mb, szt., kpl., ryczałt
- estimated_qty: TYLKO gdy da się oszacować z obrazu
- Podaj confidence 0-100

Zasady ogólne:
- room_type: łazienka, kuchnia, pokój, korytarz, salon, sypialnia, biuro, inne
- confidence: 0-100 ogólna pewność analizy
- Preferuj null nad zgadywanie
- Dodaj warnings gdy obraz jest niewyraźny, ciemny, lub nie przedstawia pomieszczenia
- Jeśli zdjęcie nie przedstawia pomieszczenia, zwróć puste listy i confidence 0
- Bądź praktyczny — proponuj prace które faktycznie wynikają z widocznego stanu`

// ── OpenAI types ─────────────────────────────────────────────────────────────

interface ResponsesAPIResult {
  model?:  string
  output?: Array<{
    type: string
    content?: Array<{ type: string; text?: string }>
  }>
  error?: { message: string; code?: string }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST')    return err(405, 'method_not_allowed', 'Only POST allowed')

  const userId = await verifyRequestAuth(event)
  if (!userId) return err(401, 'unauthorized', 'Valid authentication token required.')
  if (isRateLimited(userId)) return err(429, 'too_many_requests', 'Za dużo żądań. Spróbuj za chwilę.')

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return err(503, 'ai_not_configured', 'OPENAI_API_KEY is not set')

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return err(400, 'invalid_json', 'Request body must be valid JSON')
  }

  const imageBase64 = body.image_base64 as string | undefined
  const imageType   = String(body.image_type ?? 'image/jpeg')
  const context     = (body.context as string | undefined)?.slice(0, 500)

  if (!imageBase64) return err(400, 'missing_image', 'image_base64 is required')

  const isValidMime = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i.test(imageType)
  if (!isValidMime) return err(400, 'invalid_image_type', `Unsupported image type: ${imageType}`)

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o'

  console.info('ROOM_ANALYSIS_START', JSON.stringify({ model, imageType, hasContext: !!context }))

  // ── Build input ─────────────────────────────────────────────────────────

  type InputItem = { type: string; text?: string; image_url?: string }
  const content: InputItem[] = [
    { type: 'input_image', image_url: `data:${imageType};base64,${imageBase64}` },
    { type: 'input_text',  text: `Przeanalizuj to zdjęcie pomieszczenia. Zidentyfikuj materiały wykończeniowe i zaproponuj zakres prac remontowych.${context ? `\n\nKontekst od użytkownika: ${context}` : ''}` },
  ]

  // ── Call OpenAI ─────────────────────────────────────────────────────────

  let aiRaw: string
  try {
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: INSTRUCTIONS,
        input: [{ role: 'user', content }],
        text:  { format: ROOM_ANALYSIS_SCHEMA_FORMAT },
        max_output_tokens: 3_000,
      }),
    })

    const rawBody = await resp.text()

    if (!resp.ok) {
      if (resp.status === 429) return err(429, 'openai_quota_exceeded', 'OpenAI quota exceeded')
      throw new Error(`OpenAI ${resp.status}: ${rawBody.slice(0, 300)}`)
    }

    const data = JSON.parse(rawBody) as ResponsesAPIResult
    aiRaw = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}'
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('ROOM_ANALYSIS_ERROR', msg)
    return err(502, 'ai_call_failed', msg)
  }

  // ── Parse response ─────────────────────────────────────────────────────

  let ai: Record<string, unknown>
  try {
    ai = JSON.parse(aiRaw) as Record<string, unknown>
  } catch {
    console.error('ROOM_ANALYSIS_PARSE_ERROR', aiRaw.slice(0, 300))
    return err(502, 'ai_invalid_json', 'AI returned non-JSON response')
  }

  // ── Normalize ──────────────────────────────────────────────────────────

  const rawMaterials = Array.isArray(ai.detected_materials) ? ai.detected_materials : []
  const rawScope     = Array.isArray(ai.work_scope) ? ai.work_scope : []

  const materials: DetectedMaterial[] = rawMaterials.map((m: Record<string, unknown>) => ({
    name:       String(m.name ?? ''),
    category:   String(m.category ?? 'inne'),
    quantity:   typeof m.quantity === 'number' ? m.quantity : null,
    unit:       typeof m.unit === 'string' ? m.unit : null,
    confidence: typeof m.confidence === 'number' ? Math.min(100, Math.max(0, m.confidence)) : 50,
    notes:      typeof m.notes === 'string' ? m.notes : null,
  })).filter((m: DetectedMaterial) => m.name.length > 0)

  const workScope: WorkScopeItem[] = rawScope.map((w: Record<string, unknown>) => ({
    description:    String(w.description ?? ''),
    category:       String(w.category ?? 'finishing'),
    estimated_unit: typeof w.estimated_unit === 'string' ? w.estimated_unit : null,
    estimated_qty:  typeof w.estimated_qty === 'number' ? w.estimated_qty : null,
    confidence:     typeof w.confidence === 'number' ? Math.min(100, Math.max(0, w.confidence)) : 50,
    notes:          typeof w.notes === 'string' ? w.notes : null,
  })).filter((w: WorkScopeItem) => w.description.length > 0)

  const confidence = typeof ai.confidence === 'number'
    ? Math.min(100, Math.max(0, ai.confidence))
    : 30

  const warnings = Array.isArray(ai.warnings) ? (ai.warnings as unknown[]).map(String) : []

  if (materials.length === 0 && workScope.length === 0) {
    warnings.push('Nie wykryto materiałów ani zakresu prac — zdjęcie może nie przedstawiać pomieszczenia.')
  }

  const result: RoomAnalysisResult = {
    room_type:            typeof ai.room_type === 'string' ? ai.room_type : null,
    detected_materials:   materials,
    work_scope:           workScope,
    extraction_confidence: confidence,
    extraction_warnings:   warnings,
    notes:                typeof ai.notes === 'string' ? ai.notes : null,
  }

  console.info('ROOM_ANALYSIS_DONE', JSON.stringify({
    model,
    roomType:   result.room_type,
    materials:  materials.length,
    workScope:  workScope.length,
    confidence: result.extraction_confidence,
    warnings:   warnings.length,
  }))

  return ok(result)
}
