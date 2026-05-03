# LoftDesk — Audyt rzeczywistego użycia (Faza 1, statyczna)

> Wygenerowano: faza 1 audytu (knip + cross-reference netlify/router)
> Status: **wymaga walidacji runtime (Faza 2)** zanim cokolwiek usuniemy

---

## 0. Podsumowanie liczbowe

| Skala | Wartość |
|------|---------|
| Pliki źródłowe `src/` | 408 |
| Netlify functions | 27 |
| Migracje SQL | 133 |
| **Pliki nieużywane (knip)** | 81 |
| **Eksporty nieużywane (knip)** | 60 |
| **Typy nieużywane (knip)** | 62 |
| Niewymienione zależności w `package.json` | 6 |
| Nieużywane devDependencies | 6 |

---

## 1. Klasyfikacja Netlify Functions (27)

### ✅ USED — wywoływane z `src/` (frontend fetch)
- `voice-to-estimate`, `voice-to-expense`, `voice-to-note` — `FloatingVoiceButton` + `ExpensesPage`
- `voice-extract` — `VoiceNotesList`
- `parse-invoice`, `parse-invoice-ai` — `useParseInvoice`
- `analyze-project` — `useAnalyzeProject`
- `analyze-room-photo` — `useAnalyzeRoomPhoto` + `AiIntakeSection`
- `composite-extract-asset` — `services/ai/composite/call-extract-asset`
- `bundle-fusion` — `useAiBundles`
- `ai-project-assistant` — `AiAssistantPanel`
- `memory-context`, `memory-check` — `AiAssistantPanel` + `ProjectMemoryPanel`
- `daily-report` — `ProjectDetail` + `ProjectWorkspace`
- `send-document` — `SendToClientModal` + workspace + ProjectDetail
- `notify-approval-response` — `ClientProjectPage`
- `client-identify` — `ProjectPortalCTA`

### 🟡 INDIRECT — uruchamiane platformowo (scheduler / webhook / tła)
- `check-missing-costs` — **cron** `0 8 * * *` (netlify.toml)
- `check-overdue-invoices` — **cron** `30 8 * * *` (netlify.toml)
- `analyze-project-bg-background` — Netlify **background function** (sufiks `-background`), wywoływana z `analyze-project` lub klienta
- `stripe-checkout`, `stripe-portal` — proxy `/api/stripe/*` (redirect z netlify.toml)
- `stripe-webhook` — endpoint webhook od Stripe (zewnętrzny POST)
- `ksef-auth`, `ksef-session`, `ksef-send`, `ksef-receive`, `ksef-upo`, `ksef-http` — używane przez sam `KsefPage`/Stripe RPCs lub wewnątrz innych funkcji KSeF (need runtime confirm)

### ❓ UNKNOWN — bez referencji w kodzie, bez konfiguracji
- `memory-add` — w netlify.toml jest sekcja, ale nikt jej nie wywołuje. Może być używana przez DB trigger (webhook Supabase) lub plan miał ją podpiąć — **NIE USUWAĆ przed Fazą 2**
- `ksef-debug`, `ksef-mock` — podejrzane jako dev-only narzędzia

---

## 2. Klasyfikacja plików `src/` (najważniejsze grupy)

### 🔴 DEAD — kandydaci do usunięcia (HIGH confidence)

#### A. Route'y nigdy nie zarejestrowane w `src/app/router.tsx`
- `src/app/routes/admin.tsx` + `src/features/admin/**` (3 pliki)
- `src/app/routes/health.tsx` + `src/features/release/components/SystemHealthPage.tsx`
- `src/app/routes/release.tsx` + `ReleaseCenterPage.tsx`
- `src/app/routes/go-live.tsx` + `GoLivePage.tsx`
- `src/features/release/index.ts`

> Brak `adminRoute`, `healthRoute`, `releaseRoute`, `goLiveRoute` w `routeTree`.

