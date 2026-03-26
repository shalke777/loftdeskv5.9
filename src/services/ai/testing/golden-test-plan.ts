// =============================================================================
// golden-test-plan.ts — AI Reliability Framework v1 — Golden Test Plan
// =============================================================================
// Defines the expected reliability behaviour for reference input specimens.
//
// Purpose:
//   - Regression guard: if a new prompt / model output changes, these cases
//     show which reliability transitions occurred.
//   - Onboarding: new developers can read these cases to understand the
//     quality-control thresholds without reading all validator code.
//   - Manual-test checklist supplement: QA can use these as acceptance criteria.
//
// Status codes (expected_state):
//   strong  — gold-standard input, no issues
//   partial — typical real-world input with minor gaps
//   weak    — low-quality or incomplete input
//   blocked — invalid data that must not pass to estimate handoff
//
// How to use:
//   1. Run the engine on a specimen file (manual or automated).
//   2. Call the appropriate computeXxxReliability(result).
//   3. Assert result.state === expected_state.
//   4. Assert each code in expected_issue_codes is present in result.issues[].code.
//   5. Assert result.confidence is within [min_confidence, max_confidence].
// =============================================================================

export type GoldenTestEngine = 'document' | 'room' | 'project' | 'comparison'

export interface GoldenTestCase {
  id:            string
  engine:        GoldenTestEngine
  /** Short human-readable description of the specimen */
  description:   string
  /** Why this case matters — what edge/scenario it tests */
  scenario:      string
  /** Expected reliability state after validation */
  expected_state: 'strong' | 'partial' | 'weak' | 'blocked'
  /** All issue codes expected to appear (subset match — others may also appear) */
  expected_issue_codes: string[]
  /** No issue code in this list should appear */
  forbidden_issue_codes: string[]
  /** Expected confidence range from the engine output */
  min_confidence: number
  max_confidence: number
  /**
   * Path to specimen file relative to src/services/ai/testing/specimens/.
   * null = synthetic (construct artificially in tests).
   */
  specimen_file: string | null
}

// ── Document engine golden cases ──────────────────────────────────────────────

export const DOCUMENT_GOLDEN_CASES: GoldenTestCase[] = [
  {
    id: 'DOC-001',
    engine: 'document',
    description: 'Faktura VAT — kompletna z NIP sprzedawcy i nabywcy',
    scenario: 'Ideal input: full VAT invoice with proper arithmetic, both parties, line items.',
    expected_state: 'strong',
    expected_issue_codes: [],
    forbidden_issue_codes: [
      'ARITHMETIC_MISMATCH', 'IMPOSSIBLE_AMOUNT', 'NEGATIVE_AMOUNT',
      'GROSS_MISSING', 'MISSING_NIP_SELLER', 'MISSING_NIP_BUYER',
    ],
    min_confidence: 70,
    max_confidence: 100,
    specimen_file: 'doc_vat_full.pdf',
  },
  {
    id: 'DOC-002',
    engine: 'document',
    description: 'Faktura VAT — brak NIP nabywcy (faktury uproszczone ≤450 PLN)',
    scenario: 'Common case: invoice without buyer NIP. Should be partial, not blocked.',
    expected_state: 'partial',
    expected_issue_codes: ['MISSING_NIP_BUYER'],
    forbidden_issue_codes: ['ARITHMETIC_MISMATCH', 'IMPOSSIBLE_AMOUNT'],
    min_confidence: 55,
    max_confidence: 85,
    specimen_file: 'doc_vat_no_nip_buyer.pdf',
  },
  {
    id: 'DOC-003',
    engine: 'document',
    description: 'Paragon fiskalny — netto+VAT nie zgadza się z brutto',
    scenario: 'Critical failure: arithmetic mismatch. Must block estimate handoff.',
    expected_state: 'blocked',
    expected_issue_codes: ['ARITHMETIC_MISMATCH'],
    forbidden_issue_codes: [],
    min_confidence: 0,
    max_confidence: 100,
    specimen_file: null, // synthetic: DocumentAnalysisResult with net=100, vat=23, gross=150
  },
  {
    id: 'DOC-004',
    engine: 'document',
    description: 'Faktura — kwota netto wyższa niż brutto',
    scenario: 'Critical failure: net > gross. Impossible amount. Must block.',
    expected_state: 'blocked',
    expected_issue_codes: ['IMPOSSIBLE_AMOUNT'],
    forbidden_issue_codes: [],
    min_confidence: 0,
    max_confidence: 100,
    specimen_file: null, // synthetic: amounts.net = 200, amounts.gross = 100
  },
  {
    id: 'DOC-005',
    engine: 'document',
    description: 'Słabe zdjęcie faktury — niski confidence, brak brutto',
    scenario: 'Practical case: blurry photo, confidence < 40, gross not extracted.',
    expected_state: 'weak',
    expected_issue_codes: ['GROSS_MISSING'],
    forbidden_issue_codes: ['ARITHMETIC_MISMATCH'],
    min_confidence: 0,
    max_confidence: 39,
    specimen_file: 'doc_blurry_receipt.jpg',
  },
  {
    id: 'DOC-006',
    engine: 'document',
    description: 'Paragon z datą wystawienia w przyszłości (błąd OCR)',
    scenario: 'Date sanity: AI misread a date as future date. Should be warning only.',
    expected_state: 'partial',
    expected_issue_codes: ['FUTURE_ISSUE_DATE'],
    forbidden_issue_codes: ['ARITHMETIC_MISMATCH', 'IMPOSSIBLE_AMOUNT'],
    min_confidence: 40,
    max_confidence: 80,
    specimen_file: null, // synthetic: issue_date = 2 months from now
  },
]

