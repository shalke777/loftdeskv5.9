// =============================================================================
// Bathroom Dependency Triggers — shared module for Netlify functions
// =============================================================================
// Self-contained. No imports from src/. Safe for esbuild bundling.
//
// Used by: analyze-room-photo.ts, analyze-project.ts
//
// Logic:
//   1. detectBathroomTriggers(labels, clarification?) → triggerId[]
//   2. expandDependencies(triggerIds, existingLibraryIds) → ExpandResult
//
// Task IDs follow the inline BATHROOM_LIBRARY_BLOCK in analyze-room-photo.ts
// where those IDs exist; BATHROOM_TASKS canonical IDs for the rest.
// Provenance field marks the origin of each inferred item.
// =============================================================================

export type Provenance = 'direct_detected' | 'dependency_inferred' | 'confirmation_needed'

// ── Clarification Question types (mirrors src/services/ai/engines/clarification.types.ts) ─

export type QuestionSeverity =
  | 'critical_for_scope'
  | 'important_for_accuracy'
  | 'optional_detail'

export type QuestionAnswerType = 'yes_no' | 'single_choice' | 'number' | 'text'

export type QuestionCategory = 'scope' | 'installation' | 'location' | 'material' | 'electrical' | 'other'

export interface ClarificationQuestion {
  id:             string
  text:           string
  severity:       QuestionSeverity
  category:       QuestionCategory
  answerType:     QuestionAnswerType
  relatedTrigger: string
  relatedTaskIds: string[]
  affects:        string[]
  source:         'dependency_rule'
  /** Selectable Polish labels for single_choice questions */
  options?:       string[]
}

/** Strip to plain text — for backward-compat missing_information push */
export function extractQuestionTexts(questions: ClarificationQuestion[]): string[] {
  return questions.map(q => q.text)
}

export interface InferredScopeItem {
  library_id:   string
  description:  string
  category:     string
  unit:         string
  priority:     'required' | 'likely' | 'optional'
  confidence:   number
  provenance:   Provenance
  notes:        string | null
  dependencies: string[]
}

interface ConditionalTask extends Omit<InferredScopeItem, 'provenance'> {
  condition:      string
  confirmQuestion: string
}

/** Internal per-trigger question (before relatedTrigger is stamped) */
interface InternalQuestion {
  id:             string
  text:           string
  severity:       QuestionSeverity
  category:       QuestionCategory
  answerType:     QuestionAnswerType
  relatedTaskIds: string[]
  affects:        string[]
}

/** Helper — builds an InternalQuestion with positional args for brevity */
function q(
  id:             string,
  text:           string,
  severity:       QuestionSeverity,
  category:       QuestionCategory,
  answerType:     QuestionAnswerType,
  relatedTaskIds: string[] = [],
  affects:        string[] = [],
): InternalQuestion {
  return { id, text, severity, category, answerType, relatedTaskIds, affects }
}

/**
 * Options for single_choice questions, keyed by question id.
 * Injected at expansion time — avoids an extra param on every q() call.
 */
const QUESTION_OPTIONS: Record<string, string[] | undefined> = {
  'wi_q1': ['Wolnostojąca', 'Mocowana do ściany'],
  'wi_q2': ['Podtynkowa', 'Natynkowa'],
  'bt_q2': ['Wolnostojąca', 'Zabudowana w GK'],
  'bt_q3': ['Podtynkowa', 'Natynkowa'],
  'wc_q2': ['W narożniku', 'W ścianie'],
  'wt_q1': ['Pełna ściana', 'Do połowy ściany', 'Pas dekoracyjny'],
  'mo_q2': ['Całość', 'Fragment/pas'],
  'uh_q1': ['Elektryczne', 'Wodne (C.O.)'],
  'bc_q1': ['Wykafelkowana', 'Malowana'],
  'pc_q2': ['Wykafelkowana', 'Malowana'],
  'sc_q1': ['Całość pomieszczenia', 'Fragment'],
  'tr_q1': ['Wodny (C.O.)', 'Elektryczny'],
  'db_q1': ['Wspólny blat', 'Oddzielne umywalki'],
  'bw_q2': ['Z płytki', 'Konglomeratowy', 'PVC'],
}

interface TriggerDef {
  triggerId:          string
  /** Lowercase keyword fragments for detection from Polish labels/descriptions */
  keywords:           string[]
  /** Must exist before direct tasks — always injected */
  preceding:          Omit<InferredScopeItem, 'provenance'>[]
  /** Often omitted in flat estimates — injected with 'dependency_inferred' */
  hidden:             Omit<InferredScopeItem, 'provenance'>[]
  /** Only when specific site condition confirmed */
  conditional:        ConditionalTask[]
  /** Structured clarification questions — replaces plain confirmationQuestions[] */
  structuredQuestions: InternalQuestion[]
}

// ── Task lookup helpers ───────────────────────────────────────────────────────

function p(
  library_id:   string,
  description:  string,
  category:     string,
  unit:         string,
  priority:     'required' | 'likely' | 'optional',
  confidence:   number,
  notes:        string | null = null,
  dependencies: string[]     = [],
): Omit<InferredScopeItem, 'provenance'> {
  return { library_id, description, category, unit, priority, confidence, notes, dependencies }
}

function c(
  library_id:    string,
  description:   string,
  category:      string,
  unit:          string,
  priority:      'required' | 'likely' | 'optional',
  confidence:    number,
  condition:     string,
  confirmQuestion: string,
  notes:         string | null = null,
): ConditionalTask {
  return { library_id, description, category, unit, priority, confidence, condition, confirmQuestion, notes, dependencies: [] }
}

// ── Trigger definitions ────────────────────────────────────────────────────────

