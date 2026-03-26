/**
 * Bathroom Dependency Engine v1
 *
 * Domain knowledge: when a client mentions a specific bathroom feature (trigger),
 * it implies a chain of tasks that are direct, preceding, hidden, or conditional.
 * This engine surfaces those dependencies so estimates are never under-scoped.
 *
 * All taskId values correspond to BATHROOM_TASKS in bathroom-task-library.ts.
 * No data layer dependency — pure typed model + helper.
 */

// ── Interfaces ──────────────────────────────────────────────────────────────

/** A task that only applies when a specific condition is true. */
export interface ConditionalTask {
  /** Task ID from bathroom-task-library BATHROOM_TASKS */
  taskId: string
  /** Polish description of the condition gating this task */
  condition: string
}

/**
 * A named trigger (bathroom feature or design choice) and the full set of
 * tasks it implies across four dependency layers.
 */
export interface BathroomTrigger {
  /** Stable machine-readable identifier, snake_case */
  triggerId: string
  /** Polish label shown in the UI */
  triggerLabel: string
  /**
   * Tasks that are the direct, primary result of this trigger.
   * Example: "linear drain" → install linear drain, waterproof drain seal.
   */
  directTasks: string[]
  /**
   * Tasks that MUST happen before the direct tasks can be executed.
   * Frequently under-priced because they aren't visible to the client.
   */
  precedingTasks: string[]
  /**
   * Tasks that are technically required but often forgotten in quick estimates.
   * Naming them explicitly reduces omission errors.
   */
  hiddenTasks: string[]
  /**
   * Tasks that only apply under specific client decisions or site conditions.
   */
  conditionalTasks: ConditionalTask[]
  /**
   * Polish confirmation questions the estimator should ask before quoting.
   * These often determine which conditional tasks apply.
   */
  confirmationQuestions: string[]
  /** Optional notes (domain wisdom, common pitfalls). */
  notes?: string
  /**
   * Polish description of when this trigger should be activated.
   * Used to help the AI detect the trigger from client messages.
   */
  appliesWhen?: string
  /**
   * Polish description of when this trigger is NOT applicable.
   */
  notApplicableWhen?: string
}

/**
 * Result returned by expandBathroomDependencies().
 * All task ID arrays are deduplicated and stable-sorted.
 */
export interface BathroomDependencyExpanded {
  /** Task IDs from directTasks across all matched triggers */
  directTaskIds: string[]
  /** Task IDs from precedingTasks across all matched triggers */
  precedingTaskIds: string[]
  /** Task IDs from hiddenTasks across all matched triggers */
  hiddenTaskIds: string[]
  /** Task IDs from conditionalTasks across all matched triggers */
  conditionalTaskIds: string[]
  /** Deduplicated confirmation questions from all matched triggers */
  confirmationQuestions: string[]
  /**
   * Trigger IDs that were requested but not found in BATHROOM_TRIGGERS.
   * Allows callers to surface unknown triggers to the user.
   */
  missingAssumptions: string[]
}

// ── Trigger library ──────────────────────────────────────────────────────────

