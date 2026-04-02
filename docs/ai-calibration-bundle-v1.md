# AI Engine — Kalibracja bundle projektowego v1

**Źródło**: 6 PDF-ów ze studia „na miarę mieszkania" (Katarzyna Kluza, NIP 6772464300, Kraków)  
**Data kalibracji**: 2025-04  
**Scope**: P1 Composite Project Analysis engine — źródła, warstwy, wydobycie, fuzja, confidence  

---

## Spis treści

1. Charakterystyka bundli
2. Mapa warstw dokumentu
3. Tabela: warstwa → source_role → trust → priority
4. Klasyfikacja: MUST USE / SUPPORTING / LOW VALUE / OUT OF SCOPE
5. Guidance ekstrakcji per warstwa
6. Przykłady evidence schema (JSON)
7. Reguły fuzji źródeł
8. Uzupełnienia rule pack (`bundle.types.ts`)
9. Split P0 vs P1

---

## 1. Charakterystyka bundli kalibracyjnych

| Plik | Str. | Typ obiektu | Lokalizacja | Uwagi |
|---|---|---|---|---|
| BANACHA_projekt wykonawczy.pdf | 38 | Mieszkanie | Kraków / Banacha B1-M64 | Referencyjny — pełna struktura |
| BOCHENKA_projekt wykonawczy.pdf | 49 | Mieszkanie nowe (deweloper) | Kraków / Bochenka VITA III/F/01 | Wytyczne budowlane z protokołem zmian lokatora |
| BUDZÓW_projekt wykonawczy.pdf | 55 | Dom (parter + poddasze + piwnica) | Budzów | 3 kondygnacje, schody, szynoprzewód |
| MOGILSKA_projekt wykonawczy.pdf | 58 | Mieszkanie duże | Kraków / Mogilska | Legenda elektryki na osobnej stronie |
| SKAWINA_projekt wykonawczy.pdf | 60 | Dom (parter + piętro) | Skawina / Ogrody | 2 kondygnacje, H sufitu = 319 cm, szklana ściana loft |
| Jankowicz_Natalia_1.pdf | 7 | — | — | **Czyste wizualizacje** łazienki. Brak rysunków technicznych. Odrębny typ bundla. |

**Kluczowe obserwacje:**
- Projekty 1–5 to „projekt wykonawczy" z identycznym templatem studia (stopka: projektant, UWAGI, INWESTYCJA, TYTUŁ RYS., NAZWA POMIESZCZENIA, SKALA, NUMER RYS., DATA, RODZAJ RYSUNKU)
- Jankowicz to wyłącznie pack wizualizacyjny — NIE zawiera warstw technicznych
- Domy (BUDZÓW, SKAWINA) mają warstwy nieobecne w mieszkaniach: inwentaryzacja, schody, „pomieszczenia nieobjęte projektem"
- **Żaden PDF nie zawiera zbiorczego arkusza materiałów z ilościami i cenami** — ilości są rozproszone per rysunek

---

## 2. Mapa warstw dokumentu

Warstwy ułożone w kolejności pojawiania się w PDF-ie (numeracja rysunków studia):

