// =============================================================================
// Bathroom Task Library v2 — domain-specific positions for bathroom renovation
// =============================================================================
// Construction-domain knowledge base for Polish bathroom renovation projects.
// Used by Bathroom Scope Engine to match AI vision output against real trade tasks.
// v2: added task dependencies, quantity hints, scope group for coverage engine.

export type TaskPriority = 'required' | 'likely' | 'conditional' | 'optional'

/** Scope matching group for coverage engine */
export type ScopeGroup = 'required' | 'likely' | 'confirmation_needed' | 'optional'

export interface BathroomTask {
  id: string
  name: string                    // Polish, user-facing
  category: string                // group key
  unit: string                    // default unit: m², mb, szt., kpl., ryczałt
  priority: TaskPriority          // how often this task appears in a typical bathroom reno
  when: string                    // short condition description (Polish)
  dependsOn?: string[]            // task IDs that must be present when this task is included
  scopeGroup: ScopeGroup          // coverage engine grouping
  estimateDefault?: {
    qtyFormula?: string           // hint for qty calculation, e.g. 'floor_area', 'wall_area', 'count'
    vatRate: number               // default VAT for this task type
  }
}

export interface TaskCategory {
  id: string
  name: string                    // Polish
  icon: string
  sortOrder: number
}

// ── Categories ──────────────────────────────────────────────────────────────

export const BATHROOM_CATEGORIES: TaskCategory[] = [
  { id: 'demolition',    name: 'Demontaż i przygotowanie',       icon: '🔨', sortOrder: 1 },
  { id: 'substrate',     name: 'Przygotowanie podłoża',          icon: '🧹', sortOrder: 2 },
  { id: 'waterproofing', name: 'Hydroizolacja',                  icon: '💧', sortOrder: 3 },
  { id: 'drywall',       name: 'Zabudowy GK / obudowy / rewizje', icon: '📐', sortOrder: 4 },
  { id: 'plumbing',      name: 'Instalacja wod-kan',              icon: '🚿', sortOrder: 5 },
  { id: 'electrical',    name: 'Instalacja elektryczna',           icon: '⚡', sortOrder: 6 },
  { id: 'wall_tiling',   name: 'Okładziny ścienne',               icon: '🧱', sortOrder: 7 },
  { id: 'floor_tiling',  name: 'Okładziny podłogowe',             icon: '🪨', sortOrder: 8 },
  { id: 'painting',      name: 'Malowanie / tynki dekoracyjne',   icon: '🎨', sortOrder: 9 },
  { id: 'fixtures',      name: 'Biały montaż',                    icon: '🚽', sortOrder: 10 },
  { id: 'fittings',      name: 'Armatura',                        icon: '🔩', sortOrder: 11 },
  { id: 'accessories',   name: 'Akcesoria i wykończenie',         icon: '✨', sortOrder: 12 },
  { id: 'sealing',       name: 'Uszczelnienia i odbiór',          icon: '🧴', sortOrder: 13 },
]

// ── Task Library ────────────────────────────────────────────────────────────

