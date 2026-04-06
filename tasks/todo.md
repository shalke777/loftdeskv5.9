# A7 — Pełny system Voice Notes (notatek głosowych)

## Klasyfikacja
TYPE: feature | RISK: HIGH | SCOPE: full-stack | AREA: AI extraction / Voice Notes

## Plan implementacji

### [ ] 1. Migration `supabase/migrations/111_voice_notes.sql`
   - Tabela voice_notes (id, company_id, project_id, title, transcript, audio_url, status, extracted_result, timestamps)
   - Indeksy: company_idx, project_idx (WHERE project_id IS NOT NULL), status_idx
   - RLS: SELECT/INSERT/UPDATE/DELETE dla my_company_id()

### [ ] 2. API `src/features/notes/api/voice-notes.api.ts`
   - Interfejsy: VoiceNote, VoiceNoteExtractedResult, CreateVoiceNoteInput
   - Metody: create, listByCompany, listByProject, markProcessed, markProcessing, markError, delete

### [ ] 3. Netlify function `netlify/functions/voice-extract.ts`
   - POST { note_id } + Bearer auth
   - Pobiera transcript z voice_notes
   - GPT-4o → extracted_result (summary, action_items, amounts, decisions, estimate_hint)
   - Zapisuje extracted_result + status: 'processed'

### [ ] 4. Dodaj timeout do `netlify.toml`
   - `[functions."voice-extract"] timeout = 30`

### [ ] 5. Przebuduj `src/shared/components/FloatingVoiceButton.tsx`
   - Wywoływanie voice-to-note → transcript → voiceNotesApi.create()
   - Toast "✓ Notatka zapisana"
   - Timer nagrywania (MM:SS)

### [ ] 6. Stwórz `src/features/notes/components/VoiceNotesList.tsx`
   - Lista notatek z [Ekstraktuj] button
   - Expanded view z extracted_result
   - CTA: Stwórz wycenę

### [ ] 7. Aktualizuj `src/app/routes/ai.tsx`
   - Dodaj VoiceNotesList na górze strony

### [ ] 8. (Opcjonalnie) Dodaj VoiceNotesList do ProjectDetail.tsx

### [ ] 9. Quality gates: tsc 0 + build clean + commit + push

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