// ── Room engine golden cases ───────────────────────────────────────────────────

export const ROOM_GOLDEN_CASES: GoldenTestCase[] = [
  {
    id: 'ROOM-001',
    engine: 'room',
    description: 'Łazienka przed remontem — wszystkie strefy wykryte',
    scenario: 'Full bathroom analysis: before_renovation stage, wet zone, demolition in scope.',
    expected_state: 'strong',
    expected_issue_codes: [],
    forbidden_issue_codes: [
      'ZERO_REQUIRED_SCOPE', 'ZERO_OBSERVED_ELEMENTS',
      'WATERPROOFING_EXPECTED', 'MISSING_DEMOLITION',
    ],
    min_confidence: 70,
    max_confidence: 100,
    specimen_file: 'room_bathroom_before.jpg',
  },
  {
    id: 'ROOM-002',
    engine: 'room',
    description: 'Łazienka — wykryto prysznic, brak hydroizolacji w zakresie',
    scenario: 'Missing prerequisite: wet zone present, waterproofing absent from scope.',
    expected_state: 'partial',
    expected_issue_codes: ['WATERPROOFING_EXPECTED'],
    forbidden_issue_codes: ['ZERO_REQUIRED_SCOPE'],
    min_confidence: 40,
    max_confidence: 85,
    specimen_file: null, // synthetic: observed=['prysznic'], scope without waterproofing
  },
  {
    id: 'ROOM-003',
    engine: 'room',
    description: 'Zdjęcie bardzo ciemne — brak wykrytych elementów',
    scenario: 'Low quality photo: no elements detected, confidence < 40.',
    expected_state: 'weak',
    expected_issue_codes: ['ZERO_OBSERVED_ELEMENTS'],
    forbidden_issue_codes: [],
    min_confidence: 0,
    max_confidence: 39,
    specimen_file: 'room_dark_unusable.jpg',
  },
  {
    id: 'ROOM-004',
    engine: 'room',
    description: 'Stan przed remontem — brak prac rozbiórkowych w zakresie',
    scenario: 'Prerequisite check: before_renovation stage without demolition scope.',
    expected_state: 'partial',
    expected_issue_codes: ['MISSING_DEMOLITION'],
    forbidden_issue_codes: [],
    min_confidence: 50,
    max_confidence: 80,
    specimen_file: null,
  },
]