| Nr rys. | Kod warstwy | Tytuł na rysunku | Skala | Dostępność |
|---|---|---|---|---|
| — | `title_page` | PROJEKT WYKONAWCZY [inwestycja] | — | WSZYSTKIE projekty we. |
| — | `visualization_3d` | Wizualizacje / nazwa pomieszczenia | — | WSZYSTKIE |
| O1 / O2 | `survey_existing` | Stan zastany – inwentaryzacja | 1:50 | Tylko domy (BUDZÓW, SKAWINA) |
| 1 | `functional_layout` | Układ funkcjonalny | 1:50 | WSZYSTKIE (często p02–03) |
| 2A / 2B | `structural_guidelines` | Wytyczne budowlane – ściany/zabudowy | 1:50 | BOCHENKA, BUDZÓW (nowe budownictwo i domy) |
| 3 (legenda) | `electrical_legend` | Legenda rysunków elektrycznych | — | MOGILSKA (osobna), pozostałe inline |
| 3A / 3A1 | `electrical_lighting` | Punkty elektryczne – oświetlenie | 1:50 | WSZYSTKIE |
| 3B / 3B1 | `electrical_sockets` | Punkty elektryczne – gniazdka | 1:50 | WSZYSTKIE |
| 4A / 4B | `plumbing_wod_kan` | Instalacje sanitarne wod-kan | 1:50 | WSZYSTKIE |
| 5 / 5A / 5B | `floor_coverings` | Okładziny podłogowe | 1:50 | WSZYSTKIE |
| 6x (ogólna) | `wall_coverings` | Okładziny ścienne / farby | 1:50 | WSZYSTKIE |
| 6A–6N | `wall_elevations` | Wybrane widoki ścian | 1:50 | WSZYSTKIE |
| 7x | `tile_layout` | Projekt glazury łazienki / WC | 1:25–1:50 | Projekty z łazienkami |
| 8x | `ceiling_plan` | Sufity podwieszane / oświetlenie sufitowe | 1:50 | Tam gdzie są sufity |
| 9A–9N | `furniture_drawing` | Projekt mebla / zabudowy | 1:20 | WSZYSTKIE — wiele rysunków per projekt |
| 10A | `staircase_design` | Koncepcja schodów | 1:30 | Tylko domy (BUDZÓW rys.11B, SKAWINA) |
| 11A | `glazing_door_detail` | Projekt przeszklenia / drzwi specjalnych | 1:20 | SKAWINA (szklana ściana loft) |
| Detale | `construction_detail` | Detale A, B, C (połączenia, wnęki) | 1:10–1:20 | Wybrane projekty |

---

## 3. Tabela: warstwa → source_role → trust → priority

| Kod warstwy | source_role | trust_level | source_priority | confidence_cap | Uwagi |
|---|---|---|---|---|---|
| `title_page` | metadata | informational | 50 | — | Tylko identyfikacja projektu |
| `visualization_3d` | design_intent | low | 20 | 0.55 | Disclaimer na każdej str.: „nie jest przełożeniem 1:1 do rzeczywistości" |
| `survey_existing` | factual_baseline | high | 5 | 0.92 | Inwentaryzacja = stan zastany = fakty przed projektem |
| `functional_layout` | spatial_reference | high | 8 | 0.90 | Rzut z wymiarami pomieszczeń — podstawa przestrzenna |
| `structural_guidelines` | scope_definition | high | 6 | 0.90 | Definiuje zakres prac budowlanych (ściany, drzwi) |
| `electrical_legend` | reference | informational | 3 | — | Musi być sparsowana przed electrical_lighting / _sockets |
| `electrical_lighting` | technical_spec | high | 7 | 0.92 | Ilości punktów + pełne nazwy lamp handlowych |
| `electrical_sockets` | technical_spec | high | 7 | 0.92 | Gniazdka — typy i pozycje |
| `plumbing_wod_kan` | technical_spec | high | 7 | 0.90 | Osie przyłączy, wysokości (H=75, H=105, H=130) |
| `floor_coverings` | material_spec | very_high | 5 | 0.95 | Ilość m² i mb podana wprost, pełne kody produktów |
| `wall_coverings` | material_spec | high | 8 | 0.88 | Kolory NCS/RAL, tapety, okładziny per pomieszczenie |
| `wall_elevations` | material_spec | very_high | 6 | 0.93 | Najbogatsze źródło spec ściany — tapeta + panele + lustro + drzwi |
| `tile_layout` | material_spec | very_high | 5 | 0.95 | Format płytek (cm), układ (pionowy/poziomy), obszar |
| `ceiling_plan` | technical_spec | high | 8 | 0.88 | Sufit podwieszany TYP 1/2, profil, sposób zabudowy |
| `furniture_drawing` | material_spec | very_high | 4 | 0.96 | Wymiary mm, kody materiałowe (Pfleiderer), nazwy okuć (IKEA name+mm) |
| `staircase_design` | technical_spec | high | 7 | 0.88 | Materiał stopni, LED spec, poręcz |
| `glazing_door_detail` | technical_spec | high | 6 | 0.90 | Profile aluminium, grubość szkła, dim mm |
| `construction_detail` | technical_spec | medium | 10 | 0.85 | Detale specjalne — wnęki, połączenia |

---

## 4. Klasyfikacja MUST USE / SUPPORTING / LOW VALUE / OUT OF SCOPE

### MUST USE
Warstwy, bez których analiza jest niepełna lub niskiej wiarygodności:

