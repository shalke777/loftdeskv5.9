// =============================================================================
// Bathroom Task Library — domain-specific positions for bathroom renovation
// =============================================================================
// Construction-domain knowledge base for Polish bathroom renovation projects.
// Used by Bathroom Scope Engine to match AI vision output against real trade tasks.

export type TaskPriority = 'required' | 'likely' | 'conditional' | 'optional'

export interface BathroomTask {
  id: string
  name: string                    // Polish, user-facing
  category: string                // group key
  unit: string                    // default unit: m², mb, szt., kpl., ryczałt
  priority: TaskPriority          // how often this task appears in a typical bathroom reno
  when: string                    // short condition description (Polish)
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
  { id: 'demo_tiles_wall',     name: 'Demontaż starych płytek ściennych',           category: 'demolition', unit: 'm²',     priority: 'likely',      when: 'Płytki ścienne do wymiany' },
  { id: 'demo_tiles_floor',    name: 'Demontaż starych płytek podłogowych',         category: 'demolition', unit: 'm²',     priority: 'likely',      when: 'Płytki podłogowe do wymiany' },
  { id: 'demo_fixtures',       name: 'Demontaż starej ceramiki i armatury',         category: 'demolition', unit: 'kpl.',   priority: 'likely',      when: 'Wymiana białego montażu' },
  { id: 'demo_bathtub',        name: 'Demontaż wanny / brodzika',                   category: 'demolition', unit: 'szt.',   priority: 'conditional', when: 'Zmiana wanny na prysznic lub wymiana' },
  { id: 'demo_drywall',        name: 'Demontaż starych zabudów GK',                 category: 'demolition', unit: 'm²',     priority: 'conditional', when: 'Stare zabudowy do wymiany' },
  { id: 'debris_removal',      name: 'Wywóz gruzu i odpadów',                       category: 'demolition', unit: 'kpl.',   priority: 'required',    when: 'Zawsze przy demontażu' },

  // ── Przygotowanie podłoża ──
  { id: 'substrate_leveling',  name: 'Wyrównanie podłoża (wylewka / szlichta)',       category: 'substrate', unit: 'm²',     priority: 'likely',      when: 'Nierówne podłoże po demontażu', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'substrate_priming',   name: 'Gruntowanie podłoża pod płytki',               category: 'substrate', unit: 'm²',     priority: 'required',    when: 'Zawsze przed układaniem płytek', estimateDefault: { qtyFormula: 'total_tile_area', vatRate: 8 } },
  { id: 'substrate_plastering', name: 'Tynkowanie / wyrównanie ścian',                category: 'substrate', unit: 'm²',     priority: 'conditional', when: 'Ściany wymagają wyrównania' },

  // ── Hydroizolacja ──
  { id: 'waterproof_wet',      name: 'Hydroizolacja stref mokrych (prysznic, wanna)', category: 'waterproofing', unit: 'm²', priority: 'required',    when: 'Zawsze w strefach mokrych', estimateDefault: { qtyFormula: 'wet_zone_area', vatRate: 8 } },
  { id: 'waterproof_floor',    name: 'Hydroizolacja podłogi łazienki',               category: 'waterproofing', unit: 'm²', priority: 'required',    when: 'Zawsze na podłodze łazienki', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'waterproof_tape',     name: 'Taśmy uszczelniające (narożniki, przejścia)',  category: 'waterproofing', unit: 'mb',  priority: 'required',    when: 'Zawsze przy hydroizolacji', estimateDefault: { vatRate: 8 } },
  { id: 'waterproof_collar',   name: 'Kołnierze uszczelniające (odpływ, rury)',      category: 'waterproofing', unit: 'szt.', priority: 'required',  when: 'Przy przejściach instalacyjnych' },

  // ── Zabudowy GK ──
  { id: 'gk_pipe_casing',     name: 'Zabudowa pionów instalacyjnych (GK)',           category: 'drywall', unit: 'mb',       priority: 'likely',      when: 'Widoczne piony kanalizacyjne / wodne' },
  { id: 'gk_inspection',      name: 'Rewizja serwisowa (drzwiczki)',                 category: 'drywall', unit: 'szt.',     priority: 'likely',      when: 'Przy zabudowie pionów / instalacji' },
  { id: 'gk_wc_frame',        name: 'Zabudowa stelaża WC podtynkowego',             category: 'drywall', unit: 'kpl.',     priority: 'conditional', when: 'WC podtynkowe' },
  { id: 'gk_niche',           name: 'Wykonanie wnęki / półki z GK',                 category: 'drywall', unit: 'szt.',     priority: 'optional',    when: 'Wnęka na kosmetyki / półka' },
  { id: 'gk_ceiling',         name: 'Sufit podwieszany GK',                          category: 'drywall', unit: 'm²',      priority: 'optional',    when: 'Ukrycie instalacji / oświetlenie punktowe' },
  { id: 'gk_boiler_casing',   name: 'Obudowa kotła / bojlera',                       category: 'drywall', unit: 'kpl.',    priority: 'conditional', when: 'Kocioł / bojler w łazience' },

