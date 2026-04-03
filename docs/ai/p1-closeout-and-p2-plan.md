# PLAN DOMKNIĘCIA P1 I DALSZEGO ROZWOJU AI W LOFTDESK

> Dokument sterujący — wersja 1.0, kwiecień 2026  
> Oparty na audycie repo `loftdesk-v5.9-nav-docs-polish`, branch `main`

---

## 1. Product truth i aktualna faza projektu

### Czym jest LoftDesk
LoftDesk to platforma workflow, dokumentacji i komunikacji dla polskich firm remontowo-wykończeniowych. Centralną jednostką systemu jest **projekt**. AI jest **dodatkiem** do istniejącego produktu — nie osobnym systemem.

### Zakres AI
- **Docelowe pomieszczenia:** łazienka, WC (nie rozszerzamy na całe mieszkania ani domy)
- **Wzorzec produktu:** input → analiza AI → sugestia → review operatora → jawne CTA → draft wyceny
- **Kontekst:** zawsze `company_id` + `project_id`
- **AI nie może samodzielnie:** finalizować wycen, pisać do KSeF, tworzyć client access, wykonywać decyzji biznesowych

### Gdzie jesteśmy
- **P0 — zamknięte.** Scope AI zawężony, fundament architektoniczny zbudowany, decyzja o osadzeniu w projekcie podjęta.
- **P1 — końcówka.** Infrastruktura danych, backend, frontend, review operatora, integracja z wyceną — wszystko istnieje. Są luki.
- **P2 — jeszcze nie.** Nie zaczynamy P2 dopóki P1 nie jest formalnie domknięte.

---

## 2. Co oznacza „końcówka P1" w LoftDesk

P1 definiuje **działający praktyczny przepływ end-to-end:**

```
Operator uploaduje zdjęcia łazienki/WC
  → AI analizuje (room photo analysis)
    → wynik zapisywany w DB (ai_analysis_runs + ai_scope_items)
      → operator przegląda (accept/modify/reject)
        → operator odpowiada na pytania AI (ai_questions)
          → operator klika "Utwórz wycenę z analizy"
            → draft wyceny powstaje (cost_estimates z ai_source_run_id)
```

P1 wymaga również:
- podstawowego bezpieczeństwa (JWT, RLS, rate limiting)
- ograniczeń domenowych (bathroom/WC only)
- kontroli operatora (brak automatycznych decyzji biznesowych)
- audytu (ai_review_actions — immutable log)

---

## 3. Stan obecny w repo — co faktycznie istnieje

### ✅ CO DZIAŁA (P0 + P1 — zweryfikowane w kodzie)

#### Backend (Netlify Functions)
| Komponent | Plik | Status | Linie |
|-----------|------|--------|-------|
| **Room photo analysis** | `netlify/functions/analyze-room-photo.ts` | ✅ Produkcyjne | 1046 |
| **Invoice AI parsing** | `netlify/functions/parse-invoice-ai.ts` | ✅ Produkcyjne | ~350 |
| **Invoice regex fallback** | `netlify/functions/parse-invoice.ts` | ✅ Produkcyjne | ~250 |
| **Project analysis** | `netlify/functions/analyze-project.ts` | ✅ Produkcyjne | ~300 |
| **Composite extract** | `netlify/functions/composite-extract-asset.ts` | ✅ Produkcyjne | 551 |
| **Bundle fusion** | `netlify/functions/bundle-fusion.ts` | ⚠️ Read-only v1 | 165 |
| **AI persist (P0)** | `netlify/functions/shared/ai-persist.ts` | ✅ Produkcyjne | ~200 |
| **Evidence persist (P1)** | `netlify/functions/shared/evidence-persist.ts` | ✅ Produkcyjne | 270 |
| **Bathroom triggers** | `netlify/functions/shared/bathroom-triggers.ts` | ✅ Produkcyjne | ~200 |

#### Autentykacja i bezpieczeństwo
| Komponent | Implementacja | Status |
|-----------|---------------|--------|
| `verifyRequestAuth()` | JWT via Supabase w każdej funkcji AI | ✅ |
| `isRateLimited()` | 10 req/10 min per user per function | ✅ |
| `company_id` z JWT | Nigdy z payloadu — zawsze z tokena | ✅ |
| RLS na wszystkich tabelach AI | `WHERE company_id = my_company_id()` | ✅ |
| Immutable audit log | `ai_review_actions` — INSERT only, no UPDATE/DELETE | ✅ |
| Storage bucket RLS | Path-based: `{company_id}/{project_id}/...` | ✅ |