export const BATHROOM_TRIGGERS: BathroomTrigger[] = [
  // ── 1. Odpływ liniowy (linear drain) ──────────────────────────────────────
  {
    triggerId: 'linear_drain',
    triggerLabel: 'Odpływ liniowy',
    directTasks: [
      'plumb_shower_drain',
      'waterproof_drain_seal',
    ],
    precedingTasks: [
      'screed_shower_slope',
      'waterproof_floor',
      'waterproof_tape',
      'waterproof_collar',
    ],
    hiddenTasks: [
      'waterproof_wet',
      'waterproof_check',
    ],
    conditionalTasks: [
      {
        taskId: 'screed_heated_layer',
        condition: 'Jeśli pod posadzką prysznica jest ogrzewanie podłogowe',
      },
      {
        taskId: 'tile_floor',
        condition: 'Jeśli posadzka prysznica wykańczana płytką (niemal zawsze)',
      },
    ],
    confirmationQuestions: [
      'Czy zmieniana jest lokalizacja odpływu względem obecnej?',
      'Czy prysznic jest całkowicie bez brodzika (walk-in)?',
      'Czy konieczne jest kucie stropu lub posadzki pod nową lokalizację odpływu?',
    ],
    notes: 'Odpływ liniowy wymaga dokładnego spadku wylewki min. 1,5%. Błędy na tym etapie skutkują zalewaniem.',
    appliesWhen: 'Klient wspomina o odpływie liniowym, prysznicu bez brodzika, strefie prysznicowej w poziomie podłogi.',
    notApplicableWhen: 'Prysznic z brodzikiem akrylowym lub kamiennym montowanym na nóżkach.',
  },

  // ── 2. Walk-in (strefa prysznica walk-in) ─────────────────────────────────
  {
    triggerId: 'walk_in_shower',
    triggerLabel: 'Prysznic walk-in',
    directTasks: [
      'glass_walkin',
      'glass_seal_walkin',
    ],
    precedingTasks: [
      'plumb_shower_drain',
      'waterproof_wet',
      'screed_shower_slope',
    ],
    hiddenTasks: [
      'waterproof_drain_seal',
      'waterproof_tape',
      'seal_silicone',
    ],
    conditionalTasks: [
      {
        taskId: 'fit_shower_concealed',
        condition: 'Jeśli bateria prysznicowa podtynkowa',
      },
      {
        taskId: 'fit_shower_set',
        condition: 'Jeśli bateria prysznicowa natynkowa',
      },
    ],
    confirmationQuestions: [
      'Czy będzie odpływ liniowy czy punktowy?',
      'Czy bateria prysznicowa podtynkowa czy natynkowa?',
      'Czy szyba wolnostojąca (walk-in) czy kabina z drzwiami?',
    ],
    notes: 'Szyba walk-in wymaga precyzyjnego poziomu posadzki — tolerancja ≤ 1 mm pod profilem mocującym.',
    appliesWhen: 'Klient mówi o kabinie walk-in, strefie prysznica bez drzwi, szybie wolnostojącej.',
    notApplicableWhen: 'Standardowa kabina prysznicowa z drzwiami uchylnymi lub przesuwnymi.',
  },

  // ── 3. Wanna (bathtub) ────────────────────────────────────────────────────
  {
    triggerId: 'bathtub',
    triggerLabel: 'Wanna',
    directTasks: [
      'fix_bathtub',
      'plumb_bathtub',
    ],
    precedingTasks: [
      'waterproof_floor',
    ],
    hiddenTasks: [
      'gk_bathtub_casing',
      'seal_silicone',
      'waterproof_bath_walls',
    ],
    conditionalTasks: [
      {
        taskId: 'fix_bathtub_freestand',
        condition: 'Jeśli wanna wolnostojąca (free-standing)',
      },
      {
        taskId: 'glass_bath_screen',
        condition: 'Jeśli montowany parawan wannowy',
      },
      {
        taskId: 'fit_bathtub_tap',
        condition: 'Jeśli bateria wannowa natynkowa (nie podtynkowa)',
      },
      {
        taskId: 'demo_bathtub',
        condition: 'Jeśli usuwana jest stara, istniejąca wanna',
      },
    ],
    confirmationQuestions: [
      'Czy wanna zastępuje istniejącą wannę (wymagany demontaż)?',
      'Czy wanna wolnostojąca czy zabudowana?',
      'Czy będzie parawan wannowy?',
      'Czy bateria wannowa jest podtynkowa?',
    ],
    notes: 'Zabudowa GK wanny jest często pomijana w pierwszej wycenie — zawsze uwzględniać.',
    appliesWhen: 'Klient wymienia wannę lub planuje łazienkę z wanną.',
  },

  // ── 4. WC podtynkowe (concealed cistern WC) ───────────────────────────────
  {
    triggerId: 'concealed_wc',
    triggerLabel: 'WC podtynkowe (stelaż)',
    directTasks: [
      'fix_wc_concealed',
      'fix_wc_button',
    ],
    precedingTasks: [
      'gk_wc_frame',
      'plumb_wc_supply',
      'plumb_sewer_point',
    ],
    hiddenTasks: [
      'gk_inspection',
      'seal_silicone',
    ],
    conditionalTasks: [
      {
        taskId: 'plumb_sewer_point',
        condition: 'Jeśli zmieniana jest lokalizacja WC względem istniejącej',
      },
      {
        taskId: 'demo_wc',
        condition: 'Jeśli usuwane jest stare WC',
      },
    ],
    confirmationQuestions: [
      'Czy zmieniana jest lokalizacja WC?',
      'Czy pozostaje obecny pion kanalizacyjny?',
      'Czy potrzebna rewizja serwisowa do stelaża?',
      'Czy WC zawieszane czy stojące (na stelażu)?',
    ],
    notes: 'Zabudowa GK stelaża i rewizja serwisowa są wymagane normą — nie mogą być pominięte.',
    appliesWhen: 'Klient mówi o WC podtynkowym, stelażu, misce wiszącej.',
    notApplicableWhen: 'WC stojące z kompaktem wisząco-stojącym bez stelaża.',
  },

  // ── 5. Bateria podtynkowa (concealed mixer) ────────────────────────────────
  {
    triggerId: 'concealed_mixer',
    triggerLabel: 'Bateria podtynkowa',
    directTasks: [
      'plumb_mixing_valve',
      'fit_shower_concealed',
    ],
    precedingTasks: [
      'plumb_cold_point',
      'plumb_hot_point',
    ],
    hiddenTasks: [
      'gk_inspection',
      'waterproof_wet',
    ],
    conditionalTasks: [
      {
        taskId: 'plumb_sewer_point',
        condition: 'Jeśli montaż baterii wymaga przeróbki instalacji w innej lokalizacji',
      },
    ],
    confirmationQuestions: [
      'Czy bateria jest ścienna czy podtynkowa?',
      'Czy lokalizacja baterii ulega zmianie względem istniejącej?',
      'Czy potrzebna rewizja do zaworu podtynkowego?',
    ],
    appliesWhen: 'Klient mówi o baterii podtynkowej, concealed, podtynkowej termostatycznej.',
    notApplicableWhen: 'Standardowa bateria natynkowa (stojąca lub ścienna).',
  },

  // ── 6. Płytki ścienne (wall tiles) ────────────────────────────────────────
  {
    triggerId: 'wall_tiles',
    triggerLabel: 'Płytki ścienne',
    directTasks: [
      'tile_wall_full',
    ],
    precedingTasks: [
      'substrate_wall_priming',
      'waterproof_wet',
    ],
    hiddenTasks: [
      'profile_corner',
      'profile_edge',
      'grout_wall',
      'seal_silicone',
    ],
    conditionalTasks: [
      {
        taskId: 'substrate_plastering',
        condition: 'Jeśli ściany wymagają tynkowania przed układaniem płytek',
      },
      {
        taskId: 'tile_wall_partial',
        condition: 'Jeśli płytki tylko do połowy ściany (lambrekiny/pas)',
      },
    ],
    confirmationQuestions: [
      'Do jakiej wysokości idą płytki (pełna ściana czy pas)?',
      'Czy ściany wymagają tynkowania lub wyrównania?',
      'Czy układ płytek jest standardowy czy karo/jodełka?',
    ],
    appliesWhen: 'Montaż płytek ceramicznych lub gresowych na ścianach łazienki.',
  },

  // ── 7. Płytki podłogowe (floor tiles) ─────────────────────────────────────
  {
    triggerId: 'floor_tiles',
    triggerLabel: 'Płytki podłogowe',
    directTasks: [
      'tile_floor',
    ],
    precedingTasks: [
      'substrate_priming',
      'substrate_leveling',
      'waterproof_floor',
      'screed_float',
    ],
    hiddenTasks: [
      'profile_expansion',
      'grout_floor',
      'seal_silicone',
      'tile_threshold',
    ],
    conditionalTasks: [
      {
        taskId: 'profile_corner',
        condition: 'Jeśli przy ścianie konieczny profil cokołowy',
      },
      {
        taskId: 'screed_float',
        condition: 'Jeśli podkład wymaga wylewki pływającej',
      },
    ],
    confirmationQuestions: [
      'Czy istniejąca posadzka wymaga skucia?',
      'Czy płytki mają układ standardowy, karo lub jodełka?',
      'Czy konieczny próg między łazienką a korytarzem?',
    ],
    appliesWhen: 'Układanie płytek na posadzce łazienki.',
  },

  // ── 8. Wielki format (large format tiles ≥ 60×60 cm) ─────────────────────
  {
    triggerId: 'large_format',
    triggerLabel: 'Wielki format (≥ 60×60 cm)',
    directTasks: [
      'lf_wall',
      'lf_floor',
    ],
    precedingTasks: [
      'substrate_leveling',
      'lf_substrate_primer',
    ],
    hiddenTasks: [
      'lf_adhesive_premium',
      'grout_lf',
      'profile_expansion',
    ],
    conditionalTasks: [
      {
        taskId: 'cut_complex',
        condition: 'Jeśli cięcia otworów (gniazdka, odpływy, nisze) w wielkim formacie',
      },
      {
        taskId: 'substrate_grind_floor',
        condition: 'Jeśli podkład wymaga szlifowania w celu uzyskania płaskości',
      },
    ],
    confirmationQuestions: [
      'Czy płytki mają wymiary ≥ 60×60 cm?',
      'Czy podłoże ma płaskość wymaganą przez großformat (≤ 3 mm / 2 m)?',
      'Czy fugi mają być maksymalnie wąskie (rectified)?',
    ],
    notes: 'Wielki format wymaga kleju zbrojonego i pełnego krycia spodem — cena kleju wyraźnie wyższa.',
    appliesWhen: 'Klient mówi o wielkim formacie, maxi, gres rektyfikowany dużego wymiaru.',
  },

  // ── 9. Mozaika ────────────────────────────────────────────────────────────
  {
    triggerId: 'mosaic',
    triggerLabel: 'Mozaika',
    directTasks: [
      'tile_mosaic',
    ],
    precedingTasks: [
      'substrate_priming',
    ],
    hiddenTasks: [
      'grout_wall',
      'profile_edge',
      'seal_silicone',
    ],
    conditionalTasks: [
      {
        taskId: 'waterproof_wet',
        condition: 'Jeśli mozaika w strefie mokrej (prysznic, okolice wanny)',
      },
      {
        taskId: 'cut_complex',
        condition: 'Jeśli cięcia mozaiki wymagają pracy ręcznej (niestandardowe wymiary)',
      },
    ],
    confirmationQuestions: [
      'Czy mozaika jest w strefie mokrej?',
      'Czy mozaika obejmuje całą powierzchnię czy tylko fragment/pas?',
    ],
    appliesWhen: 'Klient mówi o mozaice, płytkach 2×2, 5×5, siatce mozaikowej.',
  },

  // ── 10. Ogrzewanie podłogowe (underfloor heating) ─────────────────────────
  {
    triggerId: 'underfloor_heating',
    triggerLabel: 'Ogrzewanie podłogowe',
    directTasks: [
      'underfloor_mat',
    ],
    precedingTasks: [
      'substrate_grind_floor',
    ],
    hiddenTasks: [
      'screed_heated_layer',
    ],
    conditionalTasks: [
      {
        taskId: 'underfloor_water',
        condition: 'Jeśli ogrzewanie podłogowe wodne (nie elektryczne)',
      },
      {
        taskId: 'elec_thermostat',
        condition: 'Jeśli ogrzewanie elektryczne — wymagany termostat',
      },
      {
        taskId: 'elec_circuit_breaker',
        condition: 'Jeśli brak dedykowanego obwodu elektrycznego pod ogrzewanie',
      },
    ],
    confirmationQuestions: [
      'Czy ogrzewanie podłogowe elektryczne czy wodne?',
      'Czy mat/kabel jest już zakupiony przez klienta?',
      'Czy powyżej wylewki będą płytki (wymagany klej do ogrzewania podłogowego)?',
    ],
    notes: 'Wylewka na ogrzewaniu podłogowym musi schnąć minimum 28 dni — wpływ na harmonogram.',
    appliesWhen: 'Klient mówi o ogrzewaniu podłogowym, macie grzewczej, podłogówce.',
  },

  // ── 11. Zabudowa kotła / bojlera (boiler casing) ──────────────────────────
  {
    triggerId: 'boiler_casing',
    triggerLabel: 'Zabudowa kotła/bojlera',
    directTasks: [
      'gk_boiler_casing',
    ],
    precedingTasks: [],
    hiddenTasks: [
      'gk_inspection',
      'tile_wall_full',
    ],
    conditionalTasks: [
      {
        taskId: 'grout_wall',
        condition: 'Jeśli zabudowa kotła będzie obłożona płytką',
      },
      {
        taskId: 'seal_silicone',
        condition: 'Jeśli zabudowa na styku z podłogą lub ścianą mokrą',
      },
    ],
    confirmationQuestions: [
      'Czy kocioł lub bojler jest w łazience do zabudowania?',
      'Czy zabudowa ma być obłożona płytką czy malowana?',
      'Czy rewizja serwisowa jest wymagana (zawór, kocioł)?',
    ],
    notes: 'Rewizja serwisowa w zabudowie GK jest wymagana przez normy — nie może być pominięta.',
    appliesWhen: 'Klient mówi o zabudowie kotła, chowaniu bojlera, obudowie armatury.',
  },

  // ── 12. Zabudowa pionów (pipe chase / riser casing) ───────────────────────
  {
    triggerId: 'pipe_casing',
    triggerLabel: 'Zabudowa pionów',
    directTasks: [
      'gk_pipe_casing',
    ],
    precedingTasks: [],
    hiddenTasks: [
      'gk_inspection',
      'waterproof_tape',
    ],
    conditionalTasks: [
      {
        taskId: 'tile_wall_full',
        condition: 'Jeśli zabudowa pionów ma być obłożona płytką',
      },
      {
        taskId: 'grout_wall',
        condition: 'Jeśli zabudowa pionów będzie wykafelkowana',
      },
      {
        taskId: 'seal_silicone',
        condition: 'Jeśli zabudowa na styku ze strefą mokrą lub podłogą',
      },
    ],
    confirmationQuestions: [
      'Czy piony wymagają rewizji serwisowej?',
      'Czy zabudowa pionów ma być wykafelkowana czy malowana?',
      'Czy piony będą zasłonięte w całości czy tylko częściowo?',
    ],
    appliesWhen: 'Klient mówi o chowaniu pionów, zabudowie rur kanalizacyjnych, obudowie pionów.',
  },

  // ── 13. Sufit podwieszany (suspended ceiling / GK ceiling) ────────────────
  {
    triggerId: 'suspended_ceiling',
    triggerLabel: 'Sufit podwieszany',
    directTasks: [
      'gk_ceiling',
    ],
    precedingTasks: [
      'elec_lighting_points',
    ],
    hiddenTasks: [
      'elec_fan',
      'paint_gk',
    ],
    conditionalTasks: [
      {
        taskId: 'elec_lighting',
        condition: 'Jeśli montowane oprawy oświetleniowe w suficie',
      },
      {
        taskId: 'vent_fan_exchange',
        condition: 'Jeśli wentylator w suficie wymaga nowego kanału wentylacyjnego',
      },
      {
        taskId: 'elec_circuit_breaker',
        condition: 'Jeśli instalacja oświetlenia wymaga nowego obwodu',
      },
    ],
    confirmationQuestions: [
      'Czy sufit będzie malowany czy obłożony?',
      'Czy planowane jest oświetlenie punktowe w suficie?',
      'Czy wentylacja mechaniczna jest prowadzona przez sufit?',
    ],
    notes: 'Wentylator należy zamontować PRZED zamknięciem sufitu — kolejność realizacji krytyczna.',
    appliesWhen: 'Klient mówi o suficie podwieszanym, podbitce GK, suficie z karton-gipsu.',
  },

  // ── 14. Lustro z oświetleniem (mirror with lighting) ──────────────────────
  {
    triggerId: 'mirror_light',
    triggerLabel: 'Lustro z oświetleniem',
    directTasks: [
      'acc_mirror',
      'elec_mirror_light',
    ],
    precedingTasks: [
      'elec_lighting_points',
    ],
    hiddenTasks: [
      'elec_circuit_breaker',
    ],
    conditionalTasks: [
      {
        taskId: 'acc_mirror_cabinet',
        condition: 'Jeśli szafka lustrzana zamiast samego lustra (z oświetleniem LED)',
      },
    ],
    confirmationQuestions: [
      'Czy lustro ma własne podświetlenie LED lub podgrzewanie anti-fog?',
      'Czy konieczne jest nowe gniazdko lub punkt elektryczny przy lustrze?',
      'Czy lustro za umywalką wymaga specjalnego wiercenia (płytki)?',
    ],
    appliesWhen: 'Klient mówi o lustrze podświetlanym, smart mirror, szafce lustrzanej.',
  },

  // ── 15. Grzejnik łazienkowy / drabinkowy (towel radiator) ─────────────────
  {
    triggerId: 'towel_radiator',
    triggerLabel: 'Grzejnik drabinkowy / łazienkowy',
    directTasks: [
      'plumb_radiator',
      'fit_radiator_tap',
    ],
    precedingTasks: [],
    hiddenTasks: [
      'seal_silicone',
    ],
    conditionalTasks: [
      {
        taskId: 'plumb_cold_point',
        condition: 'Jeśli lokalizacja grzejnika ulega zmianie — wymagane nowe punkty instalacji',
      },
      {
        taskId: 'plumb_hot_point',
        condition: 'Jeśli lokalizacja grzejnika ulega zmianie — wymagane nowe punkty instalacji',
      },
      {
        taskId: 'elec_thermostat',
        condition: 'Jeśli grzejnik elektryczny z termostatem (nie wodny)',
      },
    ],
    confirmationQuestions: [
      'Czy grzejnik jest wodny (podłączony do C.O.) czy elektryczny?',
      'Czy zmieniana jest lokalizacja względem istniejącej?',
      'Czy grzejnik jest już zakupiony przez klienta?',
    ],
    appliesWhen: 'Klient mówi o grzejniku łazienkowym, suszarce na ręczniki, drabince grzewczej.',
  },

  // ── 16. Dwie umywalki / podwójny blat (double basin) ──────────────────────
  {
    triggerId: 'double_basin',
    triggerLabel: 'Dwie umywalki / podwójny blat',
    directTasks: [
      'fix_basin_double',
    ],
    precedingTasks: [
      'plumb_basin_supply',
      'plumb_cold_point',
      'plumb_hot_point',
    ],
    hiddenTasks: [
      'fit_basin_tap',
      'seal_silicone',
      'plumb_sewer_point',
    ],
    conditionalTasks: [
      {
        taskId: 'acc_countertop',
        condition: 'Jeśli umywalki wpuszczane w blat lub nablatowe na blacie',
      },
      {
        taskId: 'acc_vanity',
        condition: 'Jeśli szafka pod umywalki (vanity) jest montowana',
      },
    ],
    confirmationQuestions: [
      'Czy obie umywalki są w tej samej lokalizacji (blat) czy rozdzielone?',
      'Czy blat pod dwie umywalki jest zamawiany przez wykonawcę?',
      'Czy istniejąca instalacja wody wymaga rozbudowy do dwóch punktów?',
    ],
    notes: 'Podwójne umywalki wymagają co najmniej 2-krotności punktów inst. wody i kanalizacji.',
    appliesWhen: 'Klient mówi o dwóch umywalkach, double vanity, podwójnym blacie.',
  },

  // ── 17. Okno w łazience (bathroom window) ─────────────────────────────────
  {
    triggerId: 'bathroom_window',
    triggerLabel: 'Okno w łazience',
    directTasks: [],
    precedingTasks: [
      'tile_wall_window',
      'tile_window_sill',
    ],
    hiddenTasks: [
      'cut_complex',
      'seal_silicone',
    ],
    conditionalTasks: [
      {
        taskId: 'elec_fan',
        condition: 'Jeśli brak mechanicznej wentylacji — wymagany wentylator okienny',
      },
      {
        taskId: 'vent_grille',
        condition: 'Jeśli maskowanie nawiewu/wywiewu w okolicach okna',
      },
    ],
    confirmationQuestions: [
      'Czy okno będzie obłożone płytką (glif i parapet)?',
      'Czy parapet jest z płytki, konglomeratowy czy PVC?',
      'Czy okno wymaga wymiany ościeżnicy czy tylko renowacji?',
    ],
    notes: 'Zawsze uwzględnić glif (obramiowanie okna) jeśli ściany są kafelkowane — często pomijane.',
    appliesWhen: 'Klient wymienia lub remontuje okno w kafelkowanej łazience.',
  },
]

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Expands a list of trigger IDs into a full dependency report.
 *
 * @param triggerIds - IDs matching BathroomTrigger.triggerId
 * @param options.includeOptional - When true, conditionalTaskIds are included
 *   in the expanded result (default: false — they are listed separately)
 */