- `survey_existing` — dla domów: dostarcza bazowe wymiary pomieszczeń, H sufitu
- `functional_layout` — dla wszystkich: siatka przestrzenna do cross-reference
- `electrical_lighting` — lista lampek z modelami = zakres elektryczny
- `electrical_sockets` — typy i pozycje gniazdek = zakres elektryczny
- `plumbing_wod_kan` — pozycje przyłączy = zakres sanitarny
- `floor_coverings` — m² i mb produkty = zakres posadzkowy z ilościami
- `wall_elevations` — spec materiałów ściennych na pomieszczenie
- `furniture_drawing` — wymiary i materiały mebli = zakres stolarski
- `tile_layout` — spec płytek łazienkowych

### SUPPORTING
Warstwy wartościowe, ale wymagające ostrożności:

- `visualization_3d` — pomaga zidentyfikować pokój / układ gdy rzut nieczytelny, ale NIE jest źródłem wymiarów ani ilości
- `structural_guidelines` — MUST USE dla nowych budynków / domów; SUPPORTING dla remontów
- `wall_coverings` — często zdublowane informacjami z `wall_elevations`; przydatne do cross-check
- `ceiling_plan` — ważne gdy jest sufit podwieszany, zbędne gdy nie ma
- `electrical_legend` — niezbędna jako kontekst parsowania, ale sama nie dostarcza danych projektowych
- `construction_detail` — rozszerza precyzję ale rzadko zmienia zakres

### LOW VALUE (dla celów wyceny przez AI)
- `title_page` — tylko metadane (projekt, adres, NIP studia)
- `staircase_design` — wysoce specyficzne, trudne do generycznej ekstrakcji wartości
- `glazing_door_detail` — wysoce specyficzne, zakres narrow

### OUT OF SCOPE
- Czyste paki wizualizacyjne bez rysunków technicznych (typ Jankowicz) — `document_type: visualization_pack` — nie są bundlem wykonawczym

---

## 5. Guidance ekstrakcji per warstwa

### 5.1 `electrical_lighting` — Extraction guidance

**Co wydobywać:**
- `lighting_points_count` — liczba symboli wypustu sufitowego/ściennego/w suficie podwieszanym per pomieszczenie
- `switch_height_cm` — z pola WYSOKOŚĆ WŁĄCZNIKÓW (np. 110, 120 lub "zgodnie ze stanem istniejącym")
- `fixture_list` — z WYKAZ LAMP: numer → opis handlowy (marka, model, numer katalogowy)
- `led_tape_color_temperature` — z uwag (globalny wymóg: "tylko 3000K" lub "biała ciepła")
- `zone_count` — liczba stref oświetleniowych (1/2 na legendzie)

**Pułapki:**
- Numery na rzucie odnoszą się do WYKAZ LAMP — nie wyciągaj liczb bez korelacji z listą
- "Oświetlenie meblowe: podszafkowe i witryny" → nie ma osobnego punktu na rzucie, to element zabudowy
- MOGILSKA ma legendę elektryki na oddzielnej stronie przed rzutem — parsuj ją PRZED rzutem electric

**Przykład pola:** `wykaz_lamp[3] = "spot Nowodvorski FLEA white 8202"` → `{ id: 3, brand: "Nowodvorski", model: "FLEA white", sku: "8202", type: "spot" }`

---

### 5.2 `floor_coverings` — Extraction guidance

**Co wydobywać:**
- `product_name` — pełna nazwa handlowa (np. "Quick Step CREO Dąb Tennessee jasny CRH3179")
- `product_code` — kod producenta z legendy (CRH3179, ESP401)
- `area_sqm` — ilość m² podana w legendzie (= 29,89 mkw)
- `skirting_type` + `skirting_ml` — listwa przypodłogowa (VOX Espumo ESP401 = 22 mb)
- `floor_zone` — pomieszczenie(a) objęte tym materiałem
- `tile_format_cm` — dla łazienek z legend (np. 17×18,18)

**Pułapki:**
- Ilości NIE zawierają zapasu — producent/standard wymaga zwykle +10%. Oznacza to: `area_sqm` = pole bez zapasu → evidence.notes: "bez zapasu produkcyjnego"
- Rzut pietra vs parteru to oddzielne rysunki (SKAWINA rys. 5A + 5B) — sumuj, nie nadpisuj
- WG. RYS. 9A na rzucie = odesłanie do furniture_drawing (zabudowa meblowa zakrywa podłogę) → wyłącz ten obszar z powierzchni podłogi

---

### 5.3 `wall_elevations` — Extraction guidance