#### Baza danych (migracje 083–097)
| Tabela | Migracja | Status | RLS |
|--------|----------|--------|-----|
| `ai-inputs` (storage bucket) | 083 | ✅ | ✅ path-based |
| `ai_analysis_runs` | 084 | ✅ | ✅ SELECT/INSERT |
| `ai_scope_items` | 085 | ✅ | ✅ SELECT/INSERT/UPDATE |
| `ai_questions` | 086 | ✅ | ✅ SELECT/INSERT |
| `ai_risks` | 086 | ✅ | ✅ SELECT/INSERT |
| `ai_review_actions` | 087 | ✅ | ✅ INSERT/SELECT only |
| `company_memory_feedback` | 088 | ✅ | ✅ INSERT/SELECT only |
| `ai_input_assets` | 089 | ✅ | ✅ SELECT only |
| `cost_estimates.ai_source_run_id` | 090 | ✅ | — (na istniejącej tabeli) |
| Unique index `ai_source_run_id` | 091 | ✅ | — (DB-level guard) |
| `v_ai_run_stats` (view) | 092 | ✅ | ✅ WHERE clause |
| `ai_analysis_bundles` | 093 | ✅ | ✅ SELECT/INSERT |
| `ai_bundle_assets` | 094 | ✅ | ✅ SELECT only |
| `ai_extraction_results` | 095 | ✅ | ✅ SELECT only |
| `increment_bundle_counter` (RPC) | 096 | ✅ | ✅ service_role only |
| P1 schema alignment | 097 | ✅ | — |

#### Frontend — komponenty
| Komponent | Plik | Status |
|-----------|------|--------|
| `AiTypeChooserPage` | `src/features/expenses/components/` | ✅ Produkcyjne |
| `RoomAnalysisPage` (4-step flow) | `src/features/expenses/components/` | ✅ Produkcyjne |
| `ProjectAnalysisPage` | `src/features/expenses/components/` | ✅ Produkcyjne |
| `ProjectAiTab` (w ProjectDetail) | `src/features/ai-review/components/` | ✅ Produkcyjne |
| `AiIntakeSection` (upload + trigger) | `src/features/ai-review/components/` | ✅ Produkcyjne |
| `AiRunReviewPanel` (review UI) | `src/features/ai-review/components/` | ✅ Produkcyjne |
| `AiRunsList` (historia) | `src/features/ai-review/components/` | ✅ Produkcyjne |
| `BundleReadinessCard` | `src/features/ai-review/components/` | ✅ Produkcyjne |
| `FusionReviewQueuePanel` | `src/features/ai-review/components/` | ✅ Produkcyjne (287 linii) |
| `BathroomClarificationForm` | `src/features/expenses/components/` | ✅ Produkcyjne |
| `AnalysisSections` (5 sekcji) | `src/features/expenses/components/` | ✅ Produkcyjne |
| `ComparisonResultView` | `src/features/expenses/components/` | ✅ Produkcyjne |
| `AiReliabilityBanner` | `src/features/expenses/components/AiGuidance/` | ✅ Produkcyjne |
| `ExpenseConfidenceBadge` | `src/features/expenses/components/` | ✅ Produkcyjne |

#### Frontend — hooki
| Hook | Plik | Status |
|------|------|--------|
| `useAnalyzeRoomPhoto` / `useAnalyzeRoomPhotos` | `src/features/expenses/hooks/` | ✅ |
| `useAnalyzeProject` | `src/features/expenses/hooks/` | ✅ |
| `useParseInvoice` | `src/features/expenses/hooks/` | ✅ |
| `useAiRunsForProject` | `src/features/ai-review/hooks/useAiReview.ts` | ✅ |
| `useAiRunStatsForProject` | `src/features/ai-review/hooks/useAiReview.ts` | ✅ |
| `useAiScopeItems` | `src/features/ai-review/hooks/useAiReview.ts` | ✅ |
| `useAiQuestions` / `useAiRisks` | `src/features/ai-review/hooks/useAiReview.ts` | ✅ |
| `useInsertReviewAction` | `src/features/ai-review/hooks/useAiReview.ts` | ✅ |
| `useCreateEstimateFromRun` | `src/features/ai-review/hooks/useAiReview.ts` | ✅ |
| `useExistingAiEstimate` | `src/features/ai-review/hooks/useAiReview.ts` | ✅ |
| `useBundlesForProject` | `src/features/ai-review/hooks/useAiBundles.ts` | ✅ |
| `useBundleReadiness` | `src/features/ai-review/hooks/useAiBundles.ts` | ✅ |
| `useFusionReviewQueue` | `src/features/ai-review/hooks/useAiBundles.ts` | ✅ |