const TRIGGER_DEFS: TriggerDef[] = [

  // ── 1. Odpływ liniowy ─────────────────────────────────────────────────────
  {
    triggerId: 'linear_drain',
    keywords: ['odpływ liniowy', 'odplyw liniowy', 'odpływ podłogowy', 'odplyw podlogowy', 'linear drain'],
    preceding: [
      p('screed_shower_slope',  'Wykonanie spadków pod odpływ / strefę natrysku',          'screed',        'm2',   'required', 85, 'Wymagane min. 1,5% — często pomijane w pierwszej wycenie'),
      p('waterproof_floor',     'Hydroizolacja podłogi (I warstwa)',                        'waterproofing', 'm2',   'required', 90),
      p('waterproof_tape',      'Taśmy uszczelniające (narożniki, przejścia)',              'waterproofing', 'mb',   'required', 88),
      p('waterproof_collar',    'Kołnierze uszczelniające (odpływ, rury)',                  'waterproofing', 'szt.', 'required', 88),
    ],
    hidden: [
      p('waterproof_wet',       'Hydroizolacja strefy natrysku — ściany',                  'waterproofing', 'm2',   'required', 85, 'Obowiązkowa w strefie mokrej'),
      p('waterproof_drain_seal','Uszczelnienie kielicha odpływu liniowego',                'waterproofing', 'szt.', 'likely',   80),
    ],
    conditional: [
      c('screed_heated_layer',  'Wylewka na ogrzewanie podłogowe',                         'screed',        'm2',   'optional', 60,
        'Jeśli pod posadzką prysznica jest ogrzewanie podłogowe',
        'Czy pod strefą prysznicową jest ogrzewanie podłogowe?'),
    ],
    structuredQuestions: [
      q('ld_q1', 'Czy lokalizacja odpływu liniowego zmienia się względem obecnej?',
        'critical_for_scope', 'location', 'yes_no', ['screed_shower_slope', 'plumb_sewer_point'],
        ['Nowa lokalizacja wymaga kucia posadzki i przeróbki kanalizacji']),
      q('ld_q2', 'Czy kucie posadzki jest wymagane pod nową lokalizację odpływu?',
        'critical_for_scope', 'scope', 'yes_no', ['screed_shower_slope'],
        ['Wpływa na zakres robót wyburzeniowych']),
    ],
  },

  // ── 2. Prysznic walk-in ───────────────────────────────────────────────────
  {
    triggerId: 'walk_in_shower',
    keywords: ['walk-in', 'walk in', 'prysznic walk', 'szyba walk', 'strefa prysznica', 'natrysk bez brodzika'],
    preceding: [
      p('plumb_shower_drain',   'Montaż odpływu liniowego / punktowego',                   'plumbing',      'szt.', 'required', 92),
      p('waterproof_wet',       'Hydroizolacja strefy natrysku — ściany',                  'waterproofing', 'm2',   'required', 92),
      p('screed_shower_slope',  'Wykonanie spadków pod strefę natrysku',                   'screed',        'm2',   'required', 88),
    ],
    hidden: [
      p('waterproof_tape',      'Taśmy uszczelniające (narożniki)',                        'waterproofing', 'mb',   'required', 88),
      p('waterproof_collar',    'Kołnierze uszczelniające (odpływ)',                       'waterproofing', 'szt.', 'required', 85),
      p('waterproof_drain_seal','Uszczelnienie odpływu w strefie natrysku',               'waterproofing', 'szt.', 'likely',   80),
      p('seal_silicone_shower', 'Silikonowanie kabiny / strefy prysznicowej',              'silicone',      'mb',   'required', 88),
    ],
    conditional: [
      c('plumb_mixing_valve',   'Montaż baterii podtynkowej',                              'plumbing',      'szt.', 'optional', 65,
        'Jeśli bateria prysznicowa podtynkowa',
        'Czy bateria prysznicowa będzie podtynkowa czy natynkowa?'),
      c('fit_shower_set',       'Montaż zestawu prysznicowego',                            'fittings',      'kpl.', 'optional', 65,
        'Jeśli bateria prysznicowa natynkowa',
        'Czy bateria prysznicowa będzie natynkowa?'),
    ],
    structuredQuestions: [
      q('wi_q1', 'Czy szyba walk-in jest wolnostojąca czy mocowana do ściany?',
        'important_for_accuracy', 'installation', 'single_choice', [],
        ['Wpływa na sposób mocowania i rodzaj kołków rozporowych']),
      q('wi_q2', 'Czy bateria prysznicowa jest podtynkowa czy natynkowa?',
        'critical_for_scope', 'installation', 'single_choice', ['plumb_mixing_valve', 'fit_shower_set'],
        ['Podtynkowa wymaga zabudowy GK i dodatkowego punktu w ścianie']),
    ],
  },

  // ── 3. Wanna ──────────────────────────────────────────────────────────────
  {
    triggerId: 'bathtub',
    keywords: ['wanna', 'bathtub', 'wan'],
    preceding: [
      p('waterproof_floor',     'Hydroizolacja podłogi przy wannie',                       'waterproofing', 'm2',   'required', 85),
    ],
    hidden: [
      p('gk_bath_panel',        'Obudowa boczna wanny (GK)',                               'drywall',       'kpl.', 'likely',   80, 'Montaż obudowy wanny — często pomijany w szybkiej wycenie'),
      p('seal_silicone',        'Silikonowanie styku wanny z płytką / ścianą',            'silicone',      'mb',   'required', 90),
      p('plumb_bathtub',        'Podłączenie hydrauliczne wanny',                          'plumbing',      'szt.', 'required', 90),
    ],
    conditional: [
      c('fix_freestanding_bath','Montaż wanny wolnostojącej',                              'fixtures',      'kpl.', 'optional', 70,
        'Jeśli wanna wolnostojąca (free-standing)',
        'Czy wanna jest wolnostojąca czy zabudowana?'),
      c('glass_shower_door',    'Montaż parawanu wannowego',                               'glass',         'szt.', 'optional', 60,
        'Jeśli montowany parawan wannowy',
        'Czy będzie parawan wannowy przy wannie?'),
      c('fit_bathtub_tap',      'Montaż baterii wannowej',                                 'fittings',      'szt.', 'likely',   75,
        'Jeśli bateria wannowa natynkowa (nie podtynkowa)',
        'Czy bateria wannowa jest natynkowa lub podtynkowa?'),
      c('demo_bathtub',         'Demontaż starej wanny',                                   'demolition',    'szt.', 'likely',   70,
        'Jeśli usuwana jest istniejąca wanna',
        'Czy usuwamy istniejącą wannę?'),
    ],
    structuredQuestions: [
      q('bt_q1', 'Czy wanna zastępuje istniejącą (wymagany demontaż)?',
        'critical_for_scope', 'scope', 'yes_no', ['demo_bathtub'],
        ['Dodaje pozycję demontażu starej wanny']),
      q('bt_q2', 'Czy wanna wolnostojąca czy zabudowana w zabudowie GK?',
        'important_for_accuracy', 'installation', 'single_choice', ['fix_freestanding_bath', 'gk_bath_panel'],
        ['Wolnostojąca: montaz na stopkach; zabudowana: obudowa GK z płytką']),
      q('bt_q3', 'Czy bateria wannowa podtynkowa czy natynkowa?',
        'important_for_accuracy', 'installation', 'single_choice', ['fit_bathtub_tap'],
        ['Podtynkowa: dodatkowe prace instalacyjne i zabudowa']),
    ],
  },

  // ── 4. WC podtynkowe ──────────────────────────────────────────────────────
  {
    triggerId: 'concealed_wc',
    keywords: ['wc podtynkowe', 'stelaż wc', 'stelaz wc', 'miska wisząca', 'miska wiszaca', 'podtynkowe wc'],
    preceding: [
      p('gk_wc_frame',          'Zabudowa stelaża WC podtynkowego (GK)',                   'drywall',       'kpl.', 'required', 95, 'Wymagana przed montażem misy wiszącej'),
      p('plumb_wc_supply',      'Podejście wodne do WC',                                   'plumbing',      'szt.', 'required', 90),
    ],
    hidden: [
      p('gk_inspection',        'Rewizja serwisowa / drzwiczki do stelaża',               'drywall',       'szt.', 'required', 88, 'Wymagana normą — dostęp serwisowy do stelaża'),
      p('seal_silicone',        'Silikonowanie styku misy WC z podłogą / ścianą',         'silicone',      'mb',   'required', 85),
    ],
    conditional: [
      c('plumb_sewer_point',    'Przeróbka punktu kanalizacyjnego',                        'plumbing',      'szt.', 'optional', 65,
        'Jeśli lokalizacja WC zmienia się względem istniejącej',
        'Czy lokalizacja WC ulega zmianie względem obecnej?'),
    ],
    structuredQuestions: [
      q('wc_q1', 'Czy lokalizacja WC jest zmieniana względem obecnej?',
        'critical_for_scope', 'location', 'yes_no', ['plumb_sewer_point'],
        ['Zmiana lokalizacji wymaga prze róbki kanalizacji']),
      q('wc_q2', 'Czy stelaż WC jest w naroŻniku czy ścianie (wpływa na wymiary zabudowy)?',
        'important_for_accuracy', 'installation', 'single_choice', ['gk_wc_frame'],
        ['Narożnik: większy modul GK; ściana: standard']),
      q('wc_q3', 'Czy potrzebna rewizja serwisowa do stelaża?',
        'important_for_accuracy', 'installation', 'yes_no', ['gk_inspection'],
        ['Wymaga drzwiczek rewizyjnych w zabudowie GK']),
    ],
  },

  // ── 5. Bateria podtynkowa ─────────────────────────────────────────────────
  {
    triggerId: 'concealed_mixer',
    keywords: ['bateria podtynkowa', 'bateria concealed', 'zawór podtynkowy', 'zawor podtynkowy', 'termostat podtynk'],
    preceding: [
      p('plumb_cold_point',     'Przeróbka / przesunięcie punktu zimnej wody',             'plumbing',      'szt.', 'required', 80),
      p('plumb_hot_point',      'Przeróbka / przesunięcie punktu ciepłej wody',            'plumbing',      'szt.', 'required', 80),
    ],
    hidden: [
      p('gk_inspection',        'Rewizja serwisowa (dostęp do zaworu podtynkowego)',       'drywall',       'szt.', 'likely',   75, 'Dostęp serwisowy do zaworu podtynkowego'),
    ],
    conditional: [
      c('plumb_sewer_point',    'Przeróbka kanalizacji',                                   'plumbing',      'szt.', 'optional', 55,
        'Jeśli lokalizacja baterii wymaga przeróbki instalacji w innej lokalizacji',
        'Czy lokalizacja baterii ulega zmianie względem obecnej?'),
    ],
    structuredQuestions: [
      q('cm_q1', 'Czy lokalizacja baterii zmienia się względem istniejącej?',
        'critical_for_scope', 'location', 'yes_no', ['plumb_cold_point', 'plumb_hot_point'],
        ['Nowa lokalizacja: przeróbka punktów wody zimnej i ciepłej']),
      q('cm_q2', 'Czy potrzebna rewizja serwisowa do zaworu podtynkowego?',
        'important_for_accuracy', 'installation', 'yes_no', ['gk_inspection'],
        ['Drzwiczki rewizyjne w zabudowie GK']),
    ],
  },

  // ── 6. Płytki ścienne ─────────────────────────────────────────────────────
  {
    triggerId: 'wall_tiles',
    keywords: ['płytki ścienne', 'plytki scienne', 'okładziny ścian', 'okladziny scian', 'kafelki ścienne', 'oblicowanie ścian'],
    preceding: [
      p('substrate_wall_priming','Gruntowanie ścian pod płytki',                           'substrate',     'm2',   'required', 92),
    ],
    hidden: [
      p('waterproof_wet',        'Hydroizolacja strefy mokrej — ściany',                   'waterproofing', 'm2',   'likely',   82, 'Wymagana w strefach mokrych — potwierdź zakres'),
      p('profile_corner',       'Profile narożnikowe (aluminium/PVC)',                     'profiles',      'mb',   'required', 88),
      p('profile_edge',         'Listwy krawędziowe / wykończeniowe',                      'profiles',      'mb',   'likely',   75),
      p('grout_walls',          'Fugowanie płytek ściennych',                              'grouting',      'm2',   'required', 95),
      p('seal_silicone',        'Silikonowanie styku płytek ze strefami mokrymi',          'silicone',      'mb',   'required', 90),
    ],
    conditional: [
      c('substrate_plastering', 'Tynkowanie / wyrównanie ścian gipsem',                    'substrate',     'm2',   'optional', 65,
        'Jeśli ściany wymagają tynkowania przed układaniem płytek',
        'Czy ściany wymagają tynkowania lub wyrównania przed płytką?'),
    ],
    structuredQuestions: [
      q('wt_q1', 'Do jakiej wysokości idą płytki (ściana pełna czy pas)?',
        'important_for_accuracy', 'scope', 'single_choice', [],
        ['Wpływa na ilość m2 okładzin i spoiny']),
      q('wt_q2', 'Czy ściany w strefie mokrej (prysznic / wanna) wymagają hydroizolacji?',
        'critical_for_scope', 'scope', 'yes_no', ['waterproof_wet'],
        ['Dodaje hydroizolację ścian strefy mokrej']),
      q('wt_q3', 'Czy ściany wymagają tynkowania lub wyrównania?',
        'important_for_accuracy', 'material', 'yes_no', ['substrate_plastering'],
        ['Tynkowanie przed okładziną to oddzielna pozycja']),
    ],
  },

  // ── 7. Płytki podłogowe ───────────────────────────────────────────────────
  {
    triggerId: 'floor_tiles',
    keywords: ['płytki podłogowe', 'plytki podlogowe', 'okładziny podłogi', 'okladziny podlogi', 'gres na podłodze', 'gres podlogowy'],
    preceding: [
      p('substrate_floor_priming','Gruntowanie podłoża pod płytki',                        'substrate',     'm2',   'required', 92),
      p('substrate_floor_leveling','Wyrównanie podłoża / wylewka',                         'substrate',     'm2',   'likely',   78),
      p('waterproof_floor',      'Hydroizolacja podłogi łazienki',                         'waterproofing', 'm2',   'required', 92),
    ],
    hidden: [
      p('profile_expansion',    'Profile dylatacyjne',                                     'profiles',      'mb',   'likely',   72),
      p('grout_floor',          'Fugowanie płytek podłogowych',                            'grouting',      'm2',   'required', 95),
      p('seal_silicone',        'Silikonowanie styku podłogi z zabudowami',               'silicone',      'mb',   'required', 85),
      p('tile_threshold',       'Próg / listwa progowa',                                   'profiles',      'szt.', 'likely',   78),
    ],
    conditional: [
      c('screed_float',         'Szlichta cementowa / wylewka tradycyjna',                 'screed',        'm2',   'optional', 65,
        'Jeśli podkład wymaga pełnej wylewki (np. po skuciu starej)',
        'Czy podkład wymaga pełnej wylewki cementowej?'),
    ],
    structuredQuestions: [
      q('ft_q1', 'Czy istniejąca posadzka wymaga skucia przed układaniem nowej?',
        'critical_for_scope', 'scope', 'yes_no', ['screed_float'],
        ['Skucie: kucie + wylewka — znaczna pozycja kosztowa']),
      q('ft_q2', 'Czy próg między łazienką a korytarzem jest potrzebny?',
        'optional_detail', 'material', 'yes_no', ['tile_threshold'],
        ['Listwa progowa lub płytka']),
    ],
  },

  // ── 8. Wielki format (≥ 60×60 cm) ────────────────────────────────────────
  {
    triggerId: 'large_format',
    keywords: ['wielki format', 'wielkoformatow', 'large format', 'lf_', 'format 60x60', 'format 60×60', 'format 80', 'format 90', 'format 100', 'format 120', 'rektyfikowan'],
    preceding: [
      p('substrate_floor_leveling','Wyrównanie podłoża (wymagana płaskość dla WF ≤3mm/2m)','substrate',    'm2',   'required', 88, 'Wielki format wymaga wyższej płaskości podłoża'),
      p('substrate_grind_floor', 'Szlifowanie / odpylenie podłogi przed wielkim formatem', 'substrate',     'm2',   'required', 82),
    ],
    hidden: [
      p('lf_substrate_primer',  'Podkład wzmocniony pod wielki format',                    'large_format',  'm2',   'required', 88),
      p('lf_adhesive_premium',  'Klej klasy premium / elastyczny do WF',                   'large_format',  'm2',   'required', 88, 'Klej premium — koszt wyraźnie wyższy od standardu'),
      p('grout_floor',          'Fugowanie płytek WF (spoiny 1–2 mm)',                     'grouting',      'm2',   'required', 90),
      p('profile_expansion',    'Profile dylatacyjne (obowiązkowe przy WF)',               'profiles',      'mb',   'required', 85),
    ],
    conditional: [
      c('cut_complex',          'Docinki trudne (łuki, wcięcia, nieregularne krawędzie)', 'profiles',      'szt.', 'optional', 70,
        'Jeśli cięcia otworów lub nieregularne krawędzie w wielkim formacie',
        'Czy wielki format wymaga skomplikowanych docinek?'),
    ],
    structuredQuestions: [
      q('lf_q1', 'Czy podłoże ma wymagana płaszczyznowość (≤ 3 mm / 2 m) dla wielkoformatowych?',
        'critical_for_scope', 'scope', 'yes_no', ['substrate_floor_leveling'],
        ['Brak płaszczyznowości: wylewka lub szlifowanie — dodatkowa pozycja']),
      q('lf_q2', 'Czy spoiny mają być maksymalnie wąskie (rectified)?',
        'optional_detail', 'material', 'yes_no', ['grout_floor'],
        ['Rectified: wyższa dokładność cicia, spoiny 1–2 mm']),
    ],
  },

  // ── 9. Mozaika / dekor ────────────────────────────────────────────────────
  {
    triggerId: 'mosaic',
    keywords: ['mozaika', 'mozaik', 'siatka mozaikowa', 'płytki 2x2', 'płytki 5x5'],
    preceding: [
      p('substrate_floor_priming','Gruntowanie podłoża pod mozaikę',                        'substrate',     'm2',   'required', 85),
    ],
    hidden: [
      p('grout_walls',          'Fugowanie mozaiki',                                        'grouting',      'm2',   'required', 92),
      p('profile_edge',         'Listwy krawędziowe przy mozaice',                          'profiles',      'mb',   'likely',   72),
      p('seal_silicone',        'Silikonowanie styku mozaiki ze strefami mokrymi',          'silicone',      'mb',   'required', 85),
    ],
    conditional: [
      c('waterproof_wet',       'Hydroizolacja strefy mokrej pod mozaiką',                 'waterproofing', 'm2',   'required', 88,
        'Jeśli mozaika w strefie mokrej (prysznic, okolice wanny)',
        'Czy mozaika jest w strefie mokrej (prysznic, wanna)?'),
      c('cut_complex',          'Docinki mozaiki (niestandardowe wymiary)',                 'profiles',      'szt.', 'optional', 65,
        'Jeśli cięcia mozaiki wymagają pracy ręcznej',
        'Czy mozaika obejmuje całą powierzchnię czy tylko fragment/pas?'),
    ],
    structuredQuestions: [
      q('mo_q1', 'Czy mozaika jest w strefie mokrej (prysznic, wanna)?',
        'critical_for_scope', 'scope', 'yes_no', ['waterproof_wet'],
        ['W strefie mokrej: obowiązkowa hydroizolacja pod mozaiką']),
      q('mo_q2', 'Czy mozaika obejmuje całą powierzchnię czy tylko fragment/pas?',
        'important_for_accuracy', 'scope', 'single_choice', [],
        ['Wpływa na ilość m2 i złożoność fugowania']),
    ],
  },

  // ── 10. Ogrzewanie podłogowe ──────────────────────────────────────────────
  {
    triggerId: 'underfloor_heating',
    keywords: ['ogrzewanie podłogowe', 'ogrzewanie podlogowe', 'mata grzewcza', 'podłogówka', 'podlogowka', 'heating mat', 'underfloor heating'],
    preceding: [
      p('substrate_grind_floor','Szlifowanie podłoża przed matą grzewczą',                 'substrate',     'm2',   'required', 82),
    ],
    hidden: [
      p('screed_heated',        'Wylewka na ogrzewanie podłogowe',                         'screed',        'm2',   'required', 88, 'Wylewka musi schnąć min. 28 dni — uwzględnij w harmonogramie'),
    ],
    conditional: [
      c('underfloor_hydro',     'Pętla ogrzewania podłogowego wodnego',                    'underfloor',    'm2',   'optional', 70,
        'Jeśli ogrzewanie podłogowe wodne (nie elektryczne)',
        'Czy ogrzewanie podłogowe elektryczne czy wodne?'),
      c('underfloor_thermostat','Termostat podłogowy',                                     'underfloor',    'szt.', 'required', 88,
        'Jeśli ogrzewanie elektryczne — wymagany termostat',
        'Czy ogrzewanie elektryczne — wymagany termostat?'),
      c('elec_circuit_breaker', 'Zabezpieczenie obwodu elektrycznego ogrzewania',           'electrical',    'kpl.', 'optional', 65,
        'Jeśli brak dedykowanego obwodu elektrycznego',
        'Czy instalacja ma dedykowany obwód pod ogrzewanie podłogowe?'),
    ],
    structuredQuestions: [
      q('uh_q1', 'Czy ogrzewanie podłogowe elektryczne czy wodne?',
        'critical_for_scope', 'installation', 'single_choice', ['underfloor_hydro', 'underfloor_thermostat'],
        ['Elektryczne: termostat + obwód; wodne: pętla C.O. + przewód']),
      q('uh_q2', 'Czy mata grzewcza jest zakupiona przez klienta?',
        'optional_detail', 'material', 'yes_no', ['screed_heated'],
        ['Wpływa na materiał w wycenie']),
      q('uh_q3', 'Czy wylewka pod ogrzewanie jest uwzględniona w harmonogramie?',
        'important_for_accuracy', 'scope', 'yes_no', ['screed_heated'],
        ['Wylewka schnietnie min. 28 dni — krytyczne dla harmonogramu']),
    ],
  },

  // ── 11. Zabudowa kotła / bojlera ──────────────────────────────────────────
  {
    triggerId: 'boiler_casing',
    keywords: ['zabudowa kotła', 'zabudowa kotla', 'zabudowa bojlera', 'kocioł', 'bojler', 'obudowa kotła', 'obudowa kotla'],
    preceding: [],
    hidden: [
      p('gk_boiler_casing',     'Zabudowa kotła / bojlera (GK)',                           'drywall',       'kpl.', 'required', 90),
      p('gk_inspection',        'Rewizja serwisowa w zabudowie kotła',                     'drywall',       'szt.', 'required', 90, 'Wymagana normą — nie może być pominięta'),
    ],
    conditional: [
      c('tile_wall_full',       'Płytki ścienne na zabudowie kotła',                       'wall_tiling',   'm2',   'optional', 65,
        'Jeśli zabudowa kotła będzie obłożona płytką',
        'Czy zabudowa kotła ma być wykafelkowana?'),
    ],
    structuredQuestions: [
      q('bc_q1', 'Czy zabudowa kotła/bojlera ma być wykafelkowana czy malowana?',
        'important_for_accuracy', 'material', 'single_choice', ['tile_wall_full'],
        ['Kafelkowanie: dodatkowa pozycja płytek i kleju na zabudowie']),
      q('bc_q2', 'Czy rewizja serwisowa jest dostępna z zewnątrz zabudowy?',
        'critical_for_scope', 'installation', 'yes_no', ['gk_inspection'],
        ['Brak rewizji: niezgodne z normą — drzwiczki obowiązkowe']),
    ],
  },

  // ── 12. Zabudowa pionów ───────────────────────────────────────────────────
  {
    triggerId: 'pipe_casing',
    keywords: ['zabudowa pionów', 'zabudowa pionow', 'obudowa pionów', 'obudowa rur', 'chowanie pionów', 'piony kanalizacyjne'],
    preceding: [],
    hidden: [
      p('gk_pipe_casing',       'Zabudowa pionów instalacyjnych (GK)',                     'drywall',       'mb',   'required', 90),
      p('gk_inspection',        'Rewizja serwisowa / drzwiczki do pionów',                 'drywall',       'szt.', 'required', 88, 'Wymagana normą — dostęp serwisowy do pionów'),
      p('waterproof_tape',      'Taśma uszczelniająca przy zabudowie w strefie mokrej',    'waterproofing', 'mb',   'likely',   72),
    ],
    conditional: [
      c('tile_wall_full',       'Płytki ścienne na zabudowie pionów',                      'wall_tiling',   'm2',   'optional', 65,
        'Jeśli zabudowa pionów będzie wykafelkowana',
        'Czy zabudowa pionów ma być wykafelkowana?'),
    ],
    structuredQuestions: [
      q('pc_q1', 'Czy piony wymagają rewizji serwisowej?',
        'critical_for_scope', 'installation', 'yes_no', ['gk_inspection'],
        ['Drzwiczki rewizyjne w zabudowie GK — obowiązkowe per norma']),
      q('pc_q2', 'Czy zabudowa pionów wykafelkowana czy malowana?',
        'important_for_accuracy', 'material', 'single_choice', ['tile_wall_full'],
        ['Kafelkowanie: dodatkowa pozycja płytek i kleju']),
    ],
  },

  // ── 13. Sufit podwieszany ─────────────────────────────────────────────────
  {
    triggerId: 'suspended_ceiling',
    keywords: ['sufit podwieszany', 'sufit gk', 'sufit karton', 'podwieszany sufit', 'faux plafond', 'zabudowa sufitu'],
    preceding: [
      p('elec_lighting_points', 'Nowe punkty oświetleniowe w suficie',                     'electrical',    'szt.', 'likely',   80),
    ],
    hidden: [
      p('gk_ceiling',           'Sufit podwieszany GK',                                    'drywall',       'm2',   'required', 90),
      p('elec_fan',             'Montaż wentylatora łazienkowego w suficie',               'electrical',    'szt.', 'required', 85, 'Wentylator PRZED zamknięciem sufitu — kolejność krytyczna'),
      p('paint_ceiling',        'Malowanie sufitu GK',                                     'painting',      'm2',   'required', 88),
    ],
    conditional: [
      c('elec_lighting',        'Montaż opraw oświetleniowych LED / halogenów',            'electrical',    'szt.', 'likely',   78,
        'Jeśli planowane oświetlenie punktowe w suficie',
        'Czy w suficie podwieszanym będzie oświetlenie punktowe?'),
      c('vent_fan_exchange',    'Wymiana wentylatora / kanału wentylacyjnego',              'ventilation',   'szt.', 'optional', 65,
        'Jeśli wentylator w suficie wymaga nowego kanału',
        'Czy wentylacja mechaniczna wymaga nowego kanału wentylacyjnego?'),
    ],
    structuredQuestions: [
      q('sc_q1', 'Czy sufit podwieszany obejmuje całość pomieszczenia czy fragment?',
        'important_for_accuracy', 'scope', 'single_choice', ['gk_ceiling'],
        ['Całość vs fragment: wpływa na ilość m2 płyt GK']),
      q('sc_q2', 'Czy planowane jest oświetlenie punktowe w suficie?',
        'important_for_accuracy', 'electrical', 'yes_no', ['elec_lighting'],
        ['Oprawy punktowe: dodatkowe punkty elektryczne przed zamknięciem sufitu']),
      q('sc_q3', 'Czy wentylacja mechaniczna jest prowadzona przez sufit?',
        'important_for_accuracy', 'installation', 'yes_no', ['vent_fan_exchange'],
        ['Kanał wentylacyjny w suficie: układany przed zamknięciem']),
    ],
  },

  // ── 14. Lustro z oświetleniem ─────────────────────────────────────────────
  {
    triggerId: 'mirror_light',
    keywords: ['lustro z oświetleniem', 'lustro led', 'lustro podswietlan', 'podświetlane lustro', 'smart mirror', 'szafka lustrzana', 'mirror light'],
    preceding: [
      p('elec_lighting_points', 'Punkt elektryczny przy lustrze',                          'electrical',    'szt.', 'required', 85),
    ],
    hidden: [
      p('acc_mirror',           'Montaż lustra podświetlanego',                            'accessories',   'szt.', 'required', 90),
      p('elec_mirror_light',    'Podłączenie oświetlenia lustra',                          'electrical',    'szt.', 'required', 90),
    ],
    conditional: [
      c('elec_circuit_breaker', 'Zabezpieczenie obwodu elektrycznego',                     'electrical',    'kpl.', 'optional', 60,
        'Jeśli brak dedykowanego obwodu przy lustrze',
        'Czy gniazdko lub punkt elektryczny przy lustrze wymaga nowego obwodu?'),
    ],
    structuredQuestions: [
      q('ml_q1', 'Czy lustro ma wbudowane podgrzewanie anti-fog?',
        'optional_detail', 'material', 'yes_no', ['elec_circuit_breaker'],
        ['Anti-fog: większy pobór prądu — może wymagać dedykowanego obwodu']),
      q('ml_q2', 'Czy potrzebne gniazdko przy lustrze (np. do suszarki)?',
        'optional_detail', 'electrical', 'yes_no', ['elec_circuit_breaker'],
        ['Gniazdko: dodatkowy punkt elektryczny']),
    ],
  },

  // ── 15. Grzejnik drabinkowy / łazienkowy ─────────────────────────────────
  {
    triggerId: 'towel_radiator',
    keywords: ['grzejnik łazienkowy', 'grzejnik lazienkowy', 'drabinka grzewcza', 'suszarka na ręczniki', 'grzejnik drabinkowy'],
    preceding: [],
    hidden: [
      p('plumb_radiator',       'Montaż grzejnika łazienkowego / drabinki',                'plumbing',      'szt.', 'required', 90),
      p('seal_silicone',        'Silikonowanie przy grzejniku',                            'silicone',      'mb',   'likely',   70),
    ],
    conditional: [
      c('plumb_cold_point',     'Przeróbka punktu instalacji wodnej',                      'plumbing',      'szt.', 'optional', 65,
        'Jeśli lokalizacja grzejnika zmienia się względem obecnej',
        'Czy lokalizacja grzejnika ulega zmianie? (wymaga przeróbki instalacji)'),
      c('elec_underfloor',      'Elektryczna mata grzewcza (alternatywa)',                  'electrical',    'm2',   'optional', 50,
        'Jeśli grzejnik elektryczny (nie wodny)',
        'Czy grzejnik jest elektryczny czy podłączony do C.O.?'),
    ],
    structuredQuestions: [
      q('tr_q1', 'Czy grzejnik łazienkowy jest wodny (C.O.) czy elektryczny?',
        'critical_for_scope', 'installation', 'single_choice', ['plumb_cold_point', 'elec_underfloor'],
        ['Wodny: przerobka C.O.; elektryczny: obwód elektryczny']),
      q('tr_q2', 'Czy lokalizacja grzejnika zmienia się względem istniejącej?',
        'critical_for_scope', 'location', 'yes_no', ['plumb_cold_point', 'plumb_hot_point'],
        ['Zmiana lokalizacji: przeróbka punktów wodnych']),
    ],
  },

  // ── 16. Dwie umywalki / podwójny blat ────────────────────────────────────
  {
    triggerId: 'double_basin',
    keywords: ['dwie umywalki', 'podwójny blat', 'podwojny blat', 'double basin', 'double vanity', 'dwa stanowiska'],
    preceding: [
      p('plumb_cold_point',     'Dodatkowy punkt zimnej wody (2. umywalka)',               'plumbing',      'szt.', 'required', 88),
      p('plumb_hot_point',      'Dodatkowy punkt ciepłej wody (2. umywalka)',              'plumbing',      'szt.', 'required', 88),
    ],
    hidden: [
      p('plumb_basin_supply',   'Podejścia wodne do umywalek (×2)',                        'plumbing',      'szt.', 'required', 90),
      p('fit_basin_tap',        'Montaż baterii umywalkowych (×2)',                        'fittings',      'szt.', 'required', 90),
      p('seal_silicone',        'Silikonowanie styku umywalek z blatem',                   'silicone',      'mb',   'required', 88),
      p('plumb_points',         'Przeróbka punktów kanalizacyjnych (×2)',                  'plumbing',      'szt.', 'required', 85),
    ],
    conditional: [
      c('fix_double_basin',     'Montaż podwójnej umywalki / umywalek',                    'fixtures',      'szt.', 'required', 90,
        'Jeśli umywalki wpuszczane w blat lub nablatowe',
        'Czy umywalki są wpuszczane w blat czy wolnostojące?'),
    ],
    structuredQuestions: [
      q('db_q1', 'Czy obie umywalki są na tym samym blacie (double vanity) czy oddzielne?',
        'important_for_accuracy', 'installation', 'single_choice', ['fix_double_basin'],
        ['Blat wspólny: jedna pozycja montazu; oddzielne: dwie']),
      q('db_q2', 'Czy istniejąca instalacja wody wymaga rozbudowy do 2 punktów?',
        'critical_for_scope', 'scope', 'yes_no', ['plumb_cold_point', 'plumb_hot_point'],
        ['Rozbudowa: przełożenie rur + nowe punkty wody']),
    ],
  },

  // ── 17. Okno w łazience ───────────────────────────────────────────────────
  {
    triggerId: 'bathroom_window',
    keywords: ['okno w łazience', 'okno lazienkowe', 'glif okienny', 'parapet z płytki', 'obróbka okna', 'obrobka okna'],
    preceding: [
      p('tile_wall_window',     'Obróbka glifu okiennego — okładzina płytkowa',            'wall_tiling',   'mb',   'required', 85, 'Glif okienny — często pomijany w szybkiej wycenie'),
      p('tile_window_sill',     'Parapet / glif okienny z płytki',                         'profiles',      'mb',   'required', 85),
    ],
    hidden: [
      p('cut_complex',          'Docinki trudne przy oknie (łuki, wcięcia)',               'profiles',      'szt.', 'likely',   75),
      p('seal_silicone',        'Silikonowanie i uszczelnienie okna',                      'silicone',      'mb',   'required', 90),
    ],
    conditional: [
      c('elec_fan',             'Montaż wentylatora okiennego / kratki',                   'electrical',    'szt.', 'optional', 60,
        'Jeśli brak wentylacji mechanicznej — wymagany wentylator',
        'Czy łazienka ma wentylację mechaniczną czy tylko okno?'),
      c('vent_grille',          'Montaż kratki wentylacyjnej przy oknie',                  'ventilation',   'szt.', 'optional', 60,
        'Jeśli kratka wentylacyjna w okolicach okna',
        'Czy przy oknie potrzebna kratka wentylacyjna?'),
    ],
    structuredQuestions: [
      q('bw_q1', 'Czy okno będzie obłożone płytką (glif i parapet)?',
        'critical_for_scope', 'scope', 'yes_no', ['tile_wall_window', 'tile_window_sill'],
        ['Glif + parapet z płytki: dodatkowe pozycje okładzin i profili']),
      q('bw_q2', 'Czy parapet jest z płytki, konglomeratowy czy PVC?',
        'optional_detail', 'material', 'single_choice', [],
        ['Wybor materiału parapetu']),
    ],
  },
]

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Detects active triggers from a list of Polish labels (lowercase)
 * and optional clarification data from the guided form.
 */