  // ── Instalacja wod-kan ──
  { id: 'plumb_points',       name: 'Przeróbka punktów wod-kan',                     category: 'plumbing', unit: 'szt.',    priority: 'conditional', when: 'Zmiana rozkładu urządzeń sanitarnych' },
  { id: 'plumb_shower_drain', name: 'Montaż odpływu liniowego / brodzika',           category: 'plumbing', unit: 'szt.',    priority: 'conditional', when: 'Prysznic z odpływem liniowym' },
  { id: 'plumb_bathtub',      name: 'Podłączenie wanny',                             category: 'plumbing', unit: 'szt.',    priority: 'conditional', when: 'Wanna w projekcie' },
  { id: 'plumb_mixing_valve', name: 'Montaż baterii podtynkowej',                    category: 'plumbing', unit: 'szt.',    priority: 'optional',    when: 'Bateria podtynkowa w projekcie' },

  // ── Instalacja elektryczna ──
  { id: 'elec_points',        name: 'Przeróbka punktów elektrycznych',                category: 'electrical', unit: 'szt.',  priority: 'conditional', when: 'Zmiana rozkładu gniazdek / oświetlenia' },
  { id: 'elec_lighting',      name: 'Montaż oświetlenia (LED, halogeny)',            category: 'electrical', unit: 'szt.',  priority: 'likely',      when: 'Nowe oświetlenie w łazience' },
  { id: 'elec_mirror_light',  name: 'Podłączenie oświetlenia lustra',                category: 'electrical', unit: 'szt.',  priority: 'optional',    when: 'Lustro z oświetleniem' },
  { id: 'elec_underfloor',    name: 'Mata grzewcza podłogowa (elektryczna)',          category: 'electrical', unit: 'm²',   priority: 'optional',    when: 'Ogrzewanie podłogowe elektryczne' },

  // ── Okładziny ścienne ──
  { id: 'tile_wall_full',     name: 'Układanie płytek ściennych (pełna wysokość)',    category: 'wall_tiling', unit: 'm²',   priority: 'likely',      when: 'Płytki do sufitu', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'tile_wall_partial',  name: 'Układanie płytek ściennych (częściowa wys.)',    category: 'wall_tiling', unit: 'm²',   priority: 'conditional', when: 'Płytki do pewnej wysokości' },
  { id: 'tile_wall_trim',     name: 'Obróbki, docinki, listwy narożnikowe',          category: 'wall_tiling', unit: 'mb',   priority: 'required',    when: 'Zawsze przy płytkach', estimateDefault: { vatRate: 8 } },
  { id: 'tile_wall_grouting', name: 'Fugowanie płytek ściennych',                     category: 'wall_tiling', unit: 'm²',  priority: 'required',    when: 'Zawsze po ułożeniu płytek', estimateDefault: { qtyFormula: 'wall_area', vatRate: 8 } },
  { id: 'tile_mosaic',        name: 'Układanie mozaiki / dekorów',                    category: 'wall_tiling', unit: 'm²',   priority: 'optional',    when: 'Dekor / mozaika w projekcie' },
  { id: 'tile_window_sill',   name: 'Obróbka okna (glif, parapet z płytek)',          category: 'wall_tiling', unit: 'mb',   priority: 'conditional', when: 'Okno w łazience' },

  // ── Okładziny podłogowe ──
  { id: 'tile_floor',         name: 'Układanie płytek podłogowych',                   category: 'floor_tiling', unit: 'm²',  priority: 'required',    when: 'Zawsze w łazience', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'tile_floor_grouting', name: 'Fugowanie płytek podłogowych',                  category: 'floor_tiling', unit: 'm²',  priority: 'required',    when: 'Zawsze po ułożeniu płytek', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'tile_floor_trim',    name: 'Cokoły / listwy przypodłogowe z płytek',         category: 'floor_tiling', unit: 'mb',  priority: 'optional',    when: 'Cokół z płytek zamiast listwy' },
  { id: 'tile_threshold',     name: 'Próg / listwa progowa',                          category: 'floor_tiling', unit: 'szt.', priority: 'likely',     when: 'Przejście między pomieszczeniami' },

  // ── Malowanie ──
  { id: 'paint_ceiling',      name: 'Malowanie sufitu (farba łazienkowa)',            category: 'painting', unit: 'm²',      priority: 'likely',      when: 'Sufit nie pokryty płytkami', estimateDefault: { qtyFormula: 'floor_area', vatRate: 8 } },
  { id: 'paint_walls',        name: 'Malowanie ścian (strefy bez płytek)',             category: 'painting', unit: 'm²',     priority: 'conditional', when: 'Ściany częściowo bez płytek' },

