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

interface SuggestedEstimateItem {
  name:        string
  unit:        string
  quantity:    number
  unit_price?: number | null
  confidence:  number
  source:      'ai_suggestion' | 'market_data' | 'historical'
  notes?:      string | null
}

export interface RoomAnalysisResult {
  room_type:               string | null
  detected_materials:      DetectedMaterial[]
  work_scope:              WorkScopeItem[]
  suggested_estimate_items: SuggestedEstimateItem[]
  extraction_confidence:   number
  extraction_warnings:     string[]
  notes:                   string | null
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

const ESTIMATE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    name:       { type: 'string' },
    unit:       { type: 'string' },
    quantity:   { type: 'number' },
    unit_price: nn,
    confidence: { type: 'number' },
    source:     { type: 'string', enum: ['ai_suggestion', 'market_data', 'historical'] },
    notes:      ns,
  },
  required: ['name', 'unit', 'quantity', 'unit_price', 'confidence', 'source', 'notes'],
  additionalProperties: false,
}

const ROOM_ANALYSIS_SCHEMA_FORMAT = {
  type:   'json_schema',
  name:   'room_analysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      room_type:                ns,
      detected_materials:       { type: 'array', items: MATERIAL_SCHEMA },
      work_scope:               { type: 'array', items: WORK_SCOPE_SCHEMA },
      suggested_estimate_items: { type: 'array', items: ESTIMATE_ITEM_SCHEMA },
      confidence:               { type: 'number' },
      warnings:                 { type: 'array', items: { type: 'string' } },
      notes:                    ns,
    },
    required: ['room_type', 'detected_materials', 'work_scope', 'suggested_estimate_items', 'confidence', 'warnings', 'notes'],
    additionalProperties: false,
  },
}

// ── System instructions ──────────────────────────────────────────────────────

const BATHROOM_LIBRARY_BLOCK = `
BIBLIOTEKA TYPOWYCH POZYCJI ŁAZIENKOWYCH (referencja do dopasowania):

## Demontaż i przygotowanie
- demo_tiles_wall: Demontaż starych płytek ściennych (m²) [PRAWDOPODOBNA]
- demo_tiles_floor: Demontaż starych płytek podłogowych (m²) [PRAWDOPODOBNA]
- demo_fixtures: Demontaż starej ceramiki i armatury (kpl.) [PRAWDOPODOBNA]
- demo_bathtub: Demontaż wanny / brodzika (szt.) [WARUNKOWA]
- debris_removal: Wywóz gruzu i odpadów (kpl.) [OBOWIĄZKOWA]

## Przygotowanie podłoża
- substrate_leveling: Wyrównanie podłoża (m²) [PRAWDOPODOBNA]
- substrate_priming: Gruntowanie podłoża pod płytki (m²) [OBOWIĄZKOWA]
- substrate_plastering: Tynkowanie / wyrównanie ścian (m²) [WARUNKOWA]

## Hydroizolacja
- waterproof_wet: Hydroizolacja stref mokrych (m²) [OBOWIĄZKOWA]
- waterproof_floor: Hydroizolacja podłogi łazienki (m²) [OBOWIĄZKOWA]
- waterproof_tape: Taśmy uszczelniające (mb) [OBOWIĄZKOWA]
- waterproof_collar: Kołnierze uszczelniające (szt.) [OBOWIĄZKOWA]

## Zabudowy GK
- gk_pipe_casing: Zabudowa pionów instalacyjnych GK (mb) [PRAWDOPODOBNA]
- gk_inspection: Rewizja serwisowa (szt.) [PRAWDOPODOBNA]
- gk_wc_frame: Zabudowa stelaża WC podtynkowego (kpl.) [WARUNKOWA]
- gk_niche: Wnęka / półka z GK (szt.) [OPCJONALNA]
- gk_ceiling: Sufit podwieszany GK (m²) [OPCJONALNA]

## Instalacja wod-kan
- plumb_points: Przeróbka punktów wod-kan (szt.) [WARUNKOWA]
- plumb_shower_drain: Montaż odpływu liniowego (szt.) [WARUNKOWA]

## Okładziny ścienne
- tile_wall_full: Płytki ścienne pełna wysokość (m²) [PRAWDOPODOBNA]
- tile_wall_partial: Płytki ścienne częściowa wys. (m²) [WARUNKOWA]
- tile_wall_trim: Obróbki, docinki, listwy narożnikowe (mb) [OBOWIĄZKOWA]
- tile_wall_grouting: Fugowanie płytek ściennych (m²) [OBOWIĄZKOWA]

## Okładziny podłogowe
- tile_floor: Płytki podłogowe (m²) [OBOWIĄZKOWA]
- tile_floor_grouting: Fugowanie płytek podłogowych (m²) [OBOWIĄZKOWA]
- tile_threshold: Próg / listwa progowa (szt.) [PRAWDOPODOBNA]

## Malowanie
- paint_ceiling: Malowanie sufitu (m²) [PRAWDOPODOBNA]
- paint_walls: Malowanie ścian bez płytek (m²) [WARUNKOWA]

## Biały montaż
- fix_wc: Montaż miski WC (szt.) [OBOWIĄZKOWA]
- fix_basin: Montaż umywalki (szt.) [OBOWIĄZKOWA]
- fix_shower_cabin: Montaż kabiny prysznicowej (kpl.) [WARUNKOWA]
- fix_bathtub: Montaż wanny + obudowa (kpl.) [WARUNKOWA]

## Armatura
- fit_basin_tap: Bateria umywalkowa (szt.) [OBOWIĄZKOWA]
- fit_shower_set: Zestaw prysznicowy (kpl.) [PRAWDOPODOBNA]
- fit_angle_valves: Zawory kątowe (szt.) [OBOWIĄZKOWA]

## Akcesoria
- acc_mirror: Lustro (szt.) [PRAWDOPODOBNA]
- acc_towel_rail: Wieszak / grzejnik łazienkowy (szt.) [PRAWDOPODOBNA]

## Uszczelnienia i odbiór
- seal_silicone: Silikonowanie (mb) [OBOWIĄZKOWA]
- seal_cleanup: Sprzątanie powykonawcze (kpl.) [OBOWIĄZKOWA]
`