#### Usługi AI (services layer)
| Moduł | Plik | Status | Linie |
|-------|------|--------|-------|
| Fusion engine | `src/services/ai/composite/fusion.engine.ts` | ✅ Pełna implementacja | 652 |
| Fusion review builder | `src/services/ai/composite/fusion.review.ts` | ✅ Pełna implementacja | 131 |
| Bundle readiness | `src/services/ai/composite/bundle-readiness.ts` | ✅ Pełna implementacja | 235 |
| Bundle types | `src/services/ai/composite/bundle.types.ts` | ✅ Pełne typy | 278 |
| Fusion types | `src/services/ai/composite/fusion.types.ts` | ✅ Pełne typy | 304 |
| Extraction contract | `src/services/ai/composite/extraction.contract.ts` | ✅ Pełne typy | 259 |
| Scope → Estimate mapping | `src/features/ai-review/lib/mapAiScopeToEstimate.ts` | ✅ Produkcyjne | 64 |
| Upload AI input | `src/features/ai-review/lib/uploadAiInput.ts` | ✅ Produkcyjne | 88 |
| Confidence model | `src/services/ai/confidence-model.ts` | ✅ | — |
| Input classifier | `src/services/ai/input-classifier.ts` | ✅ | — |
| Bathroom task library | `src/services/ai/bathroom-task-library.ts` | ✅ | — |
| Model config | `src/services/ai/model-config.ts` | ✅ | — |

#### Prompty AI
| Prompt | Plik | Status |
|--------|------|--------|
| Classifier | `src/services/ai/prompts/classifier.prompt.ts` | ✅ Produkcyjny |
| Document | `src/services/ai/prompts/document.prompt.ts` | ✅ Produkcyjny |
| Evidence (P1) | `src/services/ai/prompts/evidence.prompt.ts` | ✅ Produkcyjny |
| Project | `src/services/ai/prompts/project.prompt.ts` | ✅ Produkcyjny |
| Room scope | `src/services/ai/prompts/room-scope.prompt.ts` | ✅ Produkcyjny |

#### Routing
| Route | Komponent | Status |
|-------|-----------|--------|
| `/ai` | `AiTypeChooserPage` | ✅ |
| `/room-analysis` | `RoomAnalysisPage` | ✅ |
| `/project-analysis` | `ProjectAnalysisPage` | ✅ |
| `/projects/:id` → zakładka AI | `ProjectAiTab` | ✅ |

#### Testy i smoke-testy
| Plik | Cel |
|------|-----|
| `scripts/_smoke-room-label.cjs` | Test etykietowania pokoju |
| `scripts/_smoke-pdf-wodkan.cjs` | Test ekstrakcji PDF wod-kan |
| `scripts/extract-test-asset.mjs` | Test ekstrakcji z bundla |
| `scripts/seed-test-bundle.mjs` | Seed testowego bundla |

---

### ⚠️ CO JEST CZĘŚCIOWE

| Element | Stan | Czego brakuje |
|---------|------|---------------|
| **bundle-fusion** v1 | Read-only | Nie zapisuje `fused=true` do DB. Wynik efemeryczny. |
| **aiService.summarize** | Mock | `src/services/ai/ai.service.ts` zwraca `Podsumowanie: ${text.slice(0,120)}`. Nie jest jednak nigdzie realnie używany — placeholder. |
| **confidence_cap values** | Robocze | 2 TODO w `bundle.types.ts` i `extraction.contract.ts` — potrzebna kalibracja batch-2. |
| **Standalone flows vs Project flow** | Rozbieżność | `/room-analysis` i `/project-analysis` działają **poza kontekstem projektu** — wynik nie trafia do `ai_analysis_runs` z `project_id`. Flow w `ProjectAiTab` jest poprawny. |

### ❌ CO NIE ISTNIEJE / JEST MARTWE