#### B. Stary cluster „Project view" (zastąpiony przez `workspace/ProjectWorkspace.tsx`)
- `ProjectCard.tsx`, `ProjectDetail.tsx`, `KanbanBoard.tsx`
- `ProjectDocuments.tsx`, `ProjectNotes.tsx`, `ProjectTimeline.tsx`
- `ProjectPortalCTA.tsx`, `ProjectWeatherWidget.tsx`
- `src/features/projects/lib/eventChain.ts`, `lib/timeline.ts`

> Wszystkie odwołania to **wzajemne importy w obrębie tego klastra** — z zewnątrz nikt nie woła. Spójny zbiór do usunięcia razem.

> ⚠️ `ProjectDetail.tsx` ma fetch do `daily-report` i `send-document` — nadal zdublowane w `ProjectWorkspace`, weryfikacja: kto realnie się renderuje?

#### C. Stary widok dokumentów (zastąpiony przez `*Row.tsx`)
- `InvoiceCard.tsx`, `InvoiceDetail.tsx`
- `EstimateCard.tsx`
- `ContractCard.tsx`, `ContractDetail.tsx`

#### D. Stare API/hooks chat (przed migracją na threads)
- `src/features/chat/api/conversations.api.ts`
- `src/features/chat/hooks/useConversations.ts`

#### E. Wrappery onboarding (nie zarejestrowane w UI)
- `OnboardingChecklist.tsx`, `WelcomeBanner.tsx` (sprawdzić czy nie używa OnboardingPage)

#### F. Tylko `index.ts` barrel files (martwy reexport)
- `clients/`, `dashboard/`, `documentation/`, `estimates/`, `invoices/`, `ksef/`, `onboarding/`, `portal/`, `projects/`, `release/`, `reports/`, `settings/`, `team/`, `billing/`, `contracts/` — 15 plików `index.ts` bez konsumenta

#### G. Inne
- `ClientIdentifyCTA.tsx` (zastąpiony `ProjectPortalCTA`?)
- `UpgradeBanner.tsx`
- `ConfirmDialog.tsx` w `shared/ui` (zastąpiony przez Modal)
- `EstimateToContractFlow.tsx`, `EstimateToInvoiceFlow.tsx` + hook (workflows nigdy nie zhakowane)
- `useOfflineMutation.ts`, `lib/offlineQueue.ts` — offline support nie podpięty
- `lib/finalProduction.ts`, `lib/deployReadiness.ts`, `lib/releaseReadiness.ts` — narzędzia release nigdy nie używane
- `services/ai/testing/golden-test-plan.ts` — szkielet testów, nie odpalany
- `services/ai/composite/dev-extractor-stub.ts` — stub deweloperski
- `services/ai/engines/bathroom-dependency.ts`, `bathroom-task-library.ts` — biblioteka łazienek (zastąpiona promptami)
- `services/ai/input-classifier.ts`, `model-config.ts`, `prompts/classifier.prompt.ts`, `prompts/document.prompt.ts`, `prompts/project.prompt.ts`, `prompts/room-scope.prompt.ts` — orphan AI engine warstwa
- `shared/types/common.types.ts`, `database.types.ts`, `index.ts` — niegenerowane typy, ręczne kopie

### 🟡 INDIRECT — wymaga uwagi
- `auth.schema.ts`, `estimate.schema.ts`, `portal.schema.ts` — schematy zod, mogą być używane w testach lub do walidacji (sprawdzić)
- `entities/*/model.ts` (company, estimate, invitation, user) — modele bez konsumenta, ale type-only imports często knip umyka
- `signature-provider.interface.ts` — interface providera, używany przez konkretne implementacje

### 🟢 UNKNOWN — nie ruszać
- `useProjectDocuments.ts` (cały moduł hooks) — knip mówi „eksporty nieużywane" ale `ProjectDocuments.tsx` w klastrze DEAD ich używa → po usunięciu klastra automatycznie staną się unused
- `usePortalInbox.ts`, `usePortalNotifications.ts` — portal-inbox route może je importować lazy

---

## 3. Eksporty „dead" w żywych plikach (60)

