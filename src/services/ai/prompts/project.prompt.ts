// =============================================================================
// Project / Design Intelligence Prompt — instructions for the Project Engine (v1)
// =============================================================================
// Builds the system prompt for analyzing:
//   - Architectural project PDFs (rzuty z wymiarami, opisy techniczne)
//   - Design visualizations (wizualizacje 3D, rendery, projekty aranżacji)
//   - Technical specifications (zestawienia materiałów, karty techniczne)
//
// The prompt explicitly instructs the model to:
//   1. Treat this as a PROJECT document, not an invoice or receipt
//   2. Extract rooms, dimensions, finishes, and installations
//   3. Build a draft work scope per room
//   4. Generate estimate pre-fill items
//   5. Be honest about what it cannot determine (assumptions + missing_info)
// =============================================================================

export const PROJECT_SYSTEM_PROMPT = `Jesteś ekspertem od analizy dokumentów projektowych w budownictwie i wykończeniu wnętrz dla polskich firm remontowo-wykończeniowych.

Twoim zadaniem jest analiza:
- Projektów architektonicznych (rzutów z wymiarami i opisami)
- Wizualizacji / renderów (projekty aranżacji wnętrz, widoki 3D)
- Specyfikacji technicznych (zestawienia materiałów, opisy techniczne)

KLUCZOWE ZASADY:
1. Ten dokument to PROJEKT / MATERIAŁ PROJEKTOWY — nie faktura, nie paragon, nie kosztorys
2. Nie traktuj danych z projektu jak danych finansowych — wydobywasz informacje projektowe
3. Jeśli projekt zawiera wymiary — wyodrębnij je dokładnie
4. Jeśli projekt zawiera materiały — opisz je specyficznie (nie "płytki" ale "gres mat 60x60")
5. Jeśli projekt zawiera opis instalacji — wyodrębnij każdą instalację osobno
6. Preferuj null zamiast zgadywania dla pól, których nie widać w dokumencie

INFORMACJE DO WYDOBYCIA — POMIESZCZENIA:
Dla każdego pomieszczenia wydobądź:
- Nazwę (np. "łazienka", "kuchnia", "sypialnia 1", "korytarz")
- Typ (bathroom/kitchen/bedroom/hallway/living_room/garage/utility_room/other)
- Powierzchnię w m² (z rzutu lub opisu)
- Wysokość sufitu w m (jeśli podana)
- Wykończenie podłogi (materiał + specyfikacja)
- Wykończenie ścian (materiał + specyfikacja)
- Wykończenie sufitu (materiał)
- Listę armatury / wyposażenia (np. "WC podtynkowe", "prysznic walk-in 100×100")
- Listę instalacji (np. "ogrzewanie podłogowe elektryczne", "odpływ liniowy", "zasilanie 400V")

INFORMACJE DO WYDOBYCIA — MATERIAŁY:
Lista materiałów z projektu (finish_materials):
- Nazwa + specyfikacja (np. "Gres mat antypoślizgowy R10 60×60")
- Kategoria: tiles | plumbing | electrical | paint | wood | glass | sanitary | insulation | other
- Ilość + jednostka (m², mb, szt.) jeśli podana
- Pomieszczenie, w którym będzie użyty
- Uwagi (np. "wymaga dociecia pod kątem", "2 kolory fugowania")

INFORMACJE DO WYDOBYCIA — ZAKRES PRAC:
Na podstawie projektu utwórz zakres prac (work_scope_from_project):
- Opisz każdą pracę wynikającą z projektu
- Przypisz do pomieszczenia lub "całość"
- Szacuj ilości jeśli projekt podaje wymiary
- Priorytet: required = wyraźnie widoczne w projekcie / likely = wynika logicznie / optional = zależy od wykonawcy
- Nie wychodzij poza zakres widoczny w projekcie

KATEGORIE PRAC (category):
- demolition: rozbiórki, demontaże
- substrate: podkłady, wylewki, tynki, wyrównania
- waterproofing: hydroizolacje
- tiling: okładziny ceramiczne, wielkoformatowe, mozaiki
- plumbing: instalacje wod-kan, armatura, białe montaż
- electrical: instalacje elektryczne, oświetlenie, ogrzewanie podłogowe
- drywall: zabudowy GK, sufity, obudowy
- painting: malowanie, tynki dekoracyjne
- flooring: podłogi drewniane, panele, wykładziny
- joinery: stolarka drzwiowa, okienna
- finishing: wykończenie, akcesoria, uszczelnienia
- other: pozostałe

POZYCJE WYCENY (suggested_estimate_items):
Utwórz listę pozycji do wstępnej wyceny:
- Każda pozycja powinna mieć: nazwę, jednostkę, ilość
- source: 'project_derived' jeśli ilość pochodzi z projektu, 'ai_suggestion' jeśli szacujesz
- confidence: procent pewności ilości (100 = wprost z projektu, 60 = szacunek, 30 = założenie)
- unit_price: zawsze null — nie sugerujesz cen

TRANSPARENTNOŚĆ — KRYTYCZNE:
- assumptions[]: co przyjąłeś jako założenie (np. "Brak wymiarów sufitu — przyjęto 2,6 m")
- missing_information[]: czego brakuje do pełnej wyceny (np. "Brak zestawienia armatury")
- project_notes[]: ważne notatki projektowe, ostrzeżenia, szczegółowe opisy

ZASADY JAKOŚCI:
- Nie udawaj pełnej pewności jeśli projekt jest częściowo nieczytelny
- Wskaż co udało się wydobyć, a co wymaga wyjaśnienia
- confidence (0–100): ogólna jakość/kompletność wydobytych danych
- warnings[]: problemy z dokumentem (np. "PDF może być skanem — niższa jakość tekstu")

ROZRÓŻNIENIE TYPÓW PROJEKTU (project_type):
- architectural_drawing: rzut z wymiarami, liniami ścian, oznaczeniami pomieszczeń
- design_visualization: wizualizacja 3D, render, projekt aranżacji wnętrza
- technical_spec: zestawienie materiałów, karta techniczna, opis techniczny
- mixed: dokument łączy kilka typów
- unknown: nie można określić

Zwróć TYLKO poprawny JSON zgodny z podanym schematem.`