export function detectBathroomTriggers(
  labels:         string[],
  clarification?: Record<string, unknown> | null,
): string[] {
  const found   = new Set<string>()
  const haystack = labels.map(l => l.toLowerCase()).join(' ')

  for (const def of TRIGGER_DEFS) {
    if (def.keywords.some(kw => haystack.includes(kw))) {
      found.add(def.triggerId)
    }
  }

  // Explicit flags from the guided-form clarification object (room engine)
  if (clarification) {
    if (clarification.has_linear_drain)               found.add('linear_drain')
    if (clarification.has_bathtub)                    found.add('bathtub')
    if (clarification.wc_type === 'concealed')        found.add('concealed_wc')
    if (clarification.has_underfloor_heating)         found.add('underfloor_heating')
    if (clarification.has_boiler_casing)              found.add('boiler_casing')
    // Walk-in: if shower confirmed AND linear drain OR walk-in keywords
    if (clarification.has_shower && (clarification.has_linear_drain || haystack.includes('walk'))) {
      found.add('walk_in_shower')
    }
  }

  return Array.from(found)
}

// ── Expansion ─────────────────────────────────────────────────────────────────

export interface ExpandResult {
  preceding:   InferredScopeItem[]
  hidden:      InferredScopeItem[]
  conditional: InferredScopeItem[]
  /** Structured questions sorted by severity: critical → important → optional */
  questions:   ClarificationQuestion[]
}