| Element | Status |
|---------|--------|
| `aiService.summarize` — realne LLM podsumowanie | ❌ Mock — ale **nie blokuje P1** (nie jest używany w żadnym flow) |
| Streaming UI (progress bar dla 10-30s analiz) | ❌ Nie istnieje — operator widzi spinner |
| Batch processing (wiele bundli równocześnie) | ❌ Nie istnieje — jeden po drugim |
| Osobny AI error monitoring / dashboard | ❌ Nie istnieje |
| Automatyczne retry po błędach OpenAI | ❌ Nie istnieje — 502 zwracany bezpośrednio |

---

## 4. Root cause — co blokuje pełne domknięcie P1

### 4.1 Architektura danych
**Stan: ✅ Kompletna.** 15 migracji (083–097), RLS na wszystkich tabelach, immutable audit log, bridge do cost_estimates z unique index. **Brak blokady.**

### 4.2 Backend flow
**Stan: ✅ W dużej mierze kompletny.**
- Room photo → persist → DB: ✅ pełne
- Composite extract → evidence persist: ✅ pełne
- Bundle fusion v1: ⚠️ read-only (nie persystuje `fused=true`)

**Root cause luki:** Bundle fusion zaprojektowany jako v1 read-only celowo. Persystencja wyniku fusion to decyzja architektoniczna odłożona na koniec P1 lub P2.

### 4.3 Frontend flow
**Stan: ✅ W dużej mierze kompletny.**
- Intake → analiza → wynik → review → estimate draft: ✅ pełne w `ProjectAiTab`
- Standalone flows (`/room-analysis`, `/project-analysis`): ⚠️ działają, ale **wynik nie trafia do DB** z kontekstem projektu

**Root cause luki:** Standalone flows powstały jako wczesne demo. `ProjectAiTab` jest prawidłowym flow P1 — standalone flows mogą zostać zredukowane do redirect/entry point.

### 4.4 Input pipeline
**Stan: ✅ Kompletny.**
- Upload validation (format, rozmiar): ✅
- Base64 encoding + preprocessing: ✅
- Multi-photo (1–10): ✅
- BathroomClarification form: ✅

### 4.5 Review operatora
**Stan: ✅ Kompletny.**
- Accept/modify/reject scope items: ✅
- Answer questions (text/yesno/choice/number): ✅
- Acknowledge/resolve risks: ✅
- Immutable audit log: ✅
- Duplicate estimate prevention: ✅

### 4.6 Bezpieczeństwo / RLS / audyt
**Stan: ✅ Kompletny.**
- JWT na każdym endpoint: ✅
- Rate limiting: ✅ (10/10min, in-memory, reset on cold start — akceptowalne)
- RLS: ✅ (company_id scope na wszystkim)
- Audit log: ✅ (INSERT-only ai_review_actions)
- OPENAI_API_KEY backend-only: ✅

**Uwaga:** Rate limiting in-memory resetuje się na cold start Netlify. Dla P1 — akceptowalne. Persystentny rate limit (Redis/DB) — P2.

### 4.7 Integracja z draftem wyceny
**Stan: ✅ Kompletny.**
- `mapAiScopeToEstimateItems()`: ✅ (accepted/modified → estimate items)
- `useCreateEstimateFromRun()`: ✅ (zapisuje `ai_source_run_id`)
- Unique index na `ai_source_run_id`: ✅ (zapobiega duplikatom)
- `buildAiEstimateName()`: ✅ ("Wycena AI — Łazienka (DD.MM.YYYY)")

### 4.8 Observability / retry / timeout / limity / stabilność
**Stan: ⚠️ Częściowy.**
- Timeout: 26s na Netlify (hardcoded max): ✅
- File size limit: 8 MB client / 10 MB bucket: ✅
- OpenAI quota error handling: ✅ (429 → graceful error)
- OpenAI generic error: ⚠️ (502 → brak retry)
- `v_ai_run_stats` view: ✅ (observability)
- Brak automatycznego retry: ❌
- Brak alertów na błędy AI: ❌
- Brak limitu dziennego/miesięcznego na firmę: ❌

---

## 5. Braki end-to-end do zamknięcia P1

### Blokujące (CRITICAL)

