// =============================================================================
// Netlify Function: analyze-room-photo  (v2 — Room/Site Vision Analysis)
// =============================================================================
// AI analysis of room/bathroom/site photos via OpenAI vision.
// v2: room type aware, expanded clarification, quantity hints, coverage guidance.
//
// Request (POST /.netlify/functions/analyze-room-photo):
//   Content-Type: application/json
//   Authorization: Bearer <supabase-jwt>
//   {
//     image_base64: string   // base64-encoded image JPEG/PNG/WEBP
//     image_type:   string   // MIME, e.g. "image/jpeg"
//     context?:     string   // optional user hint
//     room_type?:   string   // bathroom, kitchen, room, hallway, facade, other
//     clarification?: object // guided form data
//   }
//
// Response 200: { ok: true, result: RoomAnalysisResult }
// Response 4xx/5xx: { ok: false, error: string, message: string }

import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { detectBathroomTriggers, expandDependencies, isBathroomSpace } from './shared/bathroom-triggers'
import type { ClarificationQuestion } from './shared/bathroom-triggers'
import { persistAnalysisBundle } from './shared/ai-persist'

// ── Types ────────────────────────────────────────────────────────────────────
// Local interfaces match src/services/ai/engines/room.types.ts (RoomAnalysisResult v2)
// Keep in sync with canonical types — Netlify functions cannot import from src/.

type StageOfWork =
  | 'before_renovation' | 'demolition' | 'shell'
  | 'in_progress' | 'finishing' | 'after_renovation' | 'unknown'

interface DetectedElement {
  type:       'fixture' | 'surface' | 'installation' | 'damage' | 'appliance' | 'furniture' | 'other'
  label:      string
  confidence: number
  location?:  string | null
  notes?:     string | null
}

interface DetectedMaterial {
  name:        string
  category:    string
  quantity?:   number | null
  unit?:       string | null
  confidence:  number
  notes?:      string | null
}

interface ScopeItem {
  library_id?:   string | null
  description:   string
  category:      string
  unit?:         string | null
  quantity?:     number | null
  priority:      'required' | 'likely' | 'optional'
  confidence:    number
  notes?:        string | null
  dependencies?: string[]
  provenance?:   'direct_detected' | 'dependency_inferred' | 'confirmation_needed'
}

interface QuantityHint {
  dimension:  'floor_area' | 'wall_area' | 'ceiling_area' | 'perimeter' | 'wet_zone_area' | 'other'
  value:      number | null
  unit:       string
  source:     'measured' | 'estimated' | 'user_input' | 'ai_inferred' | 'unknown'
  confidence: number
}

interface SuggestedEstimateItem {
  library_id?: string | null
  name:        string
  unit:        string
  quantity:    number
  unit_price?: number | null
  confidence:  number
  source:      'ai_suggestion' | 'market_data' | 'historical' | 'dependency_inferred' | 'confirmation_needed'
  notes?:      string | null
  provenance?: 'direct_detected' | 'dependency_inferred' | 'confirmation_needed'
}

/** v2 — matches src/services/ai/engines/room.types.ts RoomAnalysisResult */
export interface RoomAnalysisResult {
  space_type:              string | null
  stage_of_work:           StageOfWork
  observed_elements:       DetectedElement[]
  detected_installations:  DetectedElement[]
  detected_materials:      DetectedMaterial[]
  required_work_scope:     ScopeItem[]
  likely_work_scope:       ScopeItem[]
  optional_work_scope:     ScopeItem[]
  missing_information:     string[]
  assumptions:             string[]
  quantity_hints:          QuantityHint[]
  suggested_estimate_items: SuggestedEstimateItem[]
  coverage:                { total: number; matched: number; unmatched: number } | null
  warnings:                string[]
  confidence:              number
  notes:                   string | null
  clarification_questions?: ClarificationQuestion[]
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

function okWithRunId(result: RoomAnalysisResult, runId: string) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, result, run_id: runId }) }
}

function err(statusCode: number, error: string, message: string) {
  console.error(`[analyze-room-photo] ${error}: ${message}`)
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, error, message }) }
}

// ── JSON Schema for Structured Output (v2) ───────────────────────────────────

const ns = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const nn = { anyOf: [{ type: 'number' }, { type: 'null' }] }

const DETECTED_ELEMENT_SCHEMA = {
  type: 'object',
  properties: {
    type:       { type: 'string', enum: ['fixture', 'surface', 'installation', 'damage', 'appliance', 'furniture', 'other'] },
    label:      { type: 'string' },
    confidence: { type: 'number' },
    location:   ns,
    notes:      ns,
  },
  required: ['type', 'label', 'confidence', 'location', 'notes'],
  additionalProperties: false,
}

const DETECTED_MATERIAL_SCHEMA = {
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

const SCOPE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    library_id:   ns,
    description:  { type: 'string' },
    category:     { type: 'string' },
    unit:         ns,
    quantity:     nn,
    priority:     { type: 'string', enum: ['required', 'likely', 'optional'] },
    confidence:   { type: 'number' },
    notes:        ns,
    dependencies: { type: 'array', items: { type: 'string' } },
  },
  required: ['library_id', 'description', 'category', 'unit', 'quantity', 'priority', 'confidence', 'notes', 'dependencies'],
  additionalProperties: false,
}

const QUANTITY_HINT_SCHEMA = {
  type: 'object',
  properties: {
    dimension:  { type: 'string', enum: ['floor_area', 'wall_area', 'ceiling_area', 'perimeter', 'wet_zone_area', 'other'] },
    value:      nn,
    unit:       { type: 'string' },
    source:     { type: 'string', enum: ['measured', 'estimated', 'user_input', 'ai_inferred', 'unknown'] },
    confidence: { type: 'number' },
  },
  required: ['dimension', 'value', 'unit', 'source', 'confidence'],
  additionalProperties: false,
}

const ESTIMATE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    library_id: ns,
    name:       { type: 'string' },
    unit:       { type: 'string' },
    quantity:   { type: 'number' },
    unit_price: nn,
    confidence: { type: 'number' },
    source:     { type: 'string', enum: ['ai_suggestion', 'market_data', 'historical'] },
    notes:      ns,
  },
  required: ['library_id', 'name', 'unit', 'quantity', 'unit_price', 'confidence', 'source', 'notes'],
  additionalProperties: false,
}