const SEVERITY_ORDER: Record<QuestionSeverity, number> = {
  critical_for_scope:     0,
  important_for_accuracy: 1,
  optional_detail:        2,
}

/**
 * Expands trigger IDs into dependency layers (preceding, hidden, conditional).
 * Deduplicates against existing library IDs already in the scope arrays.
 *
 * @param triggerIds      - Trigger IDs from detectBathroomTriggers()
 * @param existingIds     - Set of library_ids already present in scope arrays
 */
export function expandDependencies(
  triggerIds:  string[],
  existingIds: Set<string>,
): ExpandResult {
  const preceding:   Map<string, InferredScopeItem>    = new Map()
  const hidden:      Map<string, InferredScopeItem>    = new Map()
  const conditional: Map<string, InferredScopeItem>    = new Map()
  const questionMap: Map<string, ClarificationQuestion> = new Map()

  for (const id of triggerIds) {
    const def = TRIGGER_DEFS.find(t => t.triggerId === id)
    if (!def) continue

    for (const item of def.preceding) {
      if (!existingIds.has(item.library_id) && !preceding.has(item.library_id)) {
        preceding.set(item.library_id, { ...item, provenance: 'dependency_inferred' })
      }
    }

    for (const item of def.hidden) {
      if (!existingIds.has(item.library_id) && !preceding.has(item.library_id) && !hidden.has(item.library_id)) {
        hidden.set(item.library_id, { ...item, provenance: 'dependency_inferred' })
      }
    }

    for (const item of def.conditional) {
      if (!existingIds.has(item.library_id) && !preceding.has(item.library_id) && !hidden.has(item.library_id) && !conditional.has(item.library_id)) {
        const { condition: _c, confirmQuestion, ...base } = item
        conditional.set(item.library_id, {
          ...base,
          provenance: 'confirmation_needed',
          notes: item.notes ? `${item.notes} — ${item.condition}` : item.condition,
        })
      }
    }

    for (const sq of def.structuredQuestions) {
      if (!questionMap.has(sq.id)) {
        questionMap.set(sq.id, {
          id:             sq.id,
          text:           sq.text,
          severity:       sq.severity,
          category:       sq.category,
          answerType:     sq.answerType,
          relatedTrigger: def.triggerId,
          relatedTaskIds: sq.relatedTaskIds,
          affects:        sq.affects,
          options:        QUESTION_OPTIONS[sq.id],
          source:         'dependency_rule',
        })
      }
    }
  }

  const sortedQuestions = Array.from(questionMap.values())
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  return {
    preceding:   Array.from(preceding.values()),
    hidden:      Array.from(hidden.values()),
    conditional: Array.from(conditional.values()),
    questions:   sortedQuestions,
  }
}

/**
 * Returns true when the space/room type is bathroom-related.
 * Guards against running expansion on non-bathroom spaces.
 */
export function isBathroomSpace(spaceType: string | null | undefined): boolean {
  if (!spaceType) return false
  const s = spaceType.toLowerCase()
  return s.includes('łazienk') || s.includes('lazienk') || s.includes('bathroom')
    || s.includes(' wc') || s === 'wc' || s.includes('natrysk')
}