**Co wydobywać:**
- `room_name` — z pola NAZWA POMIESZCZENIA w stopce
- `wall_id` — identyfikator widoku (A-A, B-B, rys. 6A)
- `materials[]` — per element na widoku:
  - tapeta: `{ type: "wallpaper", name: "DROPPING LEAVES CANVAS", supplier: "UBIERZ SWOJE ŚCIANY" }`
  - panel: `{ type: "wall_panel", name: "VOX LINERIO S-LINE BIAŁE", qty: 15, unit: "szt" }`
  - lustro: `{ type: "mirror_led", dims: "160×80 cm", color_temp: "3000K", switch: "sensor" }`
  - drzwi: `{ type: "door", model: "PORTA VECTOR B" }`
- `wall_height_cm` — jeśli podana (lub z survey_existing / functional_layout)

**Pułapki:**
- "OBJAŚNIENIE OZNACZENIA RAMEK WIELOKROTNYCH" (BUDZÓW) = ramka przy symbolu elektryk→ widok na ścianie. Nie mylić z materiałem ściany.
- Jeden widok może zawierać elementy z MULTIPLE materiałów (tapeta dolna + panel górny + listwa między nimi)

---

### 5.4 `furniture_drawing` — Extraction guidance

**Co wydobywać:**
- `unit_name` — z tytułu rysunku (np. "Szafa sypialnia", "Blat łaziankowy", "Regał z siedziskiem")
- `room_name` — z NAZWA POMIESZCZENIA
- `dimensions_cm` — W × H × D z rysunku (w mm na rysunku → przeliczyć / zachować mm)
- `materials_stolarskie[]`:
  - `FRONTY, KORPUSY`: nazwa płyty + kod (np. Pfleiderer Dąb Springfield Jasny R20233)
  - `REGAŁ DREWNOPODOBNY`: fornir + kod
  - `UCHWYTY`: producent + model + długość mm (np. IKEA ÖSTERNÄS, skóra garbowana, 153 mm)
  - `BLAT`: typ (ULTRAFIT, DEKTON) + grubość mm + nazwa koloru + kod
  - `TAPICERKA`: tkanina + model (np. TOPTEXTIL Magic Velvet 2263)
- `led_strip` — czy jest listwa LED w zabudowie (tak/nie, barwa)

**Pułapki:**
- UWAGI na rysunku: "Wymiary wewnętrzne (między półkami) traktować poglądowo" → dims mebla są ramowe, nie finalne
- UWAGI: "Wykonawca zobowiązany sprawdzić wymiaru z rzeczywistością" → cross-check ZAWSZE wymagany
- "płyta lakierowana lakier NCS ... LUB płyta laminowana Pfleiderer ..." → ALTERNATYWA — nie jeden materiał; evidence.conflict = true

---

### 5.5 `plumbing_wod_kan` — Extraction guidance

**Co wydobywać:**
- `fixture_type` — typ przyboru (umywalka, WC, wanna, prysznic, zlew, zmywarka, pralka)
- `connection_type` — podtynkowy / ścienny / stojący
- `dimensions_from_wall_cm` — pozycja osi przyłącza z wymiarami na rzucie
- `wylewka_h_cm` — wysokość wylewki relative do której podane są heights (np. h=75)
- `arm_h_cm` — mieszacz bateria (h=105)
- `shower_h_cm` — słuchawka / deszczownica (h=130, h=220)
- `toilet_frame_type` — stelaż podtynkowy (symbol na rzucie = kratkowana linia w WC)

**Pułapki:**
- Rzut wod-kan NIE daje wymiarów pomieszczenia — wymiary pokoju bierz z functional_layout
- Zmywarka H=60, lodówka H=30 to heights gniazdek — to jest w `electrical_sockets`, nie tutaj
- "Montaż poprzedzić wykonaniem pomiaru z natury" (BUDZÓW) → H-values są orientacyjne

---

### 5.6 `visualization_3d` — Extraction guidance

**Co wydobywać (OSTROŻNIE):**
- `rooms_visible[]` — jakie pomieszczenia są zwizualizowane (lista pokoi w projekcie)
- `style_hints` — styl wnętrza (np. scandi, loft, nowoczesny minimalizm)
- `color_palette` — przybliżone kolory (beże, ciemne drewno, biel) — TYLKO jako signal, nie spec
- `fixture_count_approx` — liczba lamp widocznych na render-u (NIGDY nie używać zamiast wykaz lamp)
- `has_suspended_ceiling` — czy sufit podwieszany widoczny (true/false jako hypothesie signal)