Najczęściej:
- **Schematy Zod** w `entities/*/model.ts` — `*Schema` eksportowane, ale używane są tylko typy (TS only). Akcja: usunąć `export const XSchema = z.object(...)` jeśli nikt nie waliduje runtime.
- **`*Keys`** query keys (`aiKeys`, `notificationKeys`, `clientKeys`, `signatureKeys`, `estimateKeys`, `operatorNotificationKeys`) — eksportowane „na zapas" przez konwencję RQ, w praktyce używane lokalnie.
- **Helper exports w `shared/lib`** — `formatDate`, `compact`, `stripHtml`, `createSimplePdfBlob`, `getStripe`, `hasSupabaseConfig`, `getSupabaseUserId`, `addBreadcrumb`, `captureWarning`, `Sentry` reexport, `setMonitoringRoute` — utilities zostały wytworzone ale nikt ich nie wywołuje.
- **`useCreateInvoiceFromEstimate`, `useCreateProjectFromEstimate`, `useDeleteProject`** — hooki kreacyjne nigdy nie podpięte (workflow zastąpiony bezpośrednim utworzeniem)
- **`Catalog matcher`** — `matchAllItems`, `MatchTier` exportowane na poziomie 2 plików, jeden zostaje wewn., barrel `service-catalog/index.ts` reexport z duplikatem.
- **`LandingPage`** — `default` + `LandingPage` (duplicate exports) — przyczyna: `import LandingPage from` i `import { LandingPage }`.

---

## 4. Zależności

### 📦 Niewymienione (deklaratywne ryzyko)
- `tesseract.js` — używana w `parse-invoice.ts` ale brak w `package.json` → instaluje się przez `netlify/functions/package.json` (osobny). Akcja: oznaczyć w README, w głównym package.json niepotrzebna.

### 🗑️ Nieużywane (do usunięcia z `package.json`)
- `@hookform/resolvers`, `react-hook-form` — formularze są ręczne, brak `useForm()` w użyciu
- `@radix-ui/react-dialog`, `@radix-ui/react-slot` — używamy własnego `Modal`
- `@types/jszip` — typy są w samym `jszip`
- `motion` — animacja niewykorzystywana

### 🛠️ DevDeps do usunięcia
- `@tanstack/react-query-devtools`, `@tanstack/router-devtools` — devtools nieaktywne
- `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` — brak `.eslintrc` używającego ich
- `madge`, `ts-prune` — dodane podczas tego audytu, można zostawić jako audytowe

---

## 5. Lista bezpiecznych do usunięcia (proponowana, etap 1)

> Próg ryzyka: NISKIE — żadna zmiana nie ruszy aktywnej funkcjonalności

```
src/app/routes/admin.tsx
src/app/routes/health.tsx
src/app/routes/release.tsx
src/app/routes/go-live.tsx
src/features/admin/**
src/features/release/**
src/features/projects/components/ProjectCard.tsx
src/features/projects/components/ProjectDetail.tsx
src/features/projects/components/KanbanBoard.tsx
src/features/projects/components/ProjectDocuments.tsx
src/features/projects/components/ProjectNotes.tsx
src/features/projects/components/ProjectTimeline.tsx
src/features/projects/components/ProjectPortalCTA.tsx       ⚠️ ALE: jest w ClientIdentify path — sprawdzić!
src/features/projects/components/ProjectWeatherWidget.tsx
src/features/projects/lib/eventChain.ts
src/features/projects/lib/timeline.ts                       ⚠️ Re-export — unifikacja z timelineMeta.ts
src/features/invoices/components/InvoiceCard.tsx
src/features/invoices/components/InvoiceDetail.tsx
src/features/estimates/components/EstimateCard.tsx
src/features/contracts/components/ContractCard.tsx
src/features/contracts/components/ContractDetail.tsx
src/features/chat/api/conversations.api.ts
src/features/chat/hooks/useConversations.ts
src/features/billing/components/UpgradeBanner.tsx
src/features/client-portal/components/ClientIdentifyCTA.tsx
src/features/onboarding/components/OnboardingChecklist.tsx
src/features/onboarding/components/WelcomeBanner.tsx
src/shared/ui/ConfirmDialog/ConfirmDialog.tsx
src/shared/hooks/useOfflineMutation.ts
src/shared/lib/offlineQueue.ts
src/shared/lib/finalProduction.ts
src/shared/lib/deployReadiness.ts
src/shared/lib/releaseReadiness.ts
src/shared/lib/validators.ts
src/shared/types/common.types.ts
src/shared/types/database.types.ts
src/shared/types/index.ts
src/services/ai/ai.service.ts
src/services/ai/composite/dev-extractor-stub.ts
src/services/ai/engines/bathroom-dependency.ts
src/services/ai/bathroom-task-library.ts
src/services/ai/input-classifier.ts
src/services/ai/model-config.ts
src/services/ai/prompts/classifier.prompt.ts
src/services/ai/prompts/document.prompt.ts
src/services/ai/prompts/project.prompt.ts
src/services/ai/prompts/room-scope.prompt.ts
src/services/ai/testing/golden-test-plan.ts
src/workflows/estimate-to-contract/**
src/workflows/estimate-to-invoice/**
src/features/settings/components/AuthBridgeCard.tsx
src/features/portal/api/portal-project.api.ts              ⚠️ Tylko deprecated stub — sprawdzić
```

