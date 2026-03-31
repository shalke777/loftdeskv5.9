# AI Engine Preconditions
## LoftDesk v5.9 — warunki konieczne przed rozbudową AI Engine

---

## I. Co już istnieje w systemie (AI baseline)

### 1. Input Classifier (`services/ai/input-classifier.ts`)
Gotowy, w produkcji. Klasyfikuje każdy wejściowy input do jednego z silników:

```
invoice, receipt, formal_document, cost_note  → document engine
room_photo, work_progress_photo               → room engine
project_pdf, technical_drawing, design_visualization → project engine
unknown                                        → none
```

API: `classifyInput(input): InputClassification { type, confidence, suggestedEngine }`

### 2. Analysis types (`services/ai/analysis.types.ts`)
Ujednolicony typ wyjściowy `AnalysisResult` dla wszystkich silników.  
Zawiera: `DocumentFields`, `DocumentLineItem`, `DetectedEntity`, `DetectedMaterial`, `WorkScopeItem`, `SuggestedEstimateItem`, `SectionConfidence`.

Utilities: `toAnalysisResult()`, `flattenAnalysisResult()`, `rehydrateAnalysisResult()`

### 3. Engine types (engines/)
- `document.types.ts` — `Party`, `DocumentSubtype`, `DocumentAmount`, `PaymentInfo`, `DocumentAnalysisResult`
- `room.types.ts` — `StageOfWork`, `DetectedElement`, `ScopeItem`, `QuantityHint`, `RoomAnalysisResult`
- `project.types.ts` — prawdopodobnie dla PDF architektonicznych

### 4. Bathroom task library (`services/ai/bathroom-task-library.ts`)
Dziedzinowa biblioteka zadań dla prac łazienkowych. Seeded knowledge base dla room engine.

### 5. Room types (`services/ai/room-types.ts`)
Katalog typów pomieszczeń dla klasyfikacji w room engine.

### 6. Model config (`services/ai/model-config.ts`)
Konfiguracja używanych modeli LLM (provider, model name, temperature, etc.)

### 7. AI routes w aplikacji
- `/room-analysis` — RoomAnalysisRoutePage — przesyłanie zdjęć pomieszczeń
- `/project-analysis` — ProjectAnalysisRoutePage — analiza dokumentów projektowych
- `/ai` — AiRoutePage — hub / orkiestrator AI

### 8. Mock summarize w aiService
```ts
export const aiService = {
  async summarize(text: string) {
    return `Podsumowanie: ${text.slice(0, 120)}`
  }
}
```
**UWAGA:** To jest mock. Prawdziwy summarizer musi zostać podłączony.

---

## II. Encje i dane dostępne dla AI

### Dane które AI może czytać (operator context)
| Encja | Dostępne pola | Zastosowanie AI |
|-------|---------------|-----------------|
| `Project` | name, address, status, start/end_date, completeness_flags | kontekst projektu dla analizy |
| `Estimate` | name, items[], total_net/gross, notes | porównanie / pre-fill |
| `Contract` | tranches[], value, start/end_date | stan finansowy projektu |
| `Invoice` | items[], status, total_gross, invoice_type | rozliczenie |
| `PhotoDocumentation` | category, image_url, note, taken_at | analiza postępu prac |
| `ClientDecision` | title, decision_type, status, description | historia zmian |
| `HandoverProtocol` | checklist, status | kompletność odbioru |
| `TechnicalStandard` | content, category | standardy jakości |

### Dane CHRONIONE — AI nigdy nie może ich eksponować klientowi
- `costs` / `expense_invoices` — marże operatora
- `company_members` — wewnętrzna struktura firmy
- `invitations` — tokeny zaproszeń pracowników
- `ksef_queue` / `ksef_batches` — wewnętrzne stany KSeF
- `document_numbering_config` — konfiguracja systemu

---

## III. Bezpieczne punkty wejścia AI (gdzie AI może pisać)

### ✅ BEZPIECZNE — AI może sugerować, użytkownik zatwierdza
| Punkt wejścia | Tabela docelowa | Warunek bezpieczeństwa |
|---------------|-----------------|----------------------|
| Auto-fill wyceny z OCR/zdjęcia | `estimate_items` (jako sugestia w formularzu) | Tylko draft, użytkownik zatwierdza |
| Sugestia nazwy projektu | `projects.name` | Tylko pre-fill, użytkownik zatwierdza |
| Sugestia pozycji faktury | `invoice_items` (w formularzu) | Draft mode, użytkownik zatwierdza |
| Etykiety zdjęć dokumentacyjnych | `photo_documentation.note` | Tylko sugestia |
| Ekstrakcja danych z faktury (OCR) | `expenses` / `invoices` (jako pre-fill) | Użytkownik przegląda mapping |

### ❌ NIEBEZPIECZNE — AI nie może automatycznie wykonywać
| Operacja | Powód |
|----------|-------|
| Zmiana statusu faktury (draft→unpaid) | Powoduje przydzielenie numeru — nieodwracalne |
| Wysyłka do KSeF | Business-critical, nieodwracalna |
| Usunięcie dokumentu | Destrukcyjna, nieodwracalna |
| Zmiana `company_id` lub `project_id` na istniejącym dokumencie | Naruszenie integrity |
| Tworzenie `project_client_access` bez wyraźnej akcji operatora | Ryzyko inadvertent access |
| Zatwierdzanie decyzji klienta (`client_decisions.status`) | Prawniczo istotne |
| Podpisywanie dokumentów (`signature_requests`) | QTSP flow, prawnie wiążące |