  // ── Biały montaż ──
  { id: 'fix_wc',             name: 'Montaż miski WC',                                category: 'fixtures', unit: 'szt.',    priority: 'required',    when: 'Zawsze w łazience' },
  { id: 'fix_wc_concealed',   name: 'Montaż WC podtynkowego (z przyciskiem)',         category: 'fixtures', unit: 'kpl.',    priority: 'conditional', when: 'WC podtynkowe' },
  { id: 'fix_basin',          name: 'Montaż umywalki',                                category: 'fixtures', unit: 'szt.',    priority: 'required',    when: 'Zawsze w łazience' },
  { id: 'fix_shower_cabin',   name: 'Montaż kabiny prysznicowej',                     category: 'fixtures', unit: 'kpl.',    priority: 'conditional', when: 'Kabina prysznicowa w projekcie' },
  { id: 'fix_bathtub',        name: 'Montaż wanny + obudowa',                         category: 'fixtures', unit: 'kpl.',    priority: 'conditional', when: 'Wanna w projekcie' },
  { id: 'fix_bidet',          name: 'Montaż bidetu',                                  category: 'fixtures', unit: 'szt.',    priority: 'optional',    when: 'Bidet w projekcie' },

  // ── Armatura ──
  { id: 'fit_basin_tap',      name: 'Montaż baterii umywalkowej',                     category: 'fittings', unit: 'szt.',    priority: 'required',    when: 'Zawsze przy umywalce' },
  { id: 'fit_shower_set',     name: 'Montaż zestawu prysznicowego',                   category: 'fittings', unit: 'kpl.',    priority: 'likely',      when: 'Prysznic w projekcie' },
  { id: 'fit_bathtub_tap',    name: 'Montaż baterii wannowej',                        category: 'fittings', unit: 'szt.',    priority: 'conditional', when: 'Wanna w projekcie' },
  { id: 'fit_angle_valves',   name: 'Montaż zaworów kątowych',                        category: 'fittings', unit: 'szt.',    priority: 'required',    when: 'Zawsze przy urządzeniach sanitarnych' },

  // ── Akcesoria i wykończenie ──
  { id: 'acc_mirror',         name: 'Montaż lustra',                                  category: 'accessories', unit: 'szt.', priority: 'likely',      when: 'Standardowe wyposażenie' },
  { id: 'acc_towel_rail',     name: 'Montaż wieszaka na ręczniki / grzejnika',        category: 'accessories', unit: 'szt.', priority: 'likely',      when: 'Wieszak lub grzejnik łazienkowy' },
  { id: 'acc_shelf',          name: 'Montaż półek / organizerów',                     category: 'accessories', unit: 'szt.', priority: 'optional',    when: 'Dodatkowe przechowywanie' },
  { id: 'acc_toilet_paper',   name: 'Montaż uchwytu na papier',                       category: 'accessories', unit: 'szt.', priority: 'likely',      when: 'Standardowe wyposażenie' },
  { id: 'acc_soap_dish',      name: 'Montaż dozownika / mydelniczki',                 category: 'accessories', unit: 'szt.', priority: 'optional',    when: 'Dodatkowe akcesoria' },
  { id: 'acc_glass_partition', name: 'Montaż szyby / ścianki prysznicowej walk-in',   category: 'accessories', unit: 'szt.', priority: 'conditional', when: 'Prysznic walk-in' },

  // ── Uszczelnienia i odbiór ──
  { id: 'seal_silicone',      name: 'Silikonowanie (wanna, brodzik, umywalka, WC)',   category: 'sealing', unit: 'mb',       priority: 'required',    when: 'Zawsze na styku ceramiki', estimateDefault: { vatRate: 8 } },
  { id: 'seal_acrylic',       name: 'Uszczelnienie akrylowe (narożniki, przejścia)',  category: 'sealing', unit: 'mb',       priority: 'likely',      when: 'Na nieregularnych stykach' },
  { id: 'seal_cleanup',       name: 'Sprzątanie powykonawcze',                        category: 'sealing', unit: 'kpl.',     priority: 'required',    when: 'Zawsze na koniec' },
  { id: 'seal_inspection',    name: 'Odbiór techniczny / próba szczelności',          category: 'sealing', unit: 'kpl.',     priority: 'optional',    when: 'Na życzenie klienta lub przy odbiorze' },
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
      lines.push(`- ${t.id}: ${t.name} (${t.unit}) ${prio} — ${t.when}`)
    }
  }
  return lines.join('\n')
}