// ── Project engine golden cases ───────────────────────────────────────────────

export const PROJECT_GOLDEN_CASES: GoldenTestCase[] = [
  {
    id: 'PROJ-001',
    engine: 'project',
    description: 'Projekt budowlany — pełne dane, wiele pomieszczeń, kosztorys',
    scenario: 'Complete project document: rooms, scope, estimate items, comparison_ready.',
    expected_state: 'strong',
    expected_issue_codes: [],
    forbidden_issue_codes: [
      'ZERO_SCOPE_ITEMS', 'ZERO_ESTIMATE_ITEMS', 'ZERO_ROOMS', 'ALL_LOW_CONFIDENCE',
    ],
    min_confidence: 70,
    max_confidence: 100,
    specimen_file: 'project_full_renovation.pdf',
  },
  {
    id: 'PROJ-002',
    engine: 'project',
    description: 'Ogólny opis projektu — brak kosztorysu AI',
    scenario: 'Prose-only project: scope derived but no estimate items generated.',
    expected_state: 'partial',
    expected_issue_codes: ['ZERO_ESTIMATE_ITEMS'],
    forbidden_issue_codes: ['ZERO_SCOPE_ITEMS'],
    min_confidence: 40,
    max_confidence: 70,
    specimen_file: 'project_description_only.pdf',
  },
  {
    id: 'PROJ-003',
    engine: 'project',
    description: 'Nieczytelny skan projektu — brak danych',
    scenario: 'Empty result: no rooms, no scope, confidence < 40.',
    expected_state: 'weak',
    expected_issue_codes: ['ZERO_SCOPE_ITEMS', 'ZERO_ESTIMATE_ITEMS', 'ZERO_ROOMS'],
    forbidden_issue_codes: [],
    min_confidence: 0,
    max_confidence: 39,
    specimen_file: 'project_unreadable_scan.pdf',
  },
]

// ── Comparison engine golden cases ────────────────────────────────────────────

export const COMPARISON_GOLDEN_CASES: GoldenTestCase[] = [
  {
    id: 'CMP-001',
    engine: 'comparison',
    description: 'Dobry projekt + dobre zdjęcia — wysoka zgodność',
    scenario: 'Best case: both inputs high-confidence, >70% matching diffs.',
    expected_state: 'strong',
    expected_issue_codes: [],
    forbidden_issue_codes: ['HIGH_UNCERTAIN_RATIO', 'NO_COMPARABLE_DATA'],
    min_confidence: 70,
    max_confidence: 100,
    specimen_file: null,
  },
  {
    id: 'CMP-002',
    engine: 'comparison',
    description: 'Porównanie — >50% wyników niepewnych',
    scenario: 'High uncertainty ratio: data mismatch or low-quality photos.',
    expected_state: 'partial',
    expected_issue_codes: ['HIGH_UNCERTAIN_RATIO'],
    forbidden_issue_codes: ['NO_COMPARABLE_DATA'],
    min_confidence: 30,
    max_confidence: 65,
    specimen_file: null,
  },
  {
    id: 'CMP-003',
    engine: 'comparison',
    description: 'Porównanie bez danych — pusty wynik',
    scenario: 'No diffs found, no scope additions: mismatched project/room inputs.',
    expected_state: 'weak',
    expected_issue_codes: ['NO_COMPARABLE_DATA'],
    forbidden_issue_codes: [],
    min_confidence: 0,
    max_confidence: 39,
    specimen_file: null, // synthetic: result.diffs = [], scope_additions = []
  },
]

// ── All cases ─────────────────────────────────────────────────────────────────

export const ALL_GOLDEN_CASES: GoldenTestCase[] = [
  ...DOCUMENT_GOLDEN_CASES,
  ...ROOM_GOLDEN_CASES,
  ...PROJECT_GOLDEN_CASES,
  ...COMPARISON_GOLDEN_CASES,
]