**NIE wydobywaj z wizualizacji:**
- Wymiarów
- Ilości materiałów
- Kodu produktu / nazwy handlowej (chyba że identyczna z rysunkiem technicznym — VERIFY)
- Pozycji gniazdek ani włączników

**Confidence z tego źródła**: max 0.55 dla materialnych twierdzeń; 0.70 dla identyfikacji pomieszczeń

---

## 6. Przykłady evidence schema (JSON)

### 6.1 Wymiar (z functional_layout)

```json
{
  "type": "dimension",
  "value": 29.89,
  "unit": "sqm",
  "subject": "floor_area",
  "room": "salon_z_aneksem",
  "source_layer": "floor_coverings",
  "source_drawing": "rys_5",
  "source_file": "BANACHA_projekt wykonawczy.pdf",
  "confidence": 0.94,
  "notes": "bez zapasu produkcyjnego"
}
```

### 6.2 Specyfikacja armatury (z wall_elevations)

```json
{
  "type": "fixture_spec",
  "subject": "mirror",
  "value": {
    "name": "lustro LED",
    "dims_cm": "160x80",
    "color_temp_K": 3000,
    "switch_type": "sensor"
  },
  "room": "przedpokoj",
  "source_layer": "wall_elevations",
  "source_drawing": "rys_6A",
  "source_file": "BOCHENKA_projekt wykonawczy.pdf",
  "confidence": 0.92
}
```

### 6.3 Specyfikacja materiału meblowego (z furniture_drawing)

```json
{
  "type": "material_spec",
  "subject": "cabinet_front",
  "value": {
    "product_name": "Pfleiderer Dąb Springfield Jasny",
    "product_code": "R20233",
    "finish": "laminat",
    "supplier": "Pfleiderer"
  },
  "unit_name": "szafa_sypialnia",
  "room": "sypialnia",
  "source_layer": "furniture_drawing",
  "source_drawing": "rys_9C",
  "source_file": "BANACHA_projekt wykonawczy.pdf",
  "confidence": 0.96
}
```

### 6.4 Specyfikacja oprawy (z electrical_lighting)

```json
{
  "type": "fixture_spec",
  "subject": "lighting",
  "value": {
    "id_on_drawing": 1,
    "brand": "Nowodvorski",
    "model": "FLEA white",
    "sku": "8202",
    "type": "spot",
    "count_per_room": { "salon": 3, "sypialnia": 2 }
  },
  "source_layer": "electrical_lighting",
  "source_drawing": "rys_3A",
  "source_file": "BANACHA_projekt wykonawczy.pdf",
  "confidence": 0.93
}
```

### 6.5 Missing data (brak zestawienia zbiorczego)

```json
{
  "type": "missing_data",
  "subject": "material_quantity_summary",
  "value": null,
  "notes": "Projekt nie zawiera zbiorczego arkusza materiałów z ilościami i cenami. Ilości rozproszone per rysunek.",
  "impact": "quantity_estimation_requires_aggregation_across_drawings",
  "source_file": "ALL",
  "confidence": 1.0
}
```

### 6.6 Hipoteza (z visualization_3d)

```json
{
  "type": "hypothesis",
  "subject": "suspended_ceiling",
  "value": true,
  "basis": "sufit podwieszany widoczny na wizualizacji 3D salon",
  "confidence": 0.60,
  "source_layer": "visualization_3d",
  "requires_confirmation_from": ["ceiling_plan", "wall_elevations"],
  "source_file": "BANACHA_projekt wykonawczy.pdf"
}
```

### 6.7 Scope hint (z structural_guidelines)

```json
{
  "type": "scope_hint",
  "subject": "new_partition_wall",
  "value": {
    "thickness_cm": 8,
    "material": "ściana działowa",
    "location": "przedpokoj_salon",
    "is_new": true
  },
  "source_layer": "structural_guidelines",
  "source_drawing": "rys_2A",
  "source_file": "BOCHENKA_projekt wykonawczy.pdf",
  "confidence": 0.90
}
```

### 6.8 Conflict (materiał z alternatywą)