| # | Brak | Wpływ | Priorytet |
|---|------|-------|-----------|
| C1 | **Standalone flows bez kontekstu projektu** | `/room-analysis` i `/project-analysis` nie zapisują wyników do `ai_analysis_runs` z `project_id`. Operator traci wynik po zamknięciu karty. | 🔴 CRITICAL |
| C2 | **Brak retry na 502/timeout z OpenAI** | Operator traci analizę — musi powtórzyć upload i czekać. Złe UX. | 🔴 CRITICAL |
| C3 | **Bundle fusion nie persystuje wyniku** | `bundle-fusion` zwraca wynik efemeryczny. Odświeżenie strony = utrata fusion review. | 🟠 HIGH (ale P1 flow działa bez fusion — można odłożyć) |

### Ważne (HIGH)

| # | Brak | Wpływ | Priorytet |
|---|------|-------|-----------|
| H1 | **Brak limitu dziennego/miesięcznego na firmę** | Jedna firma może wyczerpać cały budżet OpenAI. | 🟠 HIGH |
| H2 | **Brak streaming/progress UI** | 10-30s spinner bez feedback — operator może zamknąć kartę. | 🟠 HIGH |
| H3 | **Confidence cap values nieskalibrowane** | Wartości robocze (TODO w kodzie). Nie blokuje, ale wyniki mogą być mylące. | 🟡 MEDIUM |

### Nieblokujące (MEDIUM/LOW)

| # | Brak | Wpływ | Priorytet |
|---|------|-------|-----------|
| M1 | `aiService.summarize` mock | Nie jest nigdzie używany. Nie blokuje niczego. | ⚪ LOW |
| M2 | Brak Sentry alertów na błędy AI | Operacyjne — do dodania. | 🟡 MEDIUM |
| M3 | Brak persystentnego rate limit | In-memory resetuje na cold start. OK dla P1, poprawa w P2. | 🟡 MEDIUM |

---

## 6. Plan domknięcia P1

### Sprint P1-CLOSE: Minimalne bezpieczne zmiany

#### Krok 1 — Fix standalone flows (C1)
**Cel:** Standalone `/room-analysis` i `/project-analysis` muszą albo wymagać `project_id` (redirect do wyboru projektu), albo zapisywać wynik do sesji i pozwalać przypisać do projektu po fakcie.

**Rekomendacja:** Dodaj na `/room-analysis` i `/project-analysis` obowiązkowy picker projektu (istniejący komponent) PRZED analizą. Po analizie — wynik trafia do `ai_analysis_runs` z poprawnym `project_id`.

**Pliki do zmiany:**
- `src/features/expenses/components/RoomAnalysisPage.tsx` — dodaj step 0: wybór projektu
- `src/features/expenses/components/ProjectAnalysisPage.tsx` — dodaj step 0: wybór projektu
- Reuse: istniejący project picker z `ProjectAiTab` lub `AiIntakeSection`

**Minimalna zmiana:** ~50 linii per komponent. Zero nowej architektury.

#### Krok 2 — Retry na błędy OpenAI (C2)
**Cel:** Automatyczne 1× retry na 502/timeout z OpenAI, z informacją dla operatora.

**Rekomendacja:** Dodaj retry w hookach frontendowych (`useAnalyzeRoomPhoto`, `useAnalyzeProject`). TanStack Query ma wbudowany `retry` — ustaw `retry: 1, retryDelay: 2000` dla mutacji AI.

**Pliki do zmiany:**
- `src/features/expenses/hooks/useAnalyzeRoomPhoto.ts` — dodaj `retry: 1`
- `src/features/expenses/hooks/useAnalyzeProject.ts` — dodaj `retry: 1`
- `src/features/ai-review/components/AiIntakeSection.tsx` — jeśli ma własny fetch

**Minimalna zmiana:** ~10 linii total. Zero nowej architektury.

#### Krok 3 — Limit dzienny na firmę (H1)
**Cel:** Zapobiec wyczerpaniu budżetu OpenAI przez jedną firmę.

**Rekomendacja:** Dodaj check w Netlify functions: `SELECT count(*) FROM ai_analysis_runs WHERE company_id = $1 AND created_at > now() - interval '1 day'`. Limit: 50 analiz/dzień/firma (konfigurowalny). Zwróć 429 z czytelnym komunikatem po polsku.

**Pliki do zmiany:**
- `netlify/functions/analyze-room-photo.ts` — dodaj daily company check po auth
- `netlify/functions/analyze-project.ts` — dodaj daily company check po auth
- `netlify/functions/composite-extract-asset.ts` — dodaj daily company check po auth

**Minimalna zmiana:** ~30 linii per function (helper do reuse). Wymagany dostęp do Supabase client — już istnieje w każdej funkcji.