const ROOM_ANALYSIS_SCHEMA_FORMAT = {
  type:   'json_schema',
  name:   'room_analysis_v2',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      space_type:              ns,
      stage_of_work:           { type: 'string', enum: ['before_renovation', 'demolition', 'shell', 'in_progress', 'finishing', 'after_renovation', 'unknown'] },
      observed_elements:       { type: 'array', items: DETECTED_ELEMENT_SCHEMA },
      detected_installations:  { type: 'array', items: DETECTED_ELEMENT_SCHEMA },
      detected_materials:      { type: 'array', items: DETECTED_MATERIAL_SCHEMA },
      required_work_scope:     { type: 'array', items: SCOPE_ITEM_SCHEMA },
      likely_work_scope:       { type: 'array', items: SCOPE_ITEM_SCHEMA },
      optional_work_scope:     { type: 'array', items: SCOPE_ITEM_SCHEMA },
      missing_information:     { type: 'array', items: { type: 'string' } },
      assumptions:             { type: 'array', items: { type: 'string' } },
      quantity_hints:          { type: 'array', items: QUANTITY_HINT_SCHEMA },
      suggested_estimate_items: { type: 'array', items: ESTIMATE_ITEM_SCHEMA },
      coverage: {
        anyOf: [
          {
            type: 'object',
            properties: {
              total:     { type: 'number' },
              matched:   { type: 'number' },
              unmatched: { type: 'number' },
            },
            required: ['total', 'matched', 'unmatched'],
            additionalProperties: false,
          },
          { type: 'null' },
        ],
      },
      warnings:   { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' },
      notes:      ns,
    },
    required: [
      'space_type', 'stage_of_work', 'observed_elements', 'detected_installations',
      'detected_materials', 'required_work_scope', 'likely_work_scope', 'optional_work_scope',
      'missing_information', 'assumptions', 'quantity_hints', 'suggested_estimate_items',
      'coverage', 'warnings', 'confidence', 'notes',
    ],
    additionalProperties: false,
  },
}

// ── System instructions ──────────────────────────────────────────────────────
// NOTE: BATHROOM_LIBRARY_BLOCK is a v3 inline copy of buildLibraryPromptBlock()
// from src/services/ai/bathroom-task-library.ts. Update both in sync.