export function expandBathroomDependencies(
  triggerIds: string[],
  options?: { includeOptional?: boolean },
): BathroomDependencyExpanded {
  const direct      = new Set<string>()
  const preceding   = new Set<string>()
  const hidden      = new Set<string>()
  const conditional = new Set<string>()
  const questions   = new Set<string>()
  const missing     = new Set<string>()

  for (const id of triggerIds) {
    const trigger = BATHROOM_TRIGGERS.find(t => t.triggerId === id)
    if (!trigger) {
      missing.add(id)
      continue
    }

    trigger.directTasks.forEach(t => direct.add(t))
    trigger.precedingTasks.forEach(t => preceding.add(t))
    trigger.hiddenTasks.forEach(t => hidden.add(t))
    trigger.conditionalTasks.forEach(ct => conditional.add(ct.taskId))
    trigger.confirmationQuestions.forEach(q => questions.add(q))
  }

  const sorted = (s: Set<string>) => Array.from(s).sort()

  return {
    directTaskIds:         sorted(direct),
    precedingTaskIds:      sorted(preceding),
    hiddenTaskIds:         sorted(hidden),
    conditionalTaskIds:    sorted(conditional),
    confirmationQuestions: Array.from(questions),
    missingAssumptions:    sorted(missing),
  }
}
