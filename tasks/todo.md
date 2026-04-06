# A5 — FAB Voice Button + Cleanup AI w projektach

## Klasyfikacja
TYPE: feature | RISK: MEDIUM | SCOPE: cross-module | AREA: AI extraction + expenses + UI

## Plan implementacji

### [ ] 1. ProjectDetail.tsx — usuń sekcję Asystent AI
### [ ] 2. ProjectExpensesTab.tsx — usuń głos
### [ ] 3. voice-to-expense.ts — przebuduj na array wydatków
### [ ] 4. FloatingVoiceButton.tsx — nowy komponent FAB
### [ ] 5. _auth.tsx — dodaj FAB do operatora
### [ ] 6. Quality gates

---

# A4 — Szybki kosztorys głosowy (Voice Estimate)

## Klasyfikacja
- TYPE: feature
- RISK: MEDIUM
- SCOPE: cross-module
- AREA: estimates, voice AI

## Plan

- [x] 1. Utwórz `netlify/functions/voice-to-estimate.ts` (Whisper + GPT-4o-mini)
- [x] 2. Dodaj `[functions."voice-to-estimate"] timeout = 26` w `netlify.toml`
- [x] 3. Zaktualizuj `EstimatesPage.tsx` — przycisk głosowy + MediaRecorder + zapis do sessionStorage + otwarcie modala
- [x] 4. Zaktualizuj `EstimateForm.tsx` — rozszerz `isAiDraft` o `voice_whisper`
- [x] 5. `npx tsc --noEmit` — 0 błędów
- [x] 6. `npm run build` — clean
- [x] 7. Commit

## Kluczowe decyzje
- EstimateForm czyta draft z sessionStorage (`estimate_form_draft`) → wystarczy go zapisać przed otwarciem modala
- Mapowanie AI items: `description → name`, generuj `id` (crypto.randomUUID()), `sort_order = idx`
- `_source: 'voice_whisper'` w drafcie → EstimateForm pokazuje baner AI
- Auth token przez `supabase.auth.getSession()` (wzorzec z ProjectExpensesTab)