```json
{
  "type": "conflict",
  "subject": "cabinet_front_material",
  "value": {
    "option_a": {
      "type": "lacquered_board",
      "color_ncs": "NCS S 1502-Y50R",
      "finish": "półmat"
    },
    "option_b": {
      "type": "laminate_board",
      "product": "Pfleiderer Cashmere U12168 VV"
    }
  },
  "notes": "Projekt dopuszcza obie opcje — decyzja Inwestora/Wykonawcy",
  "source_layer": "furniture_drawing",
  "source_drawing": "rys_10I",
  "source_file": "MOGILSKA_projekt wykonawczy.pdf",
  "confidence": 0.55
}
```

---

## 7. Reguły fuzji źródeł

### Reguła 1 — Rysunek techniczny bije wizualizację
```
IF claim.source_layer === "visualization_3d"
AND contradicting_claim.source_layer IN [
  "furniture_drawing", "floor_coverings", "wall_elevations",
  "electrical_lighting", "plumbing_wod_kan"
]
THEN use contradicting_claim; mark viz claim as "overridden_by_technical"
```

### Reguła 2 — Brak zestawienia zbiorczego → missing_data evidence
```
IF bundle_type === "projekt_wykonawczy"
AND NOT EXISTS drawing WITH type === "material_summary_table"
THEN inject:
  evidence.missing_data("material_quantity_summary")
  score_penalty += 0.10
```

### Reguła 3 — Nakładające się ilości z wielu rzutów
```
IF floor_coverings CONTAINS multiple drawings (parter + piętro)
THEN area_total = SUM(area_per_drawing)
NOT OVERRIDE (last drawing wins — WRONG)
```

### Reguła 4 — Switch heights: rysunek elektryczny > wizualizacja
```
IF switch_height COMES FROM visualization_3d
THEN confidence = 0.30 // nie można odczytać z rendera
IF switch_height COMES FROM electrical_lighting OR electrical_sockets
THEN confidence = 0.92
```

### Reguła 5 — Cross-project material pattern (sygnał, nie fakt)
```
IF material_code FOUND IN multiple_project_files FROM same_studio
THEN is_studio_preferred_material = true
BUT confidence += 0.05 (ONLY if not contradicted by this project's own spec)
NOT to be used as replacement for missing spec
```

### Reguła 6 — Wymiary mebli są orientacyjne
```
IF source_layer === "furniture_drawing"
AND notes CONTAINS "wymiary wewnętrzne traktować poglądowo"
THEN dimension.precision = "approximate"
AND dimension.confidence *= 0.85
AND inject evidence.note("weryfikacja z natury wymagana")
```

### Reguła 7 — Dom vs mieszkanie: inwentaryzacja jako baseline
```
IF property_type === "house" AND EXISTS survey_existing
THEN use survey_existing.dimensions AS spatial_baseline
OVER functional_layout.dimensions (functional może pomijać pomieszczenia nieobjęte projektem)
NOTE: grey_shaded_rooms = "pomieszczenia nieobjęte projektem" — exclude from scope
```

### Reguła 8 — LEDy: globalna nota z electrical legend / uwag
```
IF note IN electrical_lighting CONTAINS "3000K" AND "nie stosować"
THEN all_led_color_temp = 3000K (obligatory)
AND apply to: furniture_drawing embedded LED, wall_elevations mirror LED
```

### Reguła 9 — Wizualizacja bez stopki studia = visualization_pack, nie projekt
```
IF PDF_page HAS NO studio_footer_template
THEN document_type = "visualization_pack"
AND confidence_cap = 0.45 FOR ALL claims from this document
AND structural_completeness = "incomplete"
```

---

## 8. Uzupełnienia rule pack (`bundle.types.ts`)

Dodaj do `SOURCE_PRIORITY` i `DOCUMENT_LAYER_TYPES`:

```typescript
// Typy warstw dokumentu - "na miarę mieszkania" template (rozszerzalne)
export const DOCUMENT_LAYER_TYPES = {
  title_page: { label: 'Strona tytułowa', priority: 50, confidenceCap: null, role: 'metadata' },
  visualization_3d: { label: 'Wizualizacje 3D', priority: 20, confidenceCap: 0.55, role: 'design_intent' },
  survey_existing: { label: 'Stan zastany – inwentaryzacja', priority: 5, confidenceCap: 0.92, role: 'factual_baseline' },
  functional_layout: { label: 'Układ funkcjonalny', priority: 8, confidenceCap: 0.90, role: 'spatial_reference' },
  structural_guidelines: { label: 'Wytyczne budowlane – ściany/zabudowy', priority: 6, confidenceCap: 0.90, role: 'scope_definition' },
  electrical_legend: { label: 'Legenda elektryczna', priority: 3, confidenceCap: null, role: 'reference' },
  electrical_lighting: { label: 'Elektryka – oświetlenie', priority: 7, confidenceCap: 0.92, role: 'technical_spec' },
  electrical_sockets: { label: 'Elektryka – gniazdka', priority: 7, confidenceCap: 0.92, role: 'technical_spec' },
  plumbing_wod_kan: { label: 'Instalacje sanitarne wod-kan', priority: 7, confidenceCap: 0.90, role: 'technical_spec' },
  floor_coverings: { label: 'Okładziny podłogowe', priority: 5, confidenceCap: 0.95, role: 'material_spec' },
  wall_coverings: { label: 'Okładziny ścienne / farby', priority: 8, confidenceCap: 0.88, role: 'material_spec' },
  wall_elevations: { label: 'Wybrane widoki ścian', priority: 6, confidenceCap: 0.93, role: 'material_spec' },
  tile_layout: { label: 'Projekt glazury', priority: 5, confidenceCap: 0.95, role: 'material_spec' },
  ceiling_plan: { label: 'Projekt sufitu', priority: 8, confidenceCap: 0.88, role: 'technical_spec' },
  furniture_drawing: { label: 'Projekt mebla / zabudowy', priority: 4, confidenceCap: 0.96, role: 'material_spec' },
  staircase_design: { label: 'Koncepcja schodów', priority: 7, confidenceCap: 0.88, role: 'technical_spec' },
  glazing_door_detail: { label: 'Projekt przeszklenia / drzwi specjalnych', priority: 6, confidenceCap: 0.90, role: 'technical_spec' },
  construction_detail: { label: 'Detal budowlany', priority: 10, confidenceCap: 0.85, role: 'technical_spec' },
} as const

// Typy bundli dokumentacyjnych
export const BUNDLE_TYPES = {
  projekt_wykonawczy: {
    label: 'Projekt wykonawczy',
    expectedLayers: ['functional_layout', 'electrical_lighting', 'electrical_sockets', 'plumbing_wod_kan', 'floor_coverings', 'wall_elevations', 'furniture_drawing'],
    houseOnlyLayers: ['survey_existing', 'staircase_design'],
    photoOnlyPenalty: false,
    structurallyComplete: true,
  },
  visualization_pack: {
    label: 'Pack wizualizacyjny',
    expectedLayers: ['visualization_3d'],
    photoOnlyPenalty: true,
    structurallyComplete: false,
    confidenceCapGlobal: 0.45,
  },
} as const

// Missing data signals per bundle type
export const STRUCTURAL_MISSING_DATA = {
  projekt_wykonawczy: [
    {
      key: 'material_quantity_summary',
      description: 'Projekt nie zawiera zbiorczego zestawienia materiałów z ilościami. Ilości rozproszone per rysunek.',
      scorePenalty: 0.10,
    },
  ],
} as const
```

---

## 9. Split P0 vs P1

### P0 — AI analiza pojedynczego zdjęcia / dokumentu

| Co dostarczyć dla P0 | Warstwy | Ograniczenia |
|---|---|---|
| Lista lamp z modelami | `electrical_lighting` (WYKAZ LAMP) | Tylko gdy OCR/render dobry — check NUMER RYS. w stopce |
| Typ podłogi + m² | `floor_coverings` | Często 2+ rysunki per projekt — sumuj |
| Materiał mebli | `furniture_drawing` | Wymiary orientacyjne — flaguj |
| Typ płytek łazienki | `tile_layout` | Format cm + układ |
| Wod-kan: typ przyboru + H | `plumbing_wod_kan` | H-values orientacyjne |
| Szacunek pomieszczeń | `visualization_3d` lub `functional_layout` | Viz: confidence max 0.55 |

**P0 confidence_cap**: Gdy bundle = `projekt_wykonawczy` i brak zestawienia zbiorczego: max `0.72`  
**P0 confidence_cap**: Gdy bundle = `visualization_pack` (Jankowicz): max `0.45`

---

### P1 — Composite Project Analysis (pełny bundle)

