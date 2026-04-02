# AI Engine — Decyzje wdrożeniowe po kalibracji v1

**Źródło kalibracji**: `docs/ai-calibration-bundle-v1.md`  
**Data decyzji**: 2026-04-01  
**Kontekst**: P0 AI MVP — frozen. P1 Composite Project Analysis — w trakcie.  
**Próbka**: 6 PDF-ów studia "na miarę mieszkania" (Kraków). Nie reprezentatywne dla całego rynku.

---

## Klucz klasyfikacji

| Symbol | Znaczenie |
|---|---|
| ✅ READY | Wdrożone lub bezpieczne do wdrożenia — solidna podstawa empiryczna |
| 🔶 VALIDATE | Kierunek poprawny, wartości/logika wymaga walidacji na kolejnych bundlach |
| 🔴 NO-GENERALIZE | Nie wolno kodować jako regułę ogólnosystemową — zbyt narrow |

---

## Sekcja 1 — Co wdrożono od razu (P1 codebase)

### ✅ DOCUMENT_LAYER_TYPES + DOCUMENT_LAYER_META
**Plik**: `src/services/ai/composite/bundle.types.ts`  
**Co**: 18-elementowy enum `DocumentLayerType` + stała `DOCUMENT_LAYER_META` z `sourcePriority`, `confidenceCap`, `mustUse` per type.  
**Uzasadnienie**: Kody warstw (functional_layout, electrical_lighting itd.) są koncepcyjnie neutralne — nie są specyficzne dla jednego studia. Są zrozumiałe dla dowolnego projektu wnętrzarskiego.  
**Caveat**: Wartości `confidenceCap` oznaczone jako "starting point" — TODO validate po batch 2.

---

### ✅ BUNDLE_DOCUMENT_TYPES (projekt_wykonawczy + visualization_pack)
**Plik**: `src/services/ai/composite/bundle.types.ts`  
**Co**: Enum `BundleDocumentType` + stała `BUNDLE_DOCUMENT_TYPES` z `structurallyComplete`, `confidenceCapGlobal 0.45`, `expectedMustUseLayers`, `houseOnlyLayers`.  
**Uzasadnienie**: Split binarny potwierdzony empirycznie — 5 pełnych projektów vs 1 visualization_pack (Jankowicz). Brak technicznych warstw → brak podstawy do composite.  
**Krytyczna guards zaplanowana** (R-C-37): `visualization_pack` → early exit z `error: insufficient_technical_layers` w przyszłym composite processor.

---

### ✅ STRUCTURAL_MISSING_DATA
**Plik**: `src/services/ai/composite/bundle.types.ts`  
**Co**: Stała `STRUCTURAL_MISSING_DATA['projekt_wykonawczy']` z `key: 'material_quantity_summary'`, `scorePenalty: 0.10`, uwaga o "bez zapasu produkcyjnego".  
**Uzasadnienie**: 6/6 projektów potwierdziło brak zbiorczego zestawienia materiałów. To strukturalna właściwość polskiego "projektu wykonawczego" wnętrzarskiego, nie wyjątek. Automatyczna injekacja `missing_data` evidence jest bezpieczna.

---

### ✅ `lighting_fixture_spec` EvidenceType
**Plik**: `src/services/ai/composite/extraction.contract.ts`  
**Co**: Nowy typ `LightingFixtureSpecEvidence` z polami `id_on_drawing`, `brand`, `model`, `sku`, `fixture_type`, `count_per_room`, `color_temp_K`. Dodany do `EvidenceType` union i `EvidenceContent` union.  
**Uzasadnienie**: Oprawy elektryczne (WYKAZ LAMP) mają inną strukturę niż przybory sanitarne (`FixtureEvidence`). id_on_drawing + SKU + count_per_room nie pasuje do istniejącego FixtureEvidence.  
**Caveat**: Logika korelacji id_on_drawing → WYKAZ LAMP jest oznaczona TODO validate.

---

## Sekcja 2 — VALIDATE FURTHER (Batch 2)

Poniższe reguły są poprawne kierunkowo, ale **nie trafiają jeszcze do kodu**. Wdrożyć po zebraniu ≥10 bundli z ≥3 różnych studiów projektowych.

---

### 🔶 NUMER RYS. routing (R-C-03)
**Obserwacja**: W studiach "na miarę mieszkania" numery rysunków mają stały wzorzec (O1→survey, 3A→electrical, 9x→furniture).  
**Dlaczego validate**: To konwencja jednego studia. Sprawdzenie: Atelier Aura (Warszawa) używa numeracji A, E, S — zupełnie innej.  
**Decyzja**: Dokumentacja w rule pack jako "pattern znany dla studia X". Routing parsera musi być konfigurowany per studio, nie hardcoded.