#### Krok 4 — Progress indicator (H2)
**Cel:** Operator widzi postęp zamiast pustego spinnera.

**Rekomendacja:** Dodaj etapowy progress w komponentach ładowania:
- "Przesyłanie zdjęć..." (0–2s)
- "AI analizuje pomieszczenie..." (2–15s)
- "Przygotowywanie wyników..." (15–26s)

**Pliki do zmiany:**
- `src/features/expenses/components/RoomAnalysisPage.tsx` — step 3 (processing)
- `src/features/expenses/components/ProjectAnalysisPage.tsx` — step 2 (processing)
- `src/features/ai-review/components/AiIntakeSection.tsx` — loading state

**Minimalna zmiana:** ~20 linii per komponent. Symulowany progress (timer-based), nie streaming.

### Opcjonalne w P1-CLOSE (jeśli czas pozwoli)

#### Krok 5 — Bundle fusion persist (C3)
**Cel:** Zapisanie wyniku fusion do DB, żeby nie znikał po odświeżeniu.

**Rekomendacja:** Dodaj nową tabelę `ai_fusion_snapshots` (id, bundle_id, company_id, project_id, result_json, created_at) z RLS. `bundle-fusion.ts` zapisuje wynik po `runFusion()`. Frontend czyta z DB zamiast z efemerycznego response.

**Uwaga:** To jest **graniczny element P1/P2**. Można odłożyć, bo P1 flow (room photo → review → estimate) działa bez fusion.

#### Krok 6 — Sentry alerty na AI errors (M2)
**Cel:** Widoczność błędów AI w produkcji.

**Rekomendacja:** Dodaj `Sentry.captureException()` w catch blokach Netlify functions (gdzie `console.error` już istnieje). `@sentry/node` lub custom via fetch.

---

## 7. Definition of Done dla P1

P1 jest **domknięte** gdy:

### Obowiązkowe
- [ ] Standalone flows (`/room-analysis`, `/project-analysis`) wymagają `project_id` i zapisują wyniki do DB
- [ ] Retry 1× na 502/timeout z OpenAI działa w hookach
- [ ] Limit dzienny na firmę (50 analiz/dzień) działa na backendzie
- [ ] Progress indicator zamiast pustego spinnera
- [ ] Istniejące testy (typecheck + build) przechodzą
- [ ] Smoke-test: pełny flow room photo → review → estimate draft (manual)
- [ ] Smoke-test: pełny flow project analysis → review → estimate draft (manual)
- [ ] Smoke-test: rate limit zwraca 429 po przekroczeniu
- [ ] Smoke-test: brak OPENAI_API_KEY → graceful degradation

### Opcjonalne (nie blokują DoD)
- [ ] Bundle fusion persist do DB
- [ ] Sentry alerty na AI errors
- [ ] Confidence cap recalibration
- [ ] `aiService.summarize` → realna implementacja

---

## 8. Plan przejścia z P1 do P2

### Gate przejścia
P2 **nie startuje** dopóki:
1. Wszystkie obowiązkowe elementy DoD P1 nie są ✅
2. Manual smoke-test potwierdza full flow
3. Typecheck + build przechodzą
4. Brak regresji w istniejących modułach

### P2 scope
P2 to **rozszerzenie jakości i stabilności AI**, nie rozszerzenie zakresu pomieszczeń.

| Element P2 | Cel | Ryzyko |
|------------|-----|--------|
| **Bundle fusion persist + history** | Fusion wyniki w DB, historia fusion runs | LOW |
| **Persystentny rate limit** (DB-based) | Odporność na cold start | LOW |
| **Streaming UI** (SSE/chunked) | Realtime progress z Netlify function | MEDIUM |
| **Confidence recalibration** (batch-2) | ≥10 bundli, ≥3 studia → tuning capów | MEDIUM |
| **Error observability dashboard** | Sentry + custom metrics | LOW |
| **Multi-studio generalization** | Calibration batch-2: inne studia projektowe | MEDIUM |
| **aiService.summarize → real LLM** | Podsumowania projektów/analiz | LOW |
| **Batch processing** (N bundli) | Kolejkowanie analiz | MEDIUM |

---

## 9. Zakres P2 — co powinno wejść, a co nie

### ✅ Wchodzi do P2
- Fusion persist + review history
- Persystentny rate limit
- Confidence recalibration batch-2
- Error monitoring
- Streaming progress (jeśli Netlify wspiera SSE)
- Test coverage (unit testy na fusion.engine, mapAiScopeToEstimate)