**Łącznie: ~55 plików + 15 barrel `index.ts` = ~70 plików** do skasowania bez wpływu na funkcjonalność.

---

## 6. Lista RYZYKOWNA — wymaga Fazy 2 (instrumentacji runtime)

| Element | Powód ryzyka |
|---------|--------------|
| `memory-add` Netlify function | Może być wywoływana z Supabase webhook/trigger — sprawdzić DB |
| `ksef-debug`, `ksef-mock` | Mogą być używane manualnie do diagnostyki w prod |
| `usePortalInbox`, `usePortalNotifications` | Lazy imports w portal-inbox route |
| `useProjectDocuments` hook (cluster) | Knip mówi „nieużywane eksporty", ale konsumentem jest dead-cluster — powiązane usunięcie |
| `ProjectPortalCTA` | Posiada fetch do `client-identify` — czy ten flow ma alternatywę? |
| Schematy Zod (`*Schema`) | Mogą być używane w testach Playwright lub przy walidacji formularzy |
| `entities/*/model.ts` | Type-only imports — knip czasem nie wykrywa |

---

## 7. Plan kolejnych kroków

### Faza 1.5 (gotowe do wykonania — bez ryzyka):
1. Dodać `knip.json` ✅ (zrobione)
2. Wygenerować raport ✅ (ten plik)
3. **DECYZJA UŻYTKOWNIKA**: czy usuwać Listę §5 jednym commitem (jasne risk: niskie)

### Faza 2 (instrumentacja runtime — przed usunięciem ryzykownych):
1. Dodać `console.log("FUNCTION_USED:<name>")` w 27 Netlify funkcjach
2. Dodać log na entry route'ach (dashboard, projects, ai, etc.) — sprawdzić rzeczywiste odwiedziny
3. Dodać `RAISE NOTICE 'RPC_USED:<name>'` w migracji SQL na wszystkie `next_doc_number`, `my_company`, etc.
4. Po 7 dniach produkcji — zebrać statystyki (`pg_stat_user_functions` + Netlify logs)
5. Wówczas zdecydować o liście §6

### Faza 3 (DB):
1. Zapytać `pg_stat_user_tables` dla wszystkich tabel — które mają 0 select/insert?
2. Zlistować RPC nigdy nie wywoływane
3. Zidentyfikować triggers bez efektu

---

## 8. Quality gates

Przed rozpoczęciem usuwania:
- [ ] User akceptuje listę §5
- [ ] Branch `chore/dead-code-cleanup`
- [ ] `tsc --noEmit` clean po usunięciu
- [ ] `npm run build` green
- [ ] Manual test: dashboard, projects, invoices, ksef, portal — wszystko działa
- [ ] Cofnięcie 1 PR-em w razie regresji

---

*Wygenerowano przez audyt knip + cross-reference router.tsx + netlify.toml.*