---

### 🔶 Exact confidence_cap values per layer (R-C-09 do R-C-12)
**Obserwacja**: furniture_drawing=0.96, floor_coverings=0.95, wall_elevations=0.93, electrical=0.92.  
**Dlaczego validate**: Te wartości nie były weryfikowane fusion engine'em ani real extraction output. Są logicznie uzasadnione ale nieweryfikowane.  
**Decyzja**: Wdrożone jako starting-point w stałych (z komentarzem TODO validate). Zmienić po pierwszych 10 composite run'ach.

---

### 🔶 P1 maximum achievable confidence = 0.85 (R-C-14)
**Obserwacja**: Brak zbiorczego zestawienia = nieusuwalne ograniczenie → max 0.85.  
**Dlaczego validate**: Product decision + założenie. Nie wiadomo co użytkownicy-wykonawcy oczekują przy "kompletnym" bundlu.  
**Decyzja**: Nie wdrażać jako hard cap przed pierwszym composite demo.

---

### 🔶 P1 Minimum Viable Bundle threshold (R-C-35, R-C-36)
**Obserwacja**: ≥4 MUST USE + functional_layout + floor LUB wall → composite OK. structuralPenalty += 0.10 per missing MUST USE.  
**Dlaczego validate**: Próg "4" jest arbitralny. 3 warstwy z bardzo dobrym rzutem mogą być wystarczające. 4 warstwy z kiepskim OCR mogą być gorsze niż 2 dobre.  
**Decyzja**: Nie wdrażać jako guard. Zamiast tego: zbierać statystyki kompletności bundli z pierwszych 10 testów.

---

### 🔶 survey_existing jako baseline dla domów (R-C-23)
**Obserwacja**: W domach (BUDZÓW, SKAWINA) inwentaryzacja powinna być baseline ponad functional_layout.  
**Dlaczego validate**: property_type (dom vs mieszkanie) nie jest jeszcze wykrywany w systemie. Wymaga osobnego feature.  
**Decyzja**: Wpisane jako `houseOnlyLayers` w stałych — gotowe koncepcyjnie. Logika switchingu czeka na house detection.

---

### 🔶 LED 3000K globalna nota (R-C-24)
**Obserwacja**: Nota w UWAGACH "NIE STOSOWAĆ taśm LED o barwie innej niż 3000K" → wszystkie LED w projekcie mają 3000K.  
**Dlaczego validate**: To preferencja 1 studia. Inne studia stosują 2700K, 4000K, 6500K. Auto-propagacja 3000K może nadpisać poprawne dane z innych studiów.  
**Decyzja**: Nie kodować. Rule pack jako "signal: jeśli znajdziesz globalną notę LED w UWAGACH, wydobądź color_temp constraint".

---

### 🔶 Furniture dims "poglądowe" → confidence × 0.85 (R-C-22)
**Obserwacja**: UWAGI na rysunkach mebli zawierają "wymiary wewnętrzne traktować poglądowo".  
**Dlaczego validate**: "Poglądowo" musi być wykryte przez NLP — nie wiadomo jak precyzyjnie. Penalty 0.85 nie jest kalibrowany.  
**Decyzja**: Reguła ekstrakcji: jeśli "poglądowo" w UWAGACH → emit `notes: "wymiary orientacyjne - weryfikacja z natury wymagana"` + `confidence_reason` to wyjaśnia obniżenie. Konkretny mnożnik: validate.

---

### 🔶 electrical_legend na oddzielnej stronie (R-C-28)
**Obserwacja**: MOGILSKA ma legendę elektryki na osobnej stronie PRZED rzutami. Inne projekty mają inline.  
**Dlaczego validate**: Niespójność wewnątrz jednego studia → inne studia będą jeszcze bardziej zróżnicowane.  
**Decyzja**: Parser musi szukać strony z LEGENDA przed pierwszym rzutem elektrycznym, zamiast zakładać stronę N-1.

---

## Sekcja 3 — DO NOT GENERALIZE (negatywne decyzje)

Poniższe obserwacje **nie mogą być kodowane jako reguły ogólne**. Wpisanie ich do silnika spowoduje błędy na projektach innych studiów.

---