### ❌ NIE wchodzi do P2
- Rozszerzenie scope na kuchnię, salon, inne pomieszczenia
- Rozszerzenie na pełne domy/mieszkania
- Osobne repo/aplikacja AI
- Automatyczna finalizacja wycen
- Automatyczne decyzje biznesowe
- AI pisanie do KSeF/approvals/client portal
- LangChain, RAG, embeddings, vector DB
- Własny model ML (zostajemy na OpenAI GPT-4o)

---

## 10. Ryzyka i pułapki

| Ryzyko | Prawdopodobieństwo | Wpływ | Mitygacja |
|--------|---------------------|-------|-----------|
| **Scope drift do P2 przed zamknięciem P1** | 🟠 MEDIUM | 🔴 HIGH | Ścisłe DoD P1, gate przejścia |
| **Koszty OpenAI bez limitu firmowego** | 🔴 HIGH | 🟠 HIGH | Krok 3 w planie P1-CLOSE |
| **Utrata wyników analizy (standalone flows)** | 🔴 HIGH | 🟠 HIGH | Krok 1 w planie P1-CLOSE |
| **Netlify 26s timeout dla dużych PDF** | 🟡 LOW | 🟡 MEDIUM | Akceptowalne w P1, chunking w P2 |
| **Cold start rate limit reset** | 🟡 LOW | 🟡 LOW | Akceptowalne w P1, DB rate limit w P2 |
| **Confidence cap misleading values** | 🟡 MEDIUM | 🟡 MEDIUM | Kalibracja w P2, operator ostrzeżony banner-em |
| **Fusion bez persistencji — UX confusion** | 🟡 MEDIUM | 🟡 LOW | P1 flow działa bez fusion; persist w P2 |

---

## 11. Czego nie robić teraz

1. **Nie rozszerzaj zakresu pomieszczeń** (kuchnia, salon, itp.)
2. **Nie dodawaj LangChain/RAG/vector DB** — GPT-4o z structured output wystarcza
3. **Nie buduj osobnego panelu AI** — `ProjectAiTab` jest właściwym miejscem
4. **Nie dodawaj automatycznych decyzji** — operator review jest core P1
5. **Nie refaktoruj standalone flows na osobny routing** — prosty fix (dodaj project picker)
6. **Nie buduj custom AI dashboard** — `v_ai_run_stats` + Sentry wystarczy
7. **Nie zaczynaj P2 przed zamknięciem P1**
8. **Nie usuwaj `aiService.summarize` mock** — nie przeszkadza, usuniesz gdy zrobisz realną wersję
9. **Nie ruszaj migracji 083–097** — są kompletne i poprawne

---

## 12. Rekomendacja najbliższego sprintu

### Sprint P1-CLOSE (4 kroki, ~120 linii kodu total)

**Priorytet:**
1. 🔴 **Fix standalone flows** — dodaj project picker (C1)
2. 🔴 **Retry na OpenAI errors** — `retry: 1` w hookach (C2)
3. 🟠 **Limit dzienny na firmę** — 50 analiz/dzień (H1)
4. 🟠 **Progress indicator** — etapowy komunikat zamiast spinnera (H2)

**Po wykonaniu:** Manual smoke-test → DoD review → merge → P1 zamknięte.

**Szacunek:** ~120 linii zmian, zero nowych tabel, zero nowej architektury, zero broad refactor.

---

## Załączniki

### A. Konkretne pliki / moduły / migracje do sprawdzenia

#### Backend (Netlify Functions)
- `netlify/functions/analyze-room-photo.ts` — główna funkcja P0, 1046 linii, ✅
- `netlify/functions/analyze-project.ts` — analiza projektów, ✅
- `netlify/functions/composite-extract-asset.ts` — ekstrakcja evidence P1, 551 linii, ✅
- `netlify/functions/bundle-fusion.ts` — fusion v1 read-only, 165 linii, ⚠️
- `netlify/functions/parse-invoice-ai.ts` — OCR faktur, ✅
- `netlify/functions/parse-invoice.ts` — fallback regex, ✅
- `netlify/functions/shared/ai-persist.ts` — persist P0, ✅
- `netlify/functions/shared/evidence-persist.ts` — persist P1, ✅
- `netlify/functions/shared/bathroom-triggers.ts` — dependency inference, ✅