export const BATHROOM_TASKS: BathroomTask[] = [
  // ── Demontaż i przygotowanie ──
  { id: 'measure_inventory',   name: 'Pomiar / inwentaryzacja / trasowanie',         category: 'demolition', unit: 'kpl.',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze na początku remontu' },
  { id: 'demo_tiles_wall',     name: 'Demontaż starych płytek ściennych',           category: 'demolition', unit: 'm²',     priority: 'likely',      scopeGroup: 'likely',              when: 'Płytki ścienne do wymiany' },
  { id: 'demo_tiles_floor',    name: 'Demontaż starych płytek podłogowych',         category: 'demolition', unit: 'm²',     priority: 'likely',      scopeGroup: 'likely',              when: 'Płytki podłogowe do wymiany' },
  { id: 'demo_fixtures',       name: 'Demontaż starej ceramiki i armatury',         category: 'demolition', unit: 'kpl.',   priority: 'likely',      scopeGroup: 'likely',              when: 'Wymiana białego montażu' },
  { id: 'demo_bathtub',        name: 'Demontaż wanny / brodzika',                   category: 'demolition', unit: 'szt.',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Zmiana wanny na prysznic lub wymiana' },
  { id: 'demo_drywall',        name: 'Demontaż starych zabudów GK',                 category: 'demolition', unit: 'm²',     priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Stare zabudowy do wymiany' },
  { id: 'debris_removal',      name: 'Wywóz gruzu i odpadów',                       category: 'demolition', unit: 'kpl.',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy demontażu' },

  // ── Przygotowanie podłoża ──
  { id: 'substrate_leveling',  name: 'Wyrównanie podłoża (wylewka / szlichta)',       category: 'substrate', unit: 'm²',     priority: 'likely',      scopeGroup: 'likely',              when: 'Nierówne podłoże po demontażu', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'substrate_priming',   name: 'Gruntowanie podłoża pod płytki',               category: 'substrate', unit: 'm²',     priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przed układaniem płytek', estimateDefault: { qtyFormula: 'total_tile_area', vatRate: 8 } },
  { id: 'substrate_wall_priming', name: 'Gruntowanie ścian pod płytki / malowanie',    category: 'substrate', unit: 'm²',     priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przed układaniem płytek ściennych lub malowaniem', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'substrate_plastering', name: 'Tynkowanie / wyrównanie ścian',                category: 'substrate', unit: 'm²',     priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Ściany wymagają wyrównania' },

  // ── Hydroizolacja ──
  { id: 'waterproof_wet',      name: 'Hydroizolacja stref mokrych (prysznic, wanna)', category: 'waterproofing', unit: 'm²', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze w strefach mokrych', dependsOn: ['tile_floor'],                 estimateDefault: { qtyFormula: 'wet_zone_area', vatRate: 8 } },
  { id: 'waterproof_floor',    name: 'Hydroizolacja podłogi łazienki',               category: 'waterproofing', unit: 'm²', priority: 'required',    scopeGroup: 'required',            when: 'Zawsze na podłodze łazienki', dependsOn: ['tile_floor'],               estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'waterproof_tape',     name: 'Taśmy uszczelniające (narożniki, przejścia)',  category: 'waterproofing', unit: 'mb',  priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy hydroizolacji', dependsOn: ['waterproof_wet'],             estimateDefault: { vatRate: 8 } },
  { id: 'waterproof_collar',   name: 'Kołnierze uszczelniające (odpływ, rury)',      category: 'waterproofing', unit: 'szt.', priority: 'required',  scopeGroup: 'required',            when: 'Przy przejściach instalacyjnych', dependsOn: ['waterproof_floor'] },

  // ── Zabudowy GK ──
  { id: 'gk_pipe_casing',     name: 'Zabudowa pionów instalacyjnych (GK)',           category: 'drywall', unit: 'mb',       priority: 'likely',      scopeGroup: 'likely',              when: 'Widoczne piony kanalizacyjne / wodne' },
  { id: 'gk_inspection',      name: 'Rewizja serwisowa (drzwiczki)',                 category: 'drywall', unit: 'szt.',     priority: 'likely',      scopeGroup: 'likely',              when: 'Przy zabudowie pionów / instalacji', dependsOn: ['gk_pipe_casing'] },
  { id: 'gk_wc_frame',        name: 'Zabudowa stelaża WC podtynkowego',             category: 'drywall', unit: 'kpl.',     priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'WC podtynkowe', dependsOn: ['fix_wc_concealed'] },
  { id: 'gk_niche',           name: 'Wykonanie wnęki / półki z GK',                 category: 'drywall', unit: 'szt.',     priority: 'optional',    scopeGroup: 'optional',            when: 'Wnęka na kosmetyki / półka' },
  { id: 'gk_ceiling',         name: 'Sufit podwieszany GK',                          category: 'drywall', unit: 'm²',      priority: 'optional',    scopeGroup: 'optional',            when: 'Ukrycie instalacji / oświetlenie punktowe' },
  { id: 'gk_boiler_casing',   name: 'Obudowa kotła / bojlera',                       category: 'drywall', unit: 'kpl.',    priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Kocioł / bojler w łazience' },

  // ── Instalacja wod-kan ──
  { id: 'plumb_points',       name: 'Przeróbka punktów wod-kan',                     category: 'plumbing', unit: 'szt.',    priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Zmiana rozkładu urządzeń sanitarnych' },
  { id: 'plumb_shower_drain', name: 'Montaż odpływu liniowego / brodzika',           category: 'plumbing', unit: 'szt.',    priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Prysznic z odpływem liniowym' },
  { id: 'plumb_bathtub',      name: 'Podłączenie wanny',                             category: 'plumbing', unit: 'szt.',    priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Wanna w projekcie', dependsOn: ['fix_bathtub'] },
  { id: 'plumb_mixing_valve', name: 'Montaż baterii podtynkowej',                    category: 'plumbing', unit: 'szt.',    priority: 'optional',    scopeGroup: 'optional',            when: 'Bateria podtynkowa w projekcie' },
  { id: 'plumb_radiator',     name: 'Montaż grzejnika łazienkowego / drabinki',      category: 'plumbing', unit: 'szt.',    priority: 'likely',      scopeGroup: 'likely',              when: 'Grzejnik łazienkowy w projekcie' },

  // ── Instalacja elektryczna ──
  { id: 'elec_points',        name: 'Przeróbka punktów elektrycznych',                category: 'electrical', unit: 'szt.',  priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Zmiana rozkładu gniazdek / oświetlenia' },
  { id: 'elec_lighting',      name: 'Montaż oświetlenia (LED, halogeny)',            category: 'electrical', unit: 'szt.',  priority: 'likely',      scopeGroup: 'likely',              when: 'Nowe oświetlenie w łazience' },
  { id: 'elec_mirror_light',  name: 'Podłączenie oświetlenia lustra',                category: 'electrical', unit: 'szt.',  priority: 'optional',    scopeGroup: 'optional',            when: 'Lustro z oświetleniem', dependsOn: ['acc_mirror'] },
  { id: 'elec_underfloor',    name: 'Mata grzewcza podłogowa (elektryczna)',          category: 'electrical', unit: 'm²',   priority: 'optional',    scopeGroup: 'optional',            when: 'Ogrzewanie podłogowe elektryczne', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'elec_fan',           name: 'Montaż wentylatora łazienkowego',               category: 'electrical', unit: 'szt.',  priority: 'likely',      scopeGroup: 'likely',              when: 'Łazienka bez okna lub z wentylacją mechaniczną' },

  // ── Okładziny ścienne ──
  { id: 'tile_wall_full',     name: 'Układanie płytek ściennych (pełna wysokość)',    category: 'wall_tiling', unit: 'm²',   priority: 'likely',      scopeGroup: 'likely',              when: 'Płytki do sufitu', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'tile_wall_partial',  name: 'Układanie płytek ściennych (częściowa wys.)',    category: 'wall_tiling', unit: 'm²',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Płytki do pewnej wysokości' },
  { id: 'tile_wall_trim',     name: 'Obróbki, docinki, listwy narożnikowe',          category: 'wall_tiling', unit: 'mb',   priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy płytkach', dependsOn: ['tile_wall_full', 'tile_wall_partial'], estimateDefault: { vatRate: 8 } },
  { id: 'tile_wall_grouting', name: 'Fugowanie płytek ściennych',                     category: 'wall_tiling', unit: 'm²',  priority: 'required',    scopeGroup: 'required',            when: 'Zawsze po ułożeniu płytek', dependsOn: ['tile_wall_full', 'tile_wall_partial'], estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'tile_mosaic',        name: 'Układanie mozaiki / dekorów',                    category: 'wall_tiling', unit: 'm²',   priority: 'optional',    scopeGroup: 'optional',            when: 'Dekor / mozaika w projekcie' },
  { id: 'tile_window_sill',   name: 'Obróbka okna (glif, parapet z płytek)',          category: 'wall_tiling', unit: 'mb',   priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Okno w łazience' },

  // ── Okładziny podłogowe ──
  { id: 'tile_floor',         name: 'Układanie płytek podłogowych',                   category: 'floor_tiling', unit: 'm²',  priority: 'required',    scopeGroup: 'required',            when: 'Zawsze w łazience', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'tile_floor_grouting', name: 'Fugowanie płytek podłogowych',                  category: 'floor_tiling', unit: 'm²',  priority: 'required',    scopeGroup: 'required',            when: 'Zawsze po ułożeniu płytek', dependsOn: ['tile_floor'], estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'tile_floor_trim',    name: 'Cokoły / listwy przypodłogowe z płytek',         category: 'floor_tiling', unit: 'mb',  priority: 'optional',    scopeGroup: 'optional',            when: 'Cokół z płytek zamiast listwy' },
  { id: 'tile_threshold',     name: 'Próg / listwa progowa',                          category: 'floor_tiling', unit: 'szt.', priority: 'likely',     scopeGroup: 'likely',              when: 'Przejście między pomieszczeniami' },

  // ── Malowanie ──
  { id: 'paint_ceiling',      name: 'Malowanie sufitu (farba łazienkowa)',            category: 'painting', unit: 'm²',      priority: 'likely',      scopeGroup: 'likely',              when: 'Sufit nie pokryty płytkami', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'paint_walls',        name: 'Malowanie ścian (strefy bez płytek)',             category: 'painting', unit: 'm²',     priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Ściany częściowo bez płytek' },

  // ── Biały montaż ──
  { id: 'fix_wc',             name: 'Montaż miski WC',                                category: 'fixtures', unit: 'szt.',    priority: 'required',    scopeGroup: 'required',            when: 'Zawsze w łazience' },
  { id: 'fix_wc_concealed',   name: 'Montaż WC podtynkowego (z przyciskiem)',         category: 'fixtures', unit: 'kpl.',    priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'WC podtynkowe', dependsOn: ['gk_wc_frame'] },
  { id: 'fix_basin',          name: 'Montaż umywalki',                                category: 'fixtures', unit: 'szt.',    priority: 'required',    scopeGroup: 'required',            when: 'Zawsze w łazience' },
  { id: 'fix_double_basin',   name: 'Montaż umywalki podwójnej',                      category: 'fixtures', unit: 'szt.',    priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Dwie umywalki w projekcie' },
  { id: 'fix_shower_cabin',   name: 'Montaż kabiny prysznicowej',                     category: 'fixtures', unit: 'kpl.',    priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Kabina prysznicowa w projekcie' },
  { id: 'fix_bathtub',        name: 'Montaż wanny + obudowa',                         category: 'fixtures', unit: 'kpl.',    priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Wanna w projekcie' },
  { id: 'fix_bidet',          name: 'Montaż bidetu',                                  category: 'fixtures', unit: 'szt.',    priority: 'optional',    scopeGroup: 'optional',            when: 'Bidet w projekcie' },

  // ── Armatura ──
  { id: 'fit_basin_tap',      name: 'Montaż baterii umywalkowej',                     category: 'fittings', unit: 'szt.',    priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy umywalce', dependsOn: ['fix_basin'] },
  { id: 'fit_shower_set',     name: 'Montaż zestawu prysznicowego',                   category: 'fittings', unit: 'kpl.',    priority: 'likely',      scopeGroup: 'likely',              when: 'Prysznic w projekcie' },
  { id: 'fit_bathtub_tap',    name: 'Montaż baterii wannowej',                        category: 'fittings', unit: 'szt.',    priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Wanna w projekcie', dependsOn: ['fix_bathtub'] },
  { id: 'fit_angle_valves',   name: 'Montaż zaworów kątowych',                        category: 'fittings', unit: 'szt.',    priority: 'required',    scopeGroup: 'required',            when: 'Zawsze przy urządzeniach sanitarnych' },

  // ── Akcesoria i wykończenie ──
  { id: 'acc_mirror',         name: 'Montaż lustra',                                  category: 'accessories', unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Standardowe wyposażenie' },
  { id: 'acc_towel_rail',     name: 'Montaż wieszaka na ręczniki / grzejnika',        category: 'accessories', unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Wieszak lub grzejnik łazienkowy' },
  { id: 'acc_shelf',          name: 'Montaż półek / organizerów',                     category: 'accessories', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Dodatkowe przechowywanie' },
  { id: 'acc_toilet_paper',   name: 'Montaż uchwytu na papier',                       category: 'accessories', unit: 'szt.', priority: 'likely',      scopeGroup: 'likely',              when: 'Standardowe wyposażenie' },
  { id: 'acc_soap_dish',      name: 'Montaż dozownika / mydelniczki',                 category: 'accessories', unit: 'szt.', priority: 'optional',    scopeGroup: 'optional',            when: 'Dodatkowe akcesoria' },
  { id: 'acc_glass_partition', name: 'Montaż szyby / ścianki prysznicowej walk-in',   category: 'accessories', unit: 'szt.', priority: 'conditional', scopeGroup: 'confirmation_needed', when: 'Prysznic walk-in' },

  // ── Uszczelnienia i odbiór ──
  { id: 'seal_silicone',      name: 'Silikonowanie (wanna, brodzik, umywalka, WC)',   category: 'sealing', unit: 'mb',       priority: 'required',    scopeGroup: 'required',            when: 'Zawsze na styku ceramiki', estimateDefault: { vatRate: 8 } },
  { id: 'seal_acrylic',       name: 'Uszczelnienie akrylowe (narożniki, przejścia)',  category: 'sealing', unit: 'mb',       priority: 'likely',      scopeGroup: 'likely',              when: 'Na nieregularnych stykach' },
  { id: 'seal_cleanup',       name: 'Sprzątanie powykonawcze',                        category: 'sealing', unit: 'kpl.',     priority: 'required',    scopeGroup: 'required',            when: 'Zawsze na koniec' },
  { id: 'seal_inspection',    name: 'Odbiór techniczny / próba szczelności',          category: 'sealing', unit: 'kpl.',     priority: 'optional',    scopeGroup: 'optional',            when: 'Na życzenie klienta lub przy odbiorze' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getTasksByCategory(categoryId: string): BathroomTask[] {
  return BATHROOM_TASKS.filter(t => t.category === categoryId)
}

export function getRequiredTasks(): BathroomTask[] {
  return BATHROOM_TASKS.filter(t => t.priority === 'required')
}

export function getLikelyTasks(): BathroomTask[] {
  return BATHROOM_TASKS.filter(t => t.priority === 'required' || t.priority === 'likely')
}

export function getTaskById(id: string): BathroomTask | undefined {
  return BATHROOM_TASKS.find(t => t.id === id)
}

/** Build the library reference text for AI prompts */
export function buildLibraryPromptBlock(): string {
  const lines: string[] = ['BIBLIOTEKA TYPOWYCH POZYCJI ŁAZIENKOWYCH:']
  for (const cat of BATHROOM_CATEGORIES) {
    const tasks = getTasksByCategory(cat.id)
    if (tasks.length === 0) continue
    lines.push(`\n## ${cat.name}`)
    for (const t of tasks) {
      const prio = t.priority === 'required' ? '[OBOWIĄZKOWA]'
        : t.priority === 'likely' ? '[PRAWDOPODOBNA]'
        : t.priority === 'conditional' ? '[WARUNKOWA]'
        : '[OPCJONALNA]'
      const deps = t.dependsOn?.length ? ` (wymaga: ${t.dependsOn.join(', ')})` : ''
      lines.push(`- ${t.id}: ${t.name} (${t.unit}) ${prio}${deps} — ${t.when}`)
    }
  }
  return lines.join('\n')
}

// ── Coverage Engine ─────────────────────────────────────────────────────────

export interface CoverageResult {
  missingRequired: BathroomTask[]
  missingLikely: BathroomTask[]
  unconfirmed: BathroomTask[]
  brokenDependencies: Array<{ task: BathroomTask; missingDep: string }>
  coveragePercent: number
}

/**
 * Check AI output against library for missing positions.
 * @param presentIds  Set of library task IDs present in AI output
 */
export function checkCoverage(presentIds: Set<string>): CoverageResult {
  const requiredTasks = BATHROOM_TASKS.filter(t => t.scopeGroup === 'required')
  const likelyTasks   = BATHROOM_TASKS.filter(t => t.scopeGroup === 'likely')
  const confirmTasks  = BATHROOM_TASKS.filter(t => t.scopeGroup === 'confirmation_needed')

  const missingRequired = requiredTasks.filter(t => !presentIds.has(t.id))
  const missingLikely   = likelyTasks.filter(t => !presentIds.has(t.id))
  const unconfirmed     = confirmTasks.filter(t => !presentIds.has(t.id))

  // Check broken dependencies: task is present but its dependency is not
  const brokenDependencies: CoverageResult['brokenDependencies'] = []
  for (const id of presentIds) {
    const task = getTaskById(id)
    if (!task?.dependsOn) continue
    for (const depId of task.dependsOn) {
      // dependsOn is OR-style for tile_wall_trim etc. — at least one dep must be present
      // For simplicity: if ALL deps are missing, it's broken
    }
    const allDepsMissing = task.dependsOn.every(d => !presentIds.has(d))
    if (allDepsMissing && task.dependsOn.length > 0) {
      brokenDependencies.push({ task, missingDep: task.dependsOn[0] })
    }
  }

  const totalRequired = requiredTasks.length
  const presentRequired = totalRequired - missingRequired.length
  const coveragePercent = totalRequired > 0 ? Math.round((presentRequired / totalRequired) * 100) : 100

  return { missingRequired, missingLikely, unconfirmed, brokenDependencies, coveragePercent }
}

// ── Quantity Hints ──────────────────────────────────────────────────────────

export interface QuantityHints {
  floor_m2: number | null
  wall_tile_m2: number | null
  paint_m2: number | null
  ceiling_m2: number | null
  perimeter_mb: number | null
}

/**
 * Calculate quantity hints from clarification data.
 * Used both client-side (display) and in AI prompt.
 */
export function calculateQuantityHints(
  area_m2?: number,
  ceiling_height_m?: number,
  tile_coverage?: 'full' | 'partial' | 'none',
): QuantityHints {
  const floor = area_m2 ?? null
  const height = ceiling_height_m ?? 2.6
  // Approximate perimeter from area (assume ~square room for hint)
  const side = floor ? Math.sqrt(floor) : null
  const perimeter = side ? Math.round(side * 4 * 10) / 10 : null

  let wall_tile: number | null = null
  let paint: number | null = null

  if (perimeter && height) {
    const totalWall = perimeter * height
    if (tile_coverage === 'full') {
      wall_tile = Math.round(totalWall * 10) / 10
      paint = null
    } else if (tile_coverage === 'partial') {
      wall_tile = Math.round(totalWall * 0.6 * 10) / 10
      paint = Math.round(totalWall * 0.4 * 10) / 10
    } else if (tile_coverage === 'none') {
      wall_tile = null
      paint = Math.round(totalWall * 10) / 10
    } else {
      // Unknown — give rough estimate
      wall_tile = Math.round(totalWall * 0.7 * 10) / 10
      paint = Math.round(totalWall * 0.3 * 10) / 10
    }
  }

  return {
    floor_m2: floor,
    wall_tile_m2: wall_tile,
    paint_m2: paint,
    ceiling_m2: floor, // ceiling ≈ floor area
    perimeter_mb: perimeter,
  }
}