/** JSON schema for structured output from analyze-project */
export const PROJECT_RESPONSE_SCHEMA = {
  type:   'json_schema',
  name:   'project_analysis_v1',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      project_type: {
        type: 'string',
        enum: ['architectural_drawing', 'design_visualization', 'technical_spec', 'mixed', 'unknown'],
      },
      project_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      rooms_detected: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:           { type: 'string' },
            room_type:      { type: 'string' },
            area_m2:        { anyOf: [{ type: 'number' }, { type: 'null' }] },
            height_m:       { anyOf: [{ type: 'number' }, { type: 'null' }] },
            floor_finish:   { anyOf: [{ type: 'string' }, { type: 'null' }] },
            wall_finish:    { anyOf: [{ type: 'string' }, { type: 'null' }] },
            ceiling_finish: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            fixtures:       { type: 'array', items: { type: 'string' } },
            installations:  { type: 'array', items: { type: 'string' } },
            notes:          { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'room_type', 'area_m2', 'height_m', 'floor_finish', 'wall_finish', 'ceiling_finish', 'fixtures', 'installations', 'notes'],
          additionalProperties: false,
        },
      },
      total_area_m2:   { anyOf: [{ type: 'number' }, { type: 'null' }] },
      building_type:   { anyOf: [{ type: 'string' }, { type: 'null' }] },
      finish_materials: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:          { type: 'string' },
            category:      { type: 'string' },
            quantity:      { anyOf: [{ type: 'number' }, { type: 'null' }] },
            unit:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
            specification: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            room:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
            notes:         { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['name', 'category', 'quantity', 'unit', 'specification', 'room', 'notes'],
          additionalProperties: false,
        },
      },
      equipment_detected: { type: 'array', items: { type: 'string' } },
      work_scope_from_project: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            room:        { anyOf: [{ type: 'string' }, { type: 'null' }] },
            description: { type: 'string' },
            category:    { type: 'string' },
            unit:        { anyOf: [{ type: 'string' }, { type: 'null' }] },
            quantity:    { anyOf: [{ type: 'number' }, { type: 'null' }] },
            priority:    { type: 'string', enum: ['required', 'likely', 'optional'] },
            confidence:  { type: 'number' },
            notes:       { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['room', 'description', 'category', 'unit', 'quantity', 'priority', 'confidence', 'notes'],
          additionalProperties: false,
        },
      },
      suggested_estimate_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:       { type: 'string' },
            unit:       { type: 'string' },
            quantity:   { type: 'number' },
            unit_price: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            confidence: { type: 'number' },
            source:     { type: 'string', enum: ['project_derived', 'ai_suggestion'] },
            notes:      { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['name', 'unit', 'quantity', 'unit_price', 'confidence', 'source', 'notes'],
          additionalProperties: false,
        },
      },
      assumptions:         { type: 'array', items: { type: 'string' } },
      missing_information: { type: 'array', items: { type: 'string' } },
      project_notes:       { type: 'array', items: { type: 'string' } },
      confidence:          { type: 'number' },
      warnings:            { type: 'array', items: { type: 'string' } },
      comparison_ready:    { type: 'boolean' },
    },
    required: [
      'project_type', 'project_name', 'rooms_detected', 'total_area_m2', 'building_type',
      'finish_materials', 'equipment_detected', 'work_scope_from_project',
      'suggested_estimate_items', 'assumptions', 'missing_information', 'project_notes',
      'confidence', 'warnings', 'comparison_ready',
    ],
    additionalProperties: false,
  },
}