const INSTRUCTIONS = `Jesteś ekspertem od remontów i wykończeń wnętrz w Polsce, specjalizujesz się w łazienkach.
Analizujesz zdjęcia pomieszczeń i na podstawie:
- widocznych materiałów, stanu wykończenia, urządzeń sanitarnych
- przekazanych parametrów (powierzchnia, wysokość, standard)
- profesjonalnej biblioteki pozycji łazienkowych

generujesz KOMPLETNY zakres prac remontowych.

Zwróć TYLKO poprawny JSON zgodny z podanym schematem.

${BATHROOM_LIBRARY_BLOCK}

WAŻNE — ZASADY DOPASOWANIA DO BIBLIOTEKI:
1. Dla każdej pozycji z suggested_estimate_items MUSISZ użyć nazwy z biblioteki (np. "Hydroizolacja stref mokrych" zamiast ogólnego "hydroizolacja")
2. W polu "notes" podaj library_id (np. "waterproof_wet") dla pozycji dopasowanych z biblioteki
3. Pozycje [OBOWIĄZKOWA] w łazience ZAWSZE dodaj — nawet jeśli nie widać ich na zdjęciu
4. Pozycje [PRAWDOPODOBNA] dodaj gdy widoczne przesłanki lub użytkownik potwierdził
5. Pozycje [WARUNKOWA] dodaj TYLKO gdy widoczne na zdjęciu LUB potwierdzone w clarification
6. Nie wymyślaj pozycji które nie mają pokrycia w bibliotece ani na zdjęciu
7. Gdy analizujesz wiele zdjęć — łącz informacje z WSZYSTKICH (różne kąty = pełniejszy obraz)

Zasady analizy materiałów (detected_materials):
- Identyfikuj widoczne materiały: typ, kategoria, przybliżona ilość jeśli możliwa
- Kategorie: okładziny_ścian, okładziny_podłóg, instalacja_sanitarna, instalacja_elektryczna, stolarka, farby_tynki, oświetlenie, meble_zabudowa, inne
- Podaj confidence 0-100 dla każdego materiału
- Szacuj ilość (quantity + unit) TYLKO gdy wystarczające wskazówki wizualne

Zasady zakresu prac (work_scope):
- Proponuj realne prace wynikające z widocznego stanu i biblioteki
- Kategorie: demolition, substrate, waterproofing, drywall, plumbing, electrical, tiling, painting, fixtures, fittings, accessories, sealing
- Opisz po polsku
- estimated_unit: m², mb, szt., kpl., ryczałt
- estimated_qty: TYLKO gdy da się oszacować

Zasady pozycji wyceny (suggested_estimate_items):
- Wygeneruj pozycje na podstawie biblioteki + widocznego stanu + clarification
- Każda pozycja: name (z biblioteki!), unit, quantity (DRAFT), confidence 0-100
- W notes wpisz library_id (np. "waterproof_wet") + opcjonalny komentarz
- unit_price: null (NIE wymyślaj cen)
- source: zawsze "ai_suggestion"
- Gdy masz dane o powierzchni: oblicz ilości (np. area × 4 ściany × wys = wall_area)
- Gdy brak danych: quantity=0 z niskim confidence
- Pozycje grupuj w logicznej kolejności (demontaż → przygotowanie → hydroizolacja → …)
- To jest DRAFT — nie udawaj precyzji, ale bądź kompletny

Zasady ogólne:
- room_type: łazienka, kuchnia, pokój, korytarz, salon, sypialnia, biuro, inne
- confidence: 0-100 ogólna pewność analizy
- Preferuj null nad zgadywanie
- Dodaj warnings gdy obraz jest niewyraźny, ciemny, lub nie przedstawia pomieszczenia
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

  // Multi-photo support: body.images = [{base64, type}, ...]
  const rawImages = Array.isArray(body.images) ? body.images as Array<{base64?: string; type?: string}> : []
  const multiImages = rawImages
    .filter(img => typeof img.base64 === 'string' && img.base64.length > 0)
    .slice(0, 10) // max 10 images

  // Clarification data from guided form
  const clarification = (body.clarification ?? null) as Record<string, unknown> | null

  // Need at least one image (from multi-photo or legacy single-photo)
  if (multiImages.length === 0 && !imageBase64) return err(400, 'missing_image', 'image_base64 is required')

  const isValidMime = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i.test(imageType)
  if (!isValidMime && multiImages.length === 0) return err(400, 'invalid_image_type', `Unsupported image type: ${imageType}`)

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o'
  const imageCount = multiImages.length || 1

  console.info('ROOM_ANALYSIS_START', JSON.stringify({ model, imageType, imageCount, hasContext: !!context, hasClarification: !!clarification }))

  // ── Build input ─────────────────────────────────────────────────────────

  type InputItem = { type: string; text?: string; image_url?: string }
  const content: InputItem[] = []

  // Add images (multi-photo or single)
  if (multiImages.length > 0) {
    for (const img of multiImages) {
      const mime = img.type || 'image/jpeg'
      content.push({ type: 'input_image', image_url: `data:${mime};base64,${img.base64}` })
    }
  } else if (imageBase64) {
    content.push({ type: 'input_image', image_url: `data:${imageType};base64,${imageBase64}` })
  }

  // Build context text with clarification
  let contextText = `Przeanalizuj ${imageCount > 1 ? `te ${imageCount} zdjęć pomieszczenia (różne kąty)` : 'to zdjęcie pomieszczenia'}. Zidentyfikuj materiały wykończeniowe, zaproponuj zakres prac remontowych i wygeneruj propozycje pozycji do wyceny na podstawie biblioteki.`

  if (clarification) {
    const parts: string[] = []
    if (typeof clarification.area_m2 === 'number') parts.push(`Powierzchnia: ${clarification.area_m2} m²`)
    if (typeof clarification.ceiling_height_m === 'number') parts.push(`Wysokość: ${clarification.ceiling_height_m} m`)
    if (typeof clarification.tile_coverage === 'string') parts.push(`Płytki ścienne: ${clarification.tile_coverage === 'full' ? 'pełna wysokość' : clarification.tile_coverage === 'partial' ? 'częściowa' : 'brak'}`)
    if (clarification.has_bathtub) parts.push('Wanna: tak')
    if (clarification.has_shower) parts.push('Prysznic: tak')
    if (clarification.has_underfloor_heating) parts.push('Ogrzewanie podłogowe: tak')
    if (typeof clarification.fixtures_standard === 'string') parts.push(`Standard: ${clarification.fixtures_standard}`)
    if (typeof clarification.notes === 'string' && clarification.notes) parts.push(`Uwagi: ${String(clarification.notes).slice(0, 300)}`)
    if (parts.length > 0) {
      contextText += `\n\nDane od użytkownika:\n${parts.join('\n')}`
    }
  }

  if (context) {
    contextText += `\n\nKontekst: ${context}`
  }

  content.push({ type: 'input_text', text: contextText })

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
        max_output_tokens: 6_000,
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

  const rawEstimate = Array.isArray(ai.suggested_estimate_items) ? ai.suggested_estimate_items : []

  const VALID_SOURCES = new Set(['ai_suggestion', 'market_data', 'historical'])
  const estimateItems: SuggestedEstimateItem[] = rawEstimate.map((e: Record<string, unknown>) => ({
    name:       String(e.name ?? ''),
    unit:       String(e.unit ?? 'szt.'),
    quantity:   typeof e.quantity === 'number' ? Math.max(0, e.quantity) : 0,
    unit_price: typeof e.unit_price === 'number' ? e.unit_price : null,
    confidence: typeof e.confidence === 'number' ? Math.min(100, Math.max(0, e.confidence)) : 30,
    source:     (VALID_SOURCES.has(String(e.source)) ? String(e.source) : 'ai_suggestion') as SuggestedEstimateItem['source'],
    notes:      typeof e.notes === 'string' ? e.notes : null,
  })).filter((e: SuggestedEstimateItem) => e.name.length > 0)

  if (materials.length === 0 && workScope.length === 0) {
    warnings.push('Nie wykryto materiałów ani zakresu prac — zdjęcie może nie przedstawiać pomieszczenia.')
  }

  const result: RoomAnalysisResult = {
    room_type:               typeof ai.room_type === 'string' ? ai.room_type : null,
    detected_materials:      materials,
    work_scope:              workScope,
    suggested_estimate_items: estimateItems,
    extraction_confidence:   confidence,
    extraction_warnings:     warnings,
    notes:                   typeof ai.notes === 'string' ? ai.notes : null,
  }

  console.info('ROOM_ANALYSIS_DONE', JSON.stringify({
    model,
    imageCount,
    roomType:       result.room_type,
    materials:      materials.length,
    workScope:      workScope.length,
    estimateItems:  estimateItems.length,
    confidence:     result.extraction_confidence,
    warnings:       warnings.length,
  }))

  return ok(result)
}