---

## IV. Architektura AI — zalecane wzorce

### Wzorzec 1: Analiza → Sugestia → Zatwierdzenie użytkownika
```
AI.analyze(input) → SuggestedFields → UI review step → User.confirm() → mutation()
```
Każda akcja AI musi przejść przez review step.  
Nigdy nie commitować bezpośrednio do bazy bez potwierdzenia.

### Wzorzec 2: Input Classifier przed każdym wywołaniem silnika
```
classifyInput(input) → InputClassification
if classification.confidence < 60: show "uncertain" state
route to engine based on suggestedEngine
```

### Wzorzec 3: Context injection (enrichment before prompt)
Przed wysłaniem do LLM, enrichuj kontekst:
```
project context = { project.name, project.address, existing estimates, client.name }
inject into prompt system message
```

### Wzorzec 4: Analysis result jako unified type
Zawsze konwertuj przez `toAnalysisResult()` do ujednoliconego formatu.  
Frontend pracuje wyłącznie na `AnalysisResult`, nie na surowych JSON z LLM.

---

## V. Preconditions — co MUSI istnieć przed AI Engine

### P1. Bezpieczny endpoint AI (Netlify Function lub Edge)
- LLM API key NIGDY nie może być w frontendzie
- Obsługa timeout, rate limiting, error handling
- Aktualnie: `netlify/functions/` folder istnieje (portal-get, portal-message)
- Nowe funkcje AI powinny być tu dodane

### P2. Demo mode guard
Wszystkie AI features muszą sprawdzać `isDemoMode`:
```ts
if (isDemoMode) return mockResponse()
```
Demo mode nie może robić prawdziwych wywołań LLM.

### P3. File upload przez Supabase Storage
Zdjęcia i PDF wysyłane do analizy muszą iść przez `services/storage/` → Supabase Storage.  
URL podpisany (signed URL) przekazywany do LLM, nie raw binary przez frontend.

### P4. Streaming odpowiedzi (dla długich analiz)
Analiza PDF architektonicznego może trwać 10-30s.  
UI musi obsługiwać streaming / progressive disclosure, nie spinner blokujący.

### P5. Audit trail (ślad AI)
Każde AI-generated pole powinno mieć metadata:
```ts
{ value: X, source: 'ai', confidence: 0.85, model: 'gpt-4o' }
```
Ważne dla protokołów (handover), decyzji klienta i podpisów.

---

## VI. Istniejące tabele relevantne dla AI context

### Tabele z bogatym kontekstem projektowym
```sql
-- Pełen kontekst dla AI per project:
SELECT 
  p.*,
  array_agg(DISTINCT e.*) as estimates,
  array_agg(DISTINCT c.*) as contracts,
  array_agg(DISTINCT pd.*) as photo_docs,
  array_agg(DISTINCT cd.*) as client_decisions
FROM projects p
LEFT JOIN estimates e ON e.project_id = p.id
LEFT JOIN contracts c ON c.project_id = p.id
LEFT JOIN photo_documentation pd ON pd.project_id = p.id
LEFT JOIN client_decisions cd ON cd.project_id = p.id
WHERE p.id = $1
```

### Tabele dla OCR/expense pipeline
- `expenses` / `expense_invoices` → target dla AI extraction z faktur
- `invoice_items` → target dla auto-fill z wyceny/OCR

---

## VII. Ryzyka AI — czego nie wolno łamać

| Ryzyko | Opis | Mitigation |
|--------|------|-----------|
| **Boundary leakage** | AI zwraca dane operatora do zapytania klienta | Użyj `client-portal.api.ts` dla kontekstu klienta — nigdy `invoices.api.ts` bezpośrednio |
| **Number assignment** | AI trigger wystawiania faktury przydziela numer | Draft mode musi być chroniony; number = null aż do świadomego proceed |
| **KSeF double-send** | AI retry przy timeoucie wysyła dwa razy | Idempotency key w ksef_queue; sprawdź `ksef_ref` przed wysyłką |
| **Stale analysis** | AI analizuje stary PDF po edycji | `document_hash` w `signature_artifacts` — weryfikuj hash przed prezentacją |
| **Prompt injection** | Dane z bazy mogą zawierać instrukcje dla LLM | Sanitizuj user-generated content przed wstrzyknięciem do promptu |

---

## VIII. Silniki AI — status implementacji

| Silnik | Typy | Prompty | Calling LLM | Status |
|--------|------|---------|-------------|--------|
| Document engine | ✅ zdefiniowane | ? | ? | Typy gotowe, implementacja unknown |
| Room engine | ✅ zdefiniowane | `services/ai/prompts/` | ? | Typy gotowe, bathroom lib gotowa |
| Project engine | ✅ zdefiniowane | ? | ? | Typy gotowe |
| Summarizer | ✅ (mock) | N/A | ❌ mock | MOCK — nie produkcja |

**PRZED rozbudową:** sprawdź `services/ai/prompts/` i `services/ai/testing/` — mogą zawierać działające implementacje.
