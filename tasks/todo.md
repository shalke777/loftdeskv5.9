# Sprint LP+KSeF — Landing Copy Polish + KSeF UX

## Klasyfikacja
TYPE: polish | RISK: MEDIUM | SCOPE: cross-module | AREA: marketing + ksef

## Plan

### [ ] 1. LandingPage.tsx — zmień CTA href z `/login` → `/app` (3 miejsca)
### [ ] 2. LandingPage.tsx — stare gradienty (#0E2A1A, #163C24) — NIE ZNALEZIONO, skip
### [ ] 3. LandingPage.tsx — copy + KSeF badge + efekty — już poprawne, skip
### [ ] 4. KsefPage.tsx — empty state: ikona + "Brak faktur do wysłania" (wymiana prostego `<p>`)
### [ ] 5. KsefPage.tsx — inline ksef_error hint w wierszu tabeli (brak pola error_message w modelu — static hint)
### [ ] 6. Quality gates: tsc 0 + build clean
### [ ] 7. git commit + push

---

# A7 — Pełny system Voice Notes (notatek głosowych)

## Klasyfikacja
TYPE: feature | RISK: HIGH | SCOPE: full-stack | AREA: AI extraction / Voice Notes

## Plan implementacji

### [x] 1. Migration `supabase/migrations/111_voice_notes.sql`
### [x] 2. API `src/features/notes/api/voice-notes.api.ts`
### [x] 3. Netlify function `netlify/functions/voice-extract.ts`
### [x] 4. Dodaj timeout do `netlify.toml`
### [x] 5. Przebuduj `src/shared/components/FloatingVoiceButton.tsx`
### [x] 6. Stwórz `src/features/notes/components/VoiceNotesList.tsx`
### [x] 7. Aktualizuj `src/app/routes/ai.tsx`
### [ ] 8. (Opcjonalnie) Dodaj VoiceNotesList do ProjectDetail.tsx
### [x] 9. Quality gates: tsc 0 + build clean + commit a8401a5

---

# A6 — FAB voice note → project notes + voice expense in /expenses

## Klasyfikacja
TYPE: feature | RISK: MEDIUM | SCOPE: cross-module | AREA: AI + projects + expenses

## Plan implementacji

### [x] 1. Utwórz `netlify/functions/voice-to-note.ts` (Whisper only, bez GPT)
### [x] 2. Przebuduj `FloatingVoiceButton.tsx` (project note flow + modal fallback)
### [x] 3. Zaktualizuj `ProjectNotes.tsx` (reaktywne nasłuchiwanie custom event)
### [x] 4. Zaktualizuj `ExpensesPage.tsx` (przyciski głosowe desktop + mobile)
### [x] 5. Dodaj `[functions."voice-to-note"] timeout = 60` w `netlify.toml`
### [x] 6. Quality gates: tsc 0 + build clean + commit + push

---

# A5 — FAB Voice Button + Cleanup AI w projektach

## Klasyfikacja
TYPE: feature | RISK: MEDIUM | SCOPE: cross-module | AREA: AI extraction + expenses + UI

## Plan implementacji

### [x] 1. ProjectDetail.tsx — usuń sekcję Asystent AI
### [x] 2. ProjectExpensesTab.tsx — usuń głos
### [x] 3. voice-to-expense.ts — przebuduj na array wydatków
### [x] 4. FloatingVoiceButton.tsx — nowy komponent FAB
### [x] 5. _auth.tsx — dodaj FAB do operatora
### [x] 6. Quality gates ✅ tsc 0 errors, build clean, committed

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