const BATHROOM_LIBRARY_BLOCK = `
BIBLIOTEKA TYPOWYCH POZYCJI LAZIENKOWYCH (v3 — 151 pozycji, 23 kategorie):

## Pomiar i przygotowanie
- measure_inventory: Pomiar / inwentaryzacja / trasowanie (kpl.) [OBOWIAZKOWA]
- site_protection: Zabezpieczenie placu budowy / sasiednich pomieszczen (kpl.) [PRAWDOPODOBNA]
- utility_shutoff: Odciecie mediow / wody / pradu (kpl.) [OBOWIAZKOWA]

## Demontaz
- demo_tiles_wall: Demontaz starych plytek sciennych (m2) [PRAWDOPODOBNA]
- demo_tiles_floor: Demontaz starych plytek podlogowych (m2) [PRAWDOPODOBNA]
- demo_fixtures: Demontaz ceramiki i armatury (kpl.) [PRAWDOPODOBNA]
- demo_bathtub: Demontaz wanny / brodzika (szt.) [WARUNKOWA]
- demo_drywall: Demontaz zabudow GK (m2) [WARUNKOWA]
- demo_door: Demontaz drzwi / oscieznicy (kpl.) [WARUNKOWA]
- demo_ceiling: Demontaz sufitu podwieszanego (m2) [WARUNKOWA]

## Wywoz gruzu
- debris_removal: Wywoz gruzu i odpadow (kpl.) [OBOWIAZKOWA]
- debris_sorting: Segregacja odpadow budowlanych (kpl.) [OPCJONALNA]

## Przygotowanie podloza - podloga
- substrate_floor_leveling: Wyrownanie podloza podlogowego (m2) [PRAWDOPODOBNA]
- substrate_floor_priming: Gruntowanie podloza pod plytki (m2) [OBOWIAZKOWA]

## Przygotowanie podloza - sciany
- substrate_wall_priming: Gruntowanie scian pod plytki / malowanie (m2) [OBOWIAZKOWA]
- substrate_plastering: Tynkowanie / wyrownanie scian (m2) [WARUNKOWA]
- substrate_patching: Szpachlowanie ubytow, naprawa scian (m2) [PRAWDOPODOBNA]

## Wylewka / szlichta
- screed_standard: Wylewka samopoziomujaca standard (m2) [PRAWDOPODOBNA]
- screed_heated: Wylewka pod ogrzewanie podlogowe (m2) [WARUNKOWA] (jezeli: has_underfloor_heating)

## Hydroizolacja
- waterproof_wet: Hydroizolacja stref mokrych (prysznic, wanna) (m2) [OBOWIAZKOWA]
- waterproof_floor: Hydroizolacja podlogi lazienki (m2) [OBOWIAZKOWA]
- waterproof_tape: Tasmy uszczelniajace narozniki, przejscia (mb) [OBOWIAZKOWA] (wymaga: waterproof_wet)
- waterproof_collar: Kolnierze uszczelniajace odplyw, rury (szt.) [OBOWIAZKOWA] (wymaga: waterproof_floor)
- waterproof_membrane: Membrana uszczelniajaca pod plyciami sciennymi (m2) [WARUNKOWA]

## Zabudowy GK / obudowy / rewizje
- gk_pipe_casing: Zabudowa pionow instalacyjnych GK (mb) [PRAWDOPODOBNA]
- gk_inspection: Rewizja serwisowa / drzwiczki (szt.) [PRAWDOPODOBNA] (wymaga: gk_pipe_casing)
- gk_wc_frame: Zabudowa stelaza WC podtynkowego (kpl.) [WARUNKOWA] (wymaga: fix_wc_concealed)
- gk_niche: Wneka / polka z GK (szt.) [OPCJONALNA]
- gk_ceiling: Sufit podwieszany GK (m2) [OPCJONALNA]
- gk_boiler_casing: Obudowa kotla / bojlera (kpl.) [WARUNKOWA]
- gk_bath_panel: Obudowa boczna wanny GK (kpl.) [WARUNKOWA] (wymaga: fix_bathtub)

## Instalacja wod-kan
- plumb_points: Przerobka punktow wod-kan (szt.) [WARUNKOWA]
- plumb_shower_drain: Montaz odplywu liniowego / brodzika (szt.) [WARUNKOWA]
- plumb_bathtub: Podlaczenie wanny (szt.) [WARUNKOWA] (wymaga: fix_bathtub)
- plumb_mixing_valve: Montaz baterii podtynkowej (szt.) [OPCJONALNA]
- plumb_radiator: Montaz grzejnika lazienkowego / drabinki (szt.) [PRAWDOPODOBNA]
- plumb_washing_machine: Przylacze pralki / suszarki (kpl.) [WARUNKOWA]
- plumb_flush_tank: Montaz zbiornika splukujacego (szt.) [WARUNKOWA]

## Instalacja elektryczna
- elec_points: Przerobka punktow elektrycznych (szt.) [WARUNKOWA]
- elec_lighting: Montaz oswietlenia LED, halogeny (szt.) [PRAWDOPODOBNA]
- elec_mirror_light: Podlaczenie oswietlenia lustra (szt.) [OPCJONALNA] (wymaga: acc_mirror)
- elec_fan: Montaz wentylatora lazienkowego (szt.) [PRAWDOPODOBNA]
- elec_gfci: Gniazdko z ochrona przeciwpora (szt.) [PRAWDOPODOBNA]
- elec_led_strip: Montaz tasmy LED (mb) [OPCJONALNA]
- elec_switch: Montaz wlacznikow swiatla (szt.) [PRAWDOPODOBNA]

## Ogrzewanie podlogowe
- elec_underfloor: Mata grzewcza podlogowa elektryczna (m2) [OPCJONALNA]
- underfloor_hydro: Ogrzewanie podlogowe wodne (m2) [OPCJONALNA]
- underfloor_thermostat: Termostat podlogowy (szt.) [PRAWDOPODOBNA] (wymaga: elec_underfloor LUB underfloor_hydro)

## Okladziny scienne
- tile_wall_full: Ukladanie plytek sciennych pelna wysokosc (m2) [PRAWDOPODOBNA]
- tile_wall_partial: Ukladanie plytek sciennych czesciowa wys. (m2) [WARUNKOWA]
- tile_wall_trim: Obrobki, docinki, listwy naroznikowe (mb) [OBOWIAZKOWA] (wymaga: tile_wall_full LUB tile_wall_partial)
- tile_wall_grouting: Fugowanie plytek sciennych (m2) [OBOWIAZKOWA] (wymaga: tile_wall_full LUB tile_wall_partial)
- tile_window_sill: Obrobka okna glif, parapet z plytek (mb) [WARUNKOWA]

## Okladziny podlogowe
- tile_floor: Ukladanie plytek podlogowych (m2) [OBOWIAZKOWA]
- tile_floor_grouting: Fugowanie plytek podlogowych (m2) [OBOWIAZKOWA] (wymaga: tile_floor)
- tile_floor_trim: Cokoly / listwy przypodlogowe (mb) [OPCJONALNA]
- tile_threshold: Prog / listwa progowa (szt.) [PRAWDOPODOBNA]

## Format wielki / wielkoformatowy
- large_format_floor: Ukladanie plytek wielkoformatowych podloga (m2) [WARUNKOWA]
- large_format_wall: Ukladanie plytek wielkoformatowych sciany (m2) [WARUNKOWA]
- large_format_cutting: Ciecie i specjalistyczna obrobka plytek WF (mb) [WARUNKOWA]

## Dekoracje / mozaika
- tile_mosaic: Ukladanie mozaiki / dekorow (m2) [OPCJONALNA]
- tile_decorative_strip: Listwa / fryz dekoracyjny (mb) [OPCJONALNA]
- tile_feature_wall: Plytki dekoracyjne akcentowa sciana (m2) [OPCJONALNA]

## Profile, listwy, wykończenie krawedzi
- profile_corner: Profile naroznikowe (mb) [PRAWDOPODOBNA]
- profile_expansion: Profile dylatacyjne (mb) [WARUNKOWA]
- profile_floor_wall: Profile przejsciowe sciana-podloga (mb) [OPCJONALNA]

## Fugowanie
- grout_walls: Fugowanie plytek sciennych (m2) [OBOWIAZKOWA] (wymaga: tile_wall_full LUB tile_wall_partial)
- grout_floor: Fugowanie plytek podlogowych (m2) [OBOWIAZKOWA] (wymaga: tile_floor)
- grout_epoxy: Fuga epoksydowa (wybrane strefy) (m2) [OPCJONALNA]

## Silikonowanie
- seal_silicone: Silikonowanie wanna, brodzik, umywalka, WC (mb) [OBOWIAZKOWA]
- seal_silicone_shower: Silikonowanie kabiny/strefy prysznicowej (mb) [PRAWDOPODOBNA]
- seal_acrylic: Uszczelnienie akrylowe narozniki, przejscia (mb) [PRAWDOPODOBNA]

## Malowanie / tynki dekoracyjne
- paint_ceiling: Malowanie sufitu farba lazienkowa (m2) [PRAWDOPODOBNA]
- paint_walls: Malowanie scian strefy bez plytek (m2) [WARUNKOWA]
- paint_door_frame: Malowanie oscieznicy / framugi (szt.) [WARUNKOWA]
- decorative_plaster: Tynk dekoracyjny / strukturalny (m2) [OPCJONALNA]

## Bialy montaz
- fix_wc: Montaz miski WC (szt.) [OBOWIAZKOWA]
- fix_wc_concealed: Montaz WC podtynkowego z przyciskiem (kpl.) [WARUNKOWA] (wymaga: gk_wc_frame)
- fix_basin: Montaz umywalki (szt.) [OBOWIAZKOWA]
- fix_double_basin: Montaz umywalki podwojnej (szt.) [WARUNKOWA]
- fix_countertop_basin: Montaz umywalki nablatowej (szt.) [WARUNKOWA]
- fix_shower_cabin: Montaz kabiny prysznicowej (kpl.) [WARUNKOWA]
- fix_shower_tray: Montaz brodzika (szt.) [WARUNKOWA]
- fix_bathtub: Montaz wanny + obudowa (kpl.) [WARUNKOWA]
- fix_freestanding_bath: Montaz wanny wolnostojacey (kpl.) [WARUNKOWA]
- fix_bidet: Montaz bidetu (szt.) [OPCJONALNA]
- fix_urinal: Montaz pisuaru (szt.) [OPCJONALNA]
- fix_vanity_unit: Montaz szafki podumywalkowej (kpl.) [PRAWDOPODOBNA]

## Armatura
- fit_basin_tap: Montaz baterii umywalkowej (szt.) [OBOWIAZKOWA] (wymaga: fix_basin)
- fit_shower_set: Montaz zestawu prysznicowego (kpl.) [PRAWDOPODOBNA]
- fit_bathtub_tap: Montaz baterii wannowej (szt.) [WARUNKOWA] (wymaga: fix_bathtub)
- fit_thermostatic: Montaz baterii termostatycznej (szt.) [OPCJONALNA]
- fit_angle_valves: Montaz zaworow katowych (szt.) [OBOWIAZKOWA]
- fit_concealed_tap: Montaz baterii podtynkowej (szt.) [OPCJONALNA]

## Szyby / kabiny / walk-in
- glass_partition: Montaz szyby / scianki walk-in (szt.) [WARUNKOWA]
- glass_shower_door: Montaz drzwi prysznicowych (szt.) [WARUNKOWA]
- glass_mirror_wall: Montaz lustra wielkopowierzchniowego (m2) [OPCJONALNA]

## Akcesoria i wykończenie
- acc_mirror: Montaz lustra (szt.) [PRAWDOPODOBNA]
- acc_towel_rail: Montaz wieszaka / drabinki (szt.) [PRAWDOPODOBNA]
- acc_heated_towel: Montaz grzejnika drabinkowego elektrycznego (szt.) [OPCJONALNA]
- acc_shelf: Montaz polek / organizerow (szt.) [OPCJONALNA]
- acc_toilet_paper: Montaz uchwytu na papier (szt.) [PRAWDOPODOBNA]
- acc_soap_dish: Montaz dozownika / mydelniczki (szt.) [OPCJONALNA]
- acc_robe_hook: Montaz haczyow / wiesjakow szlafroka (szt.) [OPCJONALNA]
- acc_ventilation_grille: Montaz kratki wentylacyjnej (szt.) [PRAWDOPODOBNA]
- acc_door_installation: Montaz drzwi lazienki (kpl.) [WARUNKOWA]

## Uszczelnienia i odbior
- seal_cleanup: Sprzatanie powykonawcze (kpl.) [OBOWIAZKOWA]
- seal_inspection: Odbior techniczny / proba szczelnosci (kpl.) [OPCJONALNA]
- seal_snag_list: Usuniecie usterek po odbiorze (kpl.) [OPCJONALNA]
`