#### Frontend (React)
- `src/features/expenses/components/RoomAnalysisPage.tsx` — **do zmiany** (dodaj project picker)
- `src/features/expenses/components/ProjectAnalysisPage.tsx` — **do zmiany** (dodaj project picker)
- `src/features/expenses/hooks/useAnalyzeRoomPhoto.ts` — **do zmiany** (retry)
- `src/features/expenses/hooks/useAnalyzeProject.ts` — **do zmiany** (retry)
- `src/features/ai-review/components/ProjectAiTab.tsx` — ✅ nie ruszać
- `src/features/ai-review/components/AiRunReviewPanel.tsx` — ✅ nie ruszać
- `src/features/ai-review/lib/mapAiScopeToEstimate.ts` — ✅ nie ruszać

#### Services AI
- `src/services/ai/composite/fusion.engine.ts` — ✅ 652 linii, nie ruszać
- `src/services/ai/composite/bundle-readiness.ts` — ✅ 235 linii, nie ruszać
- `src/services/ai/composite/fusion.types.ts` — ✅ 304 linie, nie ruszać
- `src/services/ai/composite/extraction.contract.ts` — ✅ 259 linii, nie ruszać
- `src/services/ai/ai.service.ts` — ⚪ mock, nie blokuje

#### Migracje (083–097)
- Wszystkie kompletne i poprawne. **Nie ruszać.**

### B. Lista braków krytycznych do zamknięcia P1

| # | Brak | Plik do zmiany | Rozmiar zmiany |
|---|------|----------------|----------------|
| C1 | Standalone flows bez project_id | `RoomAnalysisPage.tsx`, `ProjectAnalysisPage.tsx` | ~50 linii/plik |
| C2 | Brak retry na 502/timeout OpenAI | `useAnalyzeRoomPhoto.ts`, `useAnalyzeProject.ts` | ~10 linii total |
| H1 | Brak limitu dziennego na firmę | `analyze-room-photo.ts`, `analyze-project.ts`, `composite-extract-asset.ts` | ~30 linii/function |
| H2 | Brak progress indicator | `RoomAnalysisPage.tsx`, `ProjectAnalysisPage.tsx`, `AiIntakeSection.tsx` | ~20 linii/plik |

### C. Proponowany najbliższy sprint wykonawczy

```
Sprint P1-CLOSE
────────────────────────────────────────
Krok 1 → Fix standalone flows       [C1]  ~100 linii
Krok 2 → Retry na OpenAI errors     [C2]  ~10 linii
Krok 3 → Limit dzienny na firmę     [H1]  ~90 linii
Krok 4 → Progress indicator         [H2]  ~60 linii
────────────────────────────────────────
Total:                                     ~260 linii
Nowe tabele:                               0
Nowe migracje:                             0
Nowa architektura:                         0
Broad refactor:                            0
────────────────────────────────────────
Walidacja:  tsc + build + manual smoke
DoD:        sekcja 7 tego dokumentu
```

### D. Decyzje architektoniczne do podjęcia przed wejściem w P2

| # | Decyzja | Opcje | Rekomendacja |
|---|---------|-------|--------------|
| D1 | **Fusion persist format** | (a) Osobna tabela `ai_fusion_snapshots` (b) Kolumna JSONB w `ai_analysis_bundles` | **(a)** — osobna tabela, łatwiejsze query, nie rusza istniejącej migracji |
| D2 | **Persystentny rate limit** | (a) DB counter (b) Redis (c) KV Netlify | **(a)** — DB counter z `ai_analysis_runs`. Nie wymaga nowej infry. |
| D3 | **Streaming UI** | (a) SSE z Netlify (b) Polling (c) Timer-based fake progress | **(c)** dla P1-CLOSE, **(a)** jeśli Netlify Edge wspiera SSE w P2 |
| D4 | **Confidence cap recalibration trigger** | (a) Manual (≥10 bundli) (b) Automatyczny po N uruchomieniach | **(a)** — manual na start. Nie buduj automatyki bez danych. |
| D5 | **Test coverage scope** | (a) Unit testy fusion.engine (b) E2E Playwright (c) Oba | **(a)** najpierw — fusion.engine to 652 linii czystej logiki, idealny do unit testów |

---

*Dokument przygotowany na podstawie audytu repo `loftdesk-v5.9-nav-docs-polish`, branch `main`, kwiecień 2026.*