### 🔴 Specific product codes and studio preferences (R-C-38 do R-C-44)
**Wzorce**: VOX Espumo ESP401, Nowodvorski FLEA 8202, IKEA ÖSTERNÄS 153mm, Pfleiderer R20233, Quick Step CRH3179, "3000K везде".  
**Decyzja**: Dane referencyjne tylko (Appendix A w ai-calibration-bundle-v1.md). Nie trafiają do kodu silnika. Mogą służyć do budowania UI podpowiedzi w kontekście jednego użytkownika/studia po ich opt-inie.

---

### 🔴 is_studio_preferred + confidence += 0.05 (R-C-21)
**Obserwacja**: Materiał znany z innych projektów studia → confidence boost 0.05.  
**Decyzja**: **Niebezpieczny bias.** Nagradza znajomą markę zamiast jakości ekstrakcji. Może prowadzić do gaslightingu (system "pewniejszy" bo widział Pfleiderer wcześniej). Odrzucona.

---

### 🔴 Visualization_pack detection by footer absence (R-C-05, R-C-25)
**Obserwacja**: Brak stopki studia → visualization_pack.  
**Decyzja**: Za narrow. Studyjne stopcki są niestandardowe. Inne oznaki (np. brak TYTUŁ RYS. / NUMER RYS.) też nie są universalne. Wykrywanie bundle type przez pozytywne sygnały (obecność rzutu technicznego), nie przez brak stopki.

---

### 🔴 Grey-shaded rooms = excluded from scope (R-C-34)
**Obserwacja**: W planach BUDZÓW/SKAWINA szare pomieszczenia = "nieobjęte projektem".  
**Decyzja**: Konwencja graficzna 1 studia / 1 oprogramowania CAD. Inne studia używają kreskowania, Xów, napisów "nie dotyczy". Nie kodować.

---

### 🔴 WG. RYS. 9A = furniture exclusion zone (R-C-27)
**Obserwacja**: Napis "WG. RYS. 9A" na rzucie podłóg oznacza obszar pod meblami (wykluczyć z m²).  
**Decyzja**: Notacja jednego studia. Nie kodować jako parser trigger. Zamiast: emit `scope_hint` z `notes: "obszar pod zabudową meblową — weryfikacja wymiaru"`.

---

### 🔴 P0_confidence_cap = 0.72 dla projekt_wykonawczy (R-C-16)
**Obserwacja**: P0 max = 0.72 = 0.82 − scorePenalty(0.10).  
**Decyzja**: P0 jest frozen. Wartość 0.82 jako "baseline P0" jest nieskalibrowana. Nie dotykać confidence-model.ts w zakresie P0.

---

## Sekcja 4 — Finalna lista wdrożeń: co gdzie trafiło

| Zmiana | Plik | Status |
|---|---|---|
| `DocumentLayerType` union type | `bundle.types.ts` | ✅ wdrożone |
| `DOCUMENT_LAYER_META` stała | `bundle.types.ts` | ✅ wdrożone |
| `BundleDocumentType` union type | `bundle.types.ts` | ✅ wdrożone |
| `BUNDLE_DOCUMENT_TYPES` stała | `bundle.types.ts` | ✅ wdrożone |
| `STRUCTURAL_MISSING_DATA` stała | `bundle.types.ts` | ✅ wdrożone |
| `LightingFixtureSpecEvidence` type | `extraction.contract.ts` | ✅ wdrożone |
| `lighting_fixture_spec` w EvidenceType | `extraction.contract.ts` | ✅ wdrożone |
| Reguły fuzji 1–9 | `ai-calibration-bundle-v1.md` | ✅ rule pack (nie kod) |
| `visualization_pack` early-exit guard | composite processor (nie istnieje) | ⏳ czeka na composite processor P1 |
| NUMER RYS routing | — | 🔶 validate batch 2 |
| Exact confidence_cap tuning | `bundle.types.ts` (TODO) | 🔶 validate batch 2 |
| P1 MVB threshold | — | 🔶 validate batch 2 |
| house → survey_existing baseline | bundle processor | 🔶 czeka na house detection feature |
| Studio product codes | — | 🔴 reference only |

---

## Sekcja 5 — Trigger dla Batch 2 walidacji

Warunki konieczne przed wdrożeniem pozycji "validate further":

1. **≥10 bundli przetestowanych** przez extraction engine (composite processor działa)
2. **≥3 różne studia projektowe** (nie tylko "na miarę mieszkania") — konieczne dla generalizacji NUMER RYS i stopki
3. **First composite fusion run** — potrzebny do walidacji exact confidence_cap values
4. **house detection feature** — potrzebny przed survey_existing baseline switch
5. **Minimum 5 extraction errors** zaraportowanych — potrzebne do walidacji penalty values (0.85, 0.10 per layer)