| Aktywowana agregacja | Co łączyć | Wynik |
|---|---|---|
| Pełna mapa materiałów | floor + walls + tiles + furniture + electrical fixtures | `material_matrix` per pomieszczenie |
| Zakres prac budowlanych | structural_guidelines + plumbing + electrical | `scope_summary` per trade |
| Ilości materiałów | floor_coverings (m²/mb) + furniture dims + tile areas | `quantity_estimate` — BEZ zestawienia = hasMissingData true |
| Identyfikacja konfliktów | furniture.option_a vs furniture.option_b z UWAG | `conflict_list[]` |
| Spójność LED | electrical_legend + furniture LED + wall_elevations mirror | `global_led_spec` (np. "3000K везде") |
| Inwentaryzacja vs projekt | survey_existing vs functional_layout | `scope_delta` = co się zmienia |

**P1 minimum viable bundle** (abyśmy uruchomili composite):  
Wymagane: ≥4 warstwy MUST USE + `functional_layout` + co najmniej jedna z: `floor_coverings` / `wall_elevations`  
Jeśli brakuje: `hasMissingData = true`, `structuralPenalty += 0.10` per brakującą warstwę MUST USE

**P1 maximum achievable confidence**: `0.85` (brak zestawienia zbiorczego = strukturalne ograniczenie bundla)  
**P1 dla visualization_pack (Jankowicz)**: composite się nie uruchamia — `error: insufficient_technical_layers`

---

## Appendix A — Wzorce materiałowe cross-projekt (studio "na miarę mieszkania")

Poniższe wzorce pozwalają sygnalizować `is_studio_preferred` = true, gdy spec jest niekompletna:

| Materiał | Kod | Projekty |
|---|---|---|
| Pfleiderer Dąb Springfield Jasny | R20233 | BANACHA (szafa, szafki) |
| Pfleiderer Cashmere | U12168 QR / VV | BANACHA (blat), MOGILSKA (front meblowy) |
| VOX Espumo | ESP401 | BANACHA (listwa), SKAWINA (listwa) |
| Nowodvorski FLEA white | 8202 | BANACHA (spot), BUDZÓW (spot) |
| IKEA ÖSTERNÄS uchwyt skórzany | 153 mm | BOCHENKA (pralnia), MOGILSKA (regał) |
| Taśma LED ciepła biała | 3000K | WSZYSTKIE projekty (globalne uvagi) |
| Quick Step CREO | CRH3179 | BANACHA (podłoga) |
| Quick Step Impressive Dąb naturalny satyn | — | SKAWINA (podłoga) |

**Reguły użycia tych wzorców:**
- Używaj TYLKO jako signal do `is_studio_preferred` flag — NOT jako substytut brakującej spec
- Cross-project material NIE podnosi confidence dla konkretnego projektu
- Przydatne do: budowania UI podpowiedzi, kontekstu dla wykonawcy, wykrywania rozbieżności

---

## Appendix B — Znane pola stopki rysunków technicznych (do parsowania)

```
PROJEKTANT: na miarę mieszkania / Katarzyna Kluza / ul. Kościuszki 65/29 / 30-114 Kraków / NIP: 6772464300
INWESTYCJA: [nazwa inwestycji]
TYTUŁ RYS.: [tytuł — np. "Punkty elektryczne - oświetlenie"]
NAZWA POMIESZCZENIA: [np. "sypialnia", "parter", "piętro"]
SKALA: [np. 1:50, 1:20, 1:30]
NUMER RYS.: [np. 3A, 9C, 11B]
DATA: [dd/mm/yy]
RODZAJ RYSUNKU: [np. "rzut poziomy", "projekt mebla", "projekt mebla"]
```

Parsowanie NUMER RYS. pozwala przypisać drawing do właściwej `layer_type` bez analizy treści.

Mapowanie prefiksów numerów rysunków:
- `O1`, `O2` → `survey_existing`
- `1` → `functional_layout`
- `2A`, `2B` → `structural_guidelines`
- `3A`, `3A1`, `3B`, `3B1` → `electrical_lighting` / `electrical_sockets`
- `4A`, `4B` → `plumbing_wod_kan`
- `5`, `5A`, `5B` → `floor_coverings`
- `6`, `6x` → `wall_coverings` / `wall_elevations`
- `7x` → `tile_layout`
- `8x` → `ceiling_plan`
- `9x` → `furniture_drawing`
- `10x` → `staircase_design` / `construction_detail`
- `11x`, `12x` → `glazing_door_detail` / `staircase_design`