const INSTRUCTIONS = `Jestes ekspertem od remontow i wykonczenia wnetrz w Polsce, specjalizacja: lazienki, kuchnie, pokoje.
Analizujesz zdjecia pomieszczen i generujesz KOMPLETNY zakres prac remontowych — jak kosztorysant branzowy.

Zwroc TYLKO poprawny JSON zgodny z podanym schematem.

${BATHROOM_LIBRARY_BLOCK}

STAGE_OF_WORK — jak rozpoznac:
- before_renovation: stara lazienka w uzyciu, stare okładziny/armatura
- demolition: kuce, gole mury/podlogi, gruz
- shell: stan surowy — brak okladzin, gole sciany po tynku
- in_progress: mix — czesc prac wykonana, czesc nie
- finishing: montaz armatury/akcesoriow, malowanie
- after_renovation: nowe okladziny, nowa armatura, czyste wykonczenie
- unknown: nie da sie okreslic

PODZIAŁ ZAKRESU PRAC (trzy listy!):
required_work_scope — pozycje [OBOWIAZKOWA]: ZAWSZE dodaj dla kazdej lazienki
  Przyklad: pomiar, gruntowanie, hydroizolacja, fugowanie, silikonowanie, sprzatanie

likely_work_scope — pozycje [PRAWDOPODOBNA]: dodaj gdy probaki lub logicznie wynika
  Przyklad: demontaz starych plytek, oswietlenie, grzejnik, kabina prysznicowa

optional_work_scope — pozycje [WARUNKOWA]/[OPCJONALNA]: TYLKO gdy widoczne lub potwierdzone
  Przyklad: wneka GK, WC podtynkowe, wanna wolnostojaca, ogrzewanie podlogowe

ZASADY ZALEZNOSCI — automatycznie dodaj:
- fix_wc_concealed → gk_wc_frame
- odpływ liniowy → plumb_shower_drain
- fix_bathtub → plumb_bathtub + fit_bathtub_tap
- gk_inspection → gk_pipe_casing
- waterproof_wet → waterproof_tape + waterproof_collar
- tile_wall_grouting → tile_wall_full LUB tile_wall_partial

ILOSCI (quantity_hints + suggested_estimate_items):
Gdy podano wymiary — oblicz i zapisz w quantity_hints:
  floor_area = area_m2
  perimeter = 4 × sqrt(area_m2)
  wall_area = perimeter × ceiling_height_m
  wet_zone_area = 1.2 (prysznic) lub 1.6 (wanna) lub 2.8 (oba)

W suggested_estimate_items uzyj obliczonych ilosci:
  Podloga: floor_area. Plytki scienne pelna wys: wall_area. Czescciowa: wall_area × 0.6
  Confidence: 85+ gdy masz wymiary, 40-60 gdy szacujesz, <30 gdy brak danych
  unit_price: zawsze null. source: zawsze "ai_suggestion"

MISSING_INFORMATION: wymien czego nie mozna bylo ocenic (np. "Nieznana powierzchnia podlogi")
ASSUMPTIONS: wymien co model zalozyl (np. "Zakladam WC stojace", "Zakladam wysokosc 2.6m")

ZASADY OGOLNE:
- space_type: lazienka, kuchnia, pokoj, korytarz, salon, sypialnia, wc, inne
- confidence: 0-100 ogolna pewnosc analizy
- Preferuj null nad zgadywanie
- warnings: obraz niewyrazny, ciemny, poza zakresem, brak pomieszczenia
- Gdy wiele zdjec — lacze informacje z WSZYSTKICH
- To jest DRAFT — badz kompletny ale zaznaczaj zalozenia`

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
  const t0 = Date.now()
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST')    return err(405, 'method_not_allowed', 'Only POST allowed')

  // Feature flag: AI Engine must be explicitly enabled in environment
  if (process.env.VITE_AI_ENGINE_ENABLED !== 'true') {
    return err(503, 'ai_disabled', 'AI Engine is not enabled in this environment')
  }

  const userId = await verifyRequestAuth(event)
  if (!userId) return err(401, 'unauthorized', 'Valid authentication token required.')
  // AI MVP requires real Supabase auth — 'dev' fallback (no Supabase configured) is not permitted
  if (userId === 'dev') return err(503, 'auth_not_configured', 'AI Engine requires Supabase authentication')
  if (isRateLimited(userId)) return err(429, 'too_many_requests', 'Za dużo żądań. Spróbuj za chwilę.')

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return err(503, 'ai_not_configured', 'OPENAI_API_KEY is not set')

  // Service role required upfront — used for access check, plan check, and persist
  const sbUrl         = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const sbServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !sbServiceRole) return err(503, 'supabase_not_configured', 'Supabase service role not configured')

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return err(400, 'invalid_json', 'Request body must be valid JSON')
  }

  // ── Required: project context ─────────────────────────────────────────────
  const projectId = typeof body.project_id === 'string' && body.project_id.trim()
    ? body.project_id.trim() : null
  if (!projectId) return err(400, 'missing_project_id', 'project_id is required')

  const textDescription = typeof body.text_description === 'string'
    ? body.text_description.slice(0, 2000) : undefined
  const dimensionsJson  = (body.dimensions && typeof body.dimensions === 'object' && !Array.isArray(body.dimensions))
    ? body.dimensions as Record<string, unknown> : undefined
  const operatorNotes   = typeof body.notes === 'string' ? body.notes.slice(0, 1000) : undefined

  const imageBase64 = body.image_base64 as string | undefined
  const imageType   = String(body.image_type ?? 'image/jpeg')
  const context     = (body.context as string | undefined)?.slice(0, 500)

  // Multi-photo support: body.images = [{base64, type}, ...]
  const rawImages = Array.isArray(body.images) ? body.images as Array<{base64?: string; type?: string}> : []
  const multiImages = rawImages
    .filter(img => typeof img.base64 === 'string' && img.base64.length > 0)
    .slice(0, 5) // P0 max 5 images

  // Sprint 3 dual flow:
  //   images:{base64,type} — fed directly to OpenAI vision API for inference
  //   image_references    — storage paths uploaded to ai-inputs bucket; persisted to
  //                         ai_input_assets for the mandatory Sprint 3 audit trail.
  //   The backend does NOT analyse storage objects directly — base64 is still required.
  interface ImageRef { storage_path: string; original_filename: string; mime_type: string; file_size: number }
  const rawRefs = Array.isArray(body.image_references) ? body.image_references as Array<Record<string, unknown>> : []
  const imageRefs: ImageRef[] = rawRefs
    .filter(r => typeof r.storage_path === 'string' && r.storage_path.length > 0)
    .map(r => ({
      storage_path:      String(r.storage_path).slice(0, 500),
      original_filename: typeof r.original_filename === 'string' ? r.original_filename.slice(0, 255) : 'photo',
      mime_type:         typeof r.mime_type === 'string' ? r.mime_type.slice(0, 100) : 'image/jpeg',
      file_size:         typeof r.file_size === 'number' ? Math.max(0, Math.floor(r.file_size)) : 0,
    }))
    .slice(0, 5) // P0 max 5 images

  // Clarification data from guided form
  const clarification = (body.clarification ?? null) as Record<string, unknown> | null

  // P0 scope: room_type is always restricted to bathroom | wc — no legacy fallback
  const rawRoomType = typeof body.room_type === 'string' ? body.room_type.trim() : ''
  if (!rawRoomType) return err(400, 'missing_room_type', 'room_type is required')
  if (!['bathroom', 'wc'].includes(rawRoomType)) {
    return err(400, 'invalid_room_type', 'AI MVP scope is limited to bathroom and wc room types')
  }
  const roomType = rawRoomType as 'bathroom' | 'wc'

  // Need at least one image (from multi-photo or legacy single-photo)
  if (multiImages.length === 0 && !imageBase64) return err(400, 'missing_image', 'image_base64 is required')

  const isValidMime = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i.test(imageType)
  if (!isValidMime && multiImages.length === 0) return err(400, 'invalid_image_type', `Unsupported image type: ${imageType}`)

  const model = process.env.OPENAI_MODEL_VISION?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4o'
  const imageCount = multiImages.length || 1

  // ── Verify project access and resolve authoritative company_id ───────────
  // Two queries with service role — no PostgREST join, no FK assumption.
  // Step 1: get project's owning company (also confirms project exists)
  // Step 2: confirm user is a member of that company
  // company_id is derived from the project record, never from the request payload.
  const sbService = createClient(sbUrl, sbServiceRole, { auth: { persistSession: false } })

  const { data: project, error: projErr } = await sbService
    .from('projects')
    .select('company_id')
    .eq('id', projectId)
    .maybeSingle()

  if (projErr) {
    console.error('[analyze-room-photo] Project lookup failed:', projErr.message)
    return err(500, 'access_check_failed', 'Could not verify project access')
  }
  if (!project || !(project as { company_id?: string }).company_id) {
    return err(403, 'project_access_denied', 'Project not found or access denied')
  }

  const companyId = (project as { company_id: string }).company_id

  const { data: member, error: memberErr } = await sbService
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberErr) {
    console.error('[analyze-room-photo] Member lookup failed:', memberErr.message)
    return err(500, 'access_check_failed', 'Could not verify project access')
  }
  if (!member) {
    return err(403, 'project_access_denied', 'Project not found or access denied')
  }

  // ── Plan check: AI Engine requires Pro or Business tier ───────────────────
  const { data: company, error: planErr } = await sbService
    .from('companies')
    .select('plan')
    .eq('id', companyId)
    .single()

  if (planErr || !company) {
    console.error('[analyze-room-photo] Plan check failed:', planErr?.message)
    return err(500, 'plan_check_failed', 'Could not verify company plan')
  }
  if (!['pro', 'business', 'admin'].includes((company as { plan: string }).plan)) {
    return err(403, 'plan_insufficient', 'AI Engine requires a Pro or Business plan')
  }

  // ── Daily company limit ─────────────────────────────────────────────────
  const dailyLimit = parseInt(process.env.AI_DAILY_LIMIT ?? '50', 10)
  const { count: todayCount, error: countErr } = await sbService
    .from('ai_analysis_runs')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

  if (!countErr && typeof todayCount === 'number' && todayCount >= dailyLimit) {
    console.warn('[analyze-room-photo] Daily limit exceeded', { companyId, todayCount, dailyLimit })
    return err(429, 'daily_limit_exceeded', `Dzienny limit analiz AI (${dailyLimit}) został wyczerpany. Spróbuj ponownie jutro.`)
  }

  console.info('ROOM_ANALYSIS_START', JSON.stringify({
    endpoint:        'analyze-room-photo',
    companyId:       companyId.slice(0, 8),
    projectId:       projectId?.slice(0, 8) ?? null,
    model, imageType, imageCount,
    hasContext:       !!context,
    hasClarification: !!clarification,
    roomType,
    elapsed_ms:      Date.now() - t0,
  }))

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

  if (roomType) {
    contextText += `\n\nTyp pomieszczenia: ${roomType}`
  }

  if (clarification) {
    const parts: string[] = []
    if (typeof clarification.area_m2 === 'number') parts.push(`Powierzchnia: ${clarification.area_m2} m²`)
    if (typeof clarification.ceiling_height_m === 'number') parts.push(`Wysokość: ${clarification.ceiling_height_m} m`)
    if (typeof clarification.tile_coverage === 'string') parts.push(`Płytki ścienne: ${clarification.tile_coverage === 'full' ? 'pełna wysokość' : clarification.tile_coverage === 'partial' ? 'częściowa' : 'brak'}`)
    if (clarification.has_bathtub) parts.push('Wanna: tak')
    if (clarification.has_shower) parts.push('Prysznic: tak')
    if (clarification.has_underfloor_heating) parts.push('Ogrzewanie podłogowe: tak')
    if (typeof clarification.wc_type === 'string') parts.push(`WC: ${clarification.wc_type === 'concealed' ? 'podtynkowe' : 'stojące (kompakt)'}`)
    if (typeof clarification.sink_count === 'number') parts.push(`Umywalki: ${clarification.sink_count}`)
    if (clarification.has_linear_drain) parts.push('Odpływ liniowy: tak')
    if (typeof clarification.plumbing_scope === 'string') parts.push(`Przeróbki hydrauliczne: ${clarification.plumbing_scope === 'full' ? 'całość' : clarification.plumbing_scope === 'limited' ? 'częściowe' : 'brak'}`)
    if (typeof clarification.electrical_scope === 'string') parts.push(`Przeróbki elektryczne: ${clarification.electrical_scope === 'full' ? 'całość' : clarification.electrical_scope === 'limited' ? 'częściowe' : 'brak'}`)
    if (clarification.has_boiler_casing) parts.push('Zabudowa kotła/bojlera: tak')
    if (typeof clarification.fixtures_standard === 'string') parts.push(`Standard: ${clarification.fixtures_standard}`)
    if (typeof clarification.notes === 'string' && clarification.notes) parts.push(`Uwagi: ${String(clarification.notes).slice(0, 500)}`)

    // Quantity hints from dimensions
    if (typeof clarification.area_m2 === 'number') {
      const area = clarification.area_m2 as number
      const height = typeof clarification.ceiling_height_m === 'number' ? clarification.ceiling_height_m as number : 2.6
      const side = Math.sqrt(area)
      const perimeter = side * 4
      const wallArea = Math.round(perimeter * height * 10) / 10
      parts.push(`\n[ILOŚCI REFERENCYJNE — użyj do quantity w suggested_estimate_items:]`)
      parts.push(`  Podłoga: ${area} m²`)
      parts.push(`  Obwód (szacunkowy): ${Math.round(perimeter * 10) / 10} mb`)
      parts.push(`  Ściany łącznie: ~${wallArea} m²`)
      const tileCov = clarification.tile_coverage
      if (tileCov === 'full') {
        parts.push(`  Płytki ścienne: ~${wallArea} m²`)
      } else if (tileCov === 'partial') {
        parts.push(`  Płytki ścienne: ~${Math.round(wallArea * 0.6 * 10) / 10} m²`)
        parts.push(`  Malowanie ścian: ~${Math.round(wallArea * 0.4 * 10) / 10} m²`)
      } else if (tileCov === 'none') {
        parts.push(`  Malowanie ścian: ~${wallArea} m²`)
      }
    }

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

  function toElement(raw: Record<string, unknown>): DetectedElement | null {
    const label = String(raw.label ?? '')
    if (!label) return null
    const validTypes = new Set(['fixture', 'surface', 'installation', 'damage', 'appliance', 'furniture', 'other'])
    return {
      type:       (validTypes.has(String(raw.type)) ? String(raw.type) : 'other') as DetectedElement['type'],
      label,
      confidence: typeof raw.confidence === 'number' ? Math.min(100, Math.max(0, raw.confidence)) : 50,
      location:   typeof raw.location === 'string' ? raw.location : null,
      notes:      typeof raw.notes === 'string' ? raw.notes : null,
    }
  }

  function toScopeItem(raw: Record<string, unknown>, fallbackPriority: ScopeItem['priority']): ScopeItem | null {
    const description = String(raw.description ?? '')
    if (!description) return null
    const validPriorities = new Set(['required', 'likely', 'optional'])
    return {
      library_id:   typeof raw.library_id === 'string' ? raw.library_id : null,
      description,
      category:     String(raw.category ?? 'finishing'),
      unit:         typeof raw.unit === 'string' ? raw.unit : null,
      quantity:     typeof raw.quantity === 'number' ? raw.quantity : null,
      priority:     (validPriorities.has(String(raw.priority)) ? String(raw.priority) : fallbackPriority) as ScopeItem['priority'],
      confidence:   typeof raw.confidence === 'number' ? Math.min(100, Math.max(0, raw.confidence)) : 50,
      notes:        typeof raw.notes === 'string' ? raw.notes : null,
      dependencies: Array.isArray(raw.dependencies) ? (raw.dependencies as unknown[]).map(String) : [],
    }
  }

  const rawObserved    = Array.isArray(ai.observed_elements)      ? ai.observed_elements      : []
  const rawInstalls    = Array.isArray(ai.detected_installations)  ? ai.detected_installations  : []
  const rawMaterials   = Array.isArray(ai.detected_materials)      ? ai.detected_materials      : []
  const rawRequired    = Array.isArray(ai.required_work_scope)     ? ai.required_work_scope     : []
  const rawLikely      = Array.isArray(ai.likely_work_scope)       ? ai.likely_work_scope       : []
  const rawOptional    = Array.isArray(ai.optional_work_scope)     ? ai.optional_work_scope     : []
  const rawEstimate    = Array.isArray(ai.suggested_estimate_items) ? ai.suggested_estimate_items : []
  const rawQtyHints    = Array.isArray(ai.quantity_hints)          ? ai.quantity_hints          : []

  const observedElements: DetectedElement[] = rawObserved
    .map((e: Record<string, unknown>) => toElement(e)).filter((x): x is DetectedElement => x !== null)
  const detectedInstallations: DetectedElement[] = rawInstalls
    .map((e: Record<string, unknown>) => toElement(e)).filter((x): x is DetectedElement => x !== null)

  const detectedMaterials: DetectedMaterial[] = rawMaterials
    .map((m: Record<string, unknown>) => {
      const name = String(m.name ?? '')
      if (!name) return null
      return {
        name,
        category:   String(m.category ?? 'inne'),
        quantity:   typeof m.quantity === 'number' ? m.quantity : null,
        unit:       typeof m.unit === 'string' ? m.unit : null,
        confidence: typeof m.confidence === 'number' ? Math.min(100, Math.max(0, m.confidence)) : 50,
        notes:      typeof m.notes === 'string' ? m.notes : null,
      } satisfies DetectedMaterial
    })
    .filter((x): x is DetectedMaterial => x !== null)

  const requiredScope: ScopeItem[]  = rawRequired.map((s: Record<string, unknown>) => toScopeItem(s, 'required')).filter((x): x is ScopeItem => x !== null)
  const likelyScope: ScopeItem[]    = rawLikely.map((s: Record<string, unknown>) => toScopeItem(s, 'likely')).filter((x): x is ScopeItem => x !== null)
  const optionalScope: ScopeItem[]  = rawOptional.map((s: Record<string, unknown>) => toScopeItem(s, 'optional')).filter((x): x is ScopeItem => x !== null)

  const VALID_SOURCES = new Set(['ai_suggestion', 'market_data', 'historical'])
  const VALID_DIMS    = new Set(['floor_area', 'wall_area', 'ceiling_area', 'perimeter', 'wet_zone_area', 'other'])
  const VALID_HINT_SOURCES = new Set(['measured', 'estimated', 'user_input', 'ai_inferred', 'unknown'])

  const estimateItems: SuggestedEstimateItem[] = rawEstimate
    .map((e: Record<string, unknown>) => {
      const name = String(e.name ?? '')
      if (!name) return null
      return {
        library_id: typeof e.library_id === 'string' ? e.library_id : null,
        name,
        unit:       String(e.unit ?? 'szt.'),
        quantity:   typeof e.quantity === 'number' ? Math.max(0, e.quantity) : 0,
        unit_price: typeof e.unit_price === 'number' ? e.unit_price : null,
        confidence: typeof e.confidence === 'number' ? Math.min(100, Math.max(0, e.confidence)) : 30,
        source:     (VALID_SOURCES.has(String(e.source)) ? String(e.source) : 'ai_suggestion') as SuggestedEstimateItem['source'],
        notes:      typeof e.notes === 'string' ? e.notes : null,
      } satisfies SuggestedEstimateItem
    })
    .filter((x): x is SuggestedEstimateItem => x !== null)

  const quantityHints: QuantityHint[] = rawQtyHints
    .map((h: Record<string, unknown>) => ({
      dimension:  (VALID_DIMS.has(String(h.dimension)) ? String(h.dimension) : 'other') as QuantityHint['dimension'],
      value:      typeof h.value === 'number' ? h.value : null,
      unit:       String(h.unit ?? 'm²'),
      source:     (VALID_HINT_SOURCES.has(String(h.source)) ? String(h.source) : 'unknown') as QuantityHint['source'],
      confidence: typeof h.confidence === 'number' ? Math.min(100, Math.max(0, h.confidence)) : 40,
    }))

  const confidence = typeof ai.confidence === 'number'
    ? Math.min(100, Math.max(0, ai.confidence)) : 30

  const warnings = Array.isArray(ai.warnings) ? (ai.warnings as unknown[]).map(String) : []

  const validStages = new Set(['before_renovation', 'demolition', 'shell', 'in_progress', 'finishing', 'after_renovation', 'unknown'])
  const stageOfWork: StageOfWork = (validStages.has(String(ai.stage_of_work)) ? String(ai.stage_of_work) : 'unknown') as StageOfWork

  const aiCoverage = ai.coverage
  const coverage = (aiCoverage && typeof aiCoverage === 'object' && !Array.isArray(aiCoverage))
    ? {
        total:     typeof (aiCoverage as Record<string, unknown>).total === 'number' ? (aiCoverage as Record<string, unknown>).total as number : 0,
        matched:   typeof (aiCoverage as Record<string, unknown>).matched === 'number' ? (aiCoverage as Record<string, unknown>).matched as number : 0,
        unmatched: typeof (aiCoverage as Record<string, unknown>).unmatched === 'number' ? (aiCoverage as Record<string, unknown>).unmatched as number : 0,
      }
    : null

  if (observedElements.length === 0 && detectedMaterials.length === 0 && requiredScope.length === 0) {
    warnings.push('Nie wykryto elementow ani zakresu prac — zdjecie moze nie przedstawiac pomieszczenia.')
  }

  const result: RoomAnalysisResult = {
    space_type:              typeof ai.space_type === 'string' ? ai.space_type : null,
    stage_of_work:           stageOfWork,
    observed_elements:       observedElements,
    detected_installations:  detectedInstallations,
    detected_materials:      detectedMaterials,
    required_work_scope:     requiredScope,
    likely_work_scope:       likelyScope,
    optional_work_scope:     optionalScope,
    missing_information:     Array.isArray(ai.missing_information) ? (ai.missing_information as unknown[]).map(String) : [],
    assumptions:             Array.isArray(ai.assumptions) ? (ai.assumptions as unknown[]).map(String) : [],
    quantity_hints:          quantityHints,
    suggested_estimate_items: estimateItems,
    coverage,
    warnings,
    confidence,
    notes: typeof ai.notes === 'string' ? ai.notes : null,
  }

  // ── Bathroom Dependency Engine — post-processing ─────────────────────────
  // Runs after AI normalises its response. Injects preceding/hidden/conditional
  // tasks that AI consistently under-generates. No src/ import needed.
  if (isBathroomSpace(result.space_type)) {
    const allLabels = [
      ...result.observed_elements.map(e => e.label),
      ...result.detected_installations.map(e => e.label),
    ]
    const triggerIds = detectBathroomTriggers(allLabels, clarification)
    if (triggerIds.length > 0) {
      const existingIds = new Set(
        [
          ...result.required_work_scope,
          ...result.likely_work_scope,
          ...result.optional_work_scope,
        ]
          .map(s => s.library_id ?? '')
          .filter(Boolean)
      )
      const expanded = expandDependencies(triggerIds, existingIds)

      // Inject preceding as 'required' items
      for (const item of expanded.preceding) {
        existingIds.add(item.library_id)
        result.required_work_scope.push(item)
      }
      // Inject hidden as 'likely' items
      for (const item of expanded.hidden) {
        existingIds.add(item.library_id)
        result.likely_work_scope.push(item)
      }
      // Inject conditional as 'optional' items
      for (const item of expanded.conditional) {
        existingIds.add(item.library_id)
        result.optional_work_scope.push(item)
      }

      // Mirror inferred items into suggested_estimate_items (no price, quantity=0)
      const existingEstimateIds = new Set(
        result.suggested_estimate_items.map(e => e.library_id ?? '').filter(Boolean)
      )
      for (const item of [...expanded.preceding, ...expanded.hidden]) {
        if (!existingEstimateIds.has(item.library_id)) {
          existingEstimateIds.add(item.library_id)
          result.suggested_estimate_items.push({
            library_id: item.library_id,
            name:       item.description,
            unit:       item.unit,
            quantity:   0,
            unit_price: null,
            confidence: item.confidence,
            source:     'dependency_inferred',
            provenance: 'dependency_inferred',
            notes:      item.notes ?? null,
          })
        }
      }
      for (const item of expanded.conditional) {
        if (!existingEstimateIds.has(item.library_id)) {
          existingEstimateIds.add(item.library_id)
          result.suggested_estimate_items.push({
            library_id: item.library_id,
            name:       item.description,
            unit:       item.unit,
            quantity:   0,
            unit_price: null,
            confidence: item.confidence,
            source:     'confirmation_needed',
            provenance: 'confirmation_needed',
            notes:      item.notes ?? null,
          })
        }
      }

      // Surface confirmation questions (backward compat: text → missing_information)
      for (const q of expanded.questions) {
        if (!result.missing_information.includes(q.text)) {
          result.missing_information.push(q.text)
        }
      }
      // Structured questions channel
      if (!result.clarification_questions) result.clarification_questions = []
      const existingQIds = new Set(result.clarification_questions.map(cq => cq.id))
      for (const q of expanded.questions) {
        if (!existingQIds.has(q.id)) {
          existingQIds.add(q.id)
          result.clarification_questions.push(q)
        }
      }
    }
  }
  // ── End bathroom dependency injection ─────────────────────────────────────

  console.info('ROOM_ANALYSIS_DONE', JSON.stringify({
    endpoint:       'analyze-room-photo',
    companyId:      companyId.slice(0, 8),
    projectId:      projectId?.slice(0, 8) ?? null,
    model,
    imageCount,
    spaceType:      result.space_type,
    stageOfWork:    result.stage_of_work,
    observedElements: result.observed_elements.length,
    materials:      result.detected_materials.length,
    required:       result.required_work_scope.length,
    likely:         result.likely_work_scope.length,
    optional:       result.optional_work_scope.length,
    estimateItems:  result.suggested_estimate_items.length,
    confidence:     result.confidence,
    warnings:       result.warnings.length,
    total_ms:       Date.now() - t0,
  }))

  // ── Persist analysis bundle — REQUIRED for auditability ──────────────────
  // Must succeed. If persist fails, the endpoint does NOT return a success response.
  const persistResult = await persistAnalysisBundle({
    sb:             sbService,
    userId,
    companyId,
    projectId,
    roomType,
    textDescription,
    clarification:  clarification ?? undefined,
    dimensionsJson,
    notes:          operatorNotes,
    modelName:      model,
    imageRefs:      imageRefs.length > 0 ? imageRefs : undefined,
    result,
  })

  if (!persistResult.ok) {
    console.error('[analyze-room-photo] Persist failed — withholding success response:', persistResult.error)
    return err(500, 'persist_failed', 'Analysis completed but could not be saved. Please retry.')
  }

  return okWithRunId(result, persistResult.run_id)
}
