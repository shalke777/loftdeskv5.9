# LoftDesk — Audyt Legal / Privacy / Compliance

**Wersja audytu:** 1.0  
**Data:** 2025-01 (do uzupełnienia w momencie publikacji)  
**Zakres:** LoftDesk v5.9 (web React/Vite + mobile Capacitor v8 — iOS/Android)  
**Repo:** `loftdesk-v5.9-nav-docs-polish` (commit / migracje 000–166)  
**Autor:** automatyczny audyt techniczno-prawny (do akceptacji prawnika)

---

## SPIS TREŚCI

| # | Plik | Zakres |
|---|------|--------|
| 01 | [01-data-inventory.md](./01-data-inventory.md) | Inwentarz danych (PII) — pola, źródło, podstawa RODO, retencja |
| 02 | [02-data-flow-map.md](./02-data-flow-map.md) | Mapa przepływu danych (mermaid + opis) |
| 03 | [03-third-party-processor-register.md](./03-third-party-processor-register.md) | Rejestr subprocesorów (art. 30 RODO) |
| 04 | [04-app-store-privacy-disclosures.md](./04-app-store-privacy-disclosures.md) | App Privacy / Data Safety — odpowiedzi do wklejenia |
| 05 | [05-code-vs-docs-gaps.md](./05-code-vs-docs-gaps.md) | Rozjazdy kod ↔ dokumentacja prawna |
| 06 | [06-legal-risks.md](./06-legal-risks.md) | Ryzyka prawne, DPIA, transfery |
| 07 | [07-compliance-checklist.md](./07-compliance-checklist.md) | Checklisty P0/P1/P2 (z Task ID + plikami) |
| 08 | [08-security-policy.md](./08-security-policy.md) | DRAFT polityki bezpieczeństwa |
| 09 | [09-cookie-policy.md](./09-cookie-policy.md) | DRAFT zaktualizowanej polityki cookies |
| 10 | [10-privacy-policy-mobile-addendum.md](./10-privacy-policy-mobile-addendum.md) | DRAFT addendum mobile (iOS/Android) |
| 11 | [11-dpa-update.md](./11-dpa-update.md) | DRAFT aktualizacji DPA (Sentry, OpenAI, FCM) |
| 12 | [12-tos-mobile-update.md](./12-tos-mobile-update.md) | DRAFT update regulaminu — mobile / IAP |

---

## EXECUTIVE SUMMARY — KLUCZOWE USTALENIA

### 🔴 1. Brak ujawnienia OpenAI w dokumentach prawnych — KRYTYCZNE
Aplikacja przekazuje **treść faktur, zdjęć z budów, transkrypcje głosowe i dane projektowe** do `https://api.openai.com` (USA) w 9 funkcjach Netlify (`parse-invoice-ai.ts`, `analyze-project.ts`, `analyze-room-photo.ts`, `analyze-project-bg-background.ts`, `composite-extract-asset.ts`, `ai-project-assistant.ts`, `voice-extract.ts`, `voice-to-{estimate,expense,note}.ts`, `memory-context.ts`).
**OpenAI nie figuruje na liście subprocesorów** (`docs/legal/06-polityka-subprocesorow.md`), nie jest wymieniony w polityce prywatności ani w DPA.
**Konsekwencja:** naruszenie art. 28 ust. 2 RODO (brak zgody Administratora na subprocesora), brak podstawy transferu poza EOG (art. 44–49 RODO), brak DPIA (art. 35 RODO — przetwarzanie na dużą skalę z użyciem AI).

### 🔴 2. Brak ujawnienia Sentry — naruszenie obowiązku informacyjnego
`src/shared/lib/monitoring.ts:65` inicjalizuje Sentry SDK, wysyła `user.id`, `company_id`, `route`, error message + stack do **sentry.io** (USA, jeśli DSN domyślny). Sentry nie figuruje w polityce subprocesorów ani prywatności.

### 🔴 3. Brak endpointu usunięcia konta i eksportu danych (RODO art. 15, 17, 20)
W całym kodzie (`netlify/functions/`, `src/`) **nie istnieje** żaden endpoint typu `delete-account` ani `export-data`. Polityka retencji `09-polityka-retencji.md` § 5.1 deklaruje tryb **manualny przez e-mail** — to jest legalnie dopuszczalne, ale:
- App Store **wymaga** mechanizmu usuwania konta z poziomu aplikacji (Apple Guideline 5.1.1(v) — od 2022),
- Google Play **rekomenduje** to samo (Account Deletion requirement, od 2024).
**Bez endpointu w aplikacji apka nie zostanie zaakceptowana w App Store.**

### 🔴 4. Brak ujawnienia push notifications + FCM/APNs
`@capacitor/push-notifications`, tabela `device_tokens` (mig. 166) — token urządzenia identyfikuje urządzenie/użytkownika, jest danym osobowym. Brak wzmianki o FCM (Google) i APNs (Apple) jako subprocesorach. Brak procedury zgody (push consent) w aplikacji.

### 🟡 5. Polityka retencji deklaruje 12 miesięcy logów IP — w kodzie brak job'ów retencji
`docs/legal/09-polityka-retencji.md` § 2 wskazuje retencję logów IP/sesji do 12 miesięcy, ale w `supabase/migrations/` **nie istnieje** żadna funkcja/cron czyszcząca starsze logi. `audit_logs` (mig. 003), `signature_events`, `invite_accept_events` rosną w nieskończoność.

### 🟡 6. KSeF tokeny w `localStorage` — ryzyko XSS
`src/features/ksef/hooks/useKsefSession.ts:58,103` zapisuje token sesyjny KSeF do `localStorage`. Token KSeF jest danym uwierzytelniającym do API skarbowego — w razie XSS atakujący przejmuje sesję podatkową firmy.

### 🟡 7. AI parsing faktur klientów = HIGH-RISK → DPIA wymagana
Faktury kosztowe (`parse-invoice`/`parse-invoice-ai`) zawierają dane kontrahentów (NIP, nazwa, adres). Te dane Administrator przekazuje OpenAI **bez zgody kontrahenta** i **bez DPIA**. Zgodnie z guidelines EROD 2018/01 — wymagana DPIA.

### 🟡 8. Resend/email provider niewymieniony
`check-overdue-invoices.ts:234`, `notify-approval-response.ts:144`, `send-document.ts:184`, `send-invitation.ts:121` — używają `RESEND_API_KEY` (Resend, USA). Nie ma w polityce subprocesorów.

### 🟢 9. Stripe webhook: poprawnie zweryfikowany
`stripe-webhook.ts:135–150` — używa `STRIPE_WEBHOOK_SECRET` i `stripe.webhooks.constructEvent`. ✅

### 🟢 10. RLS multi-tenant: zaimplementowane konsekwentnie
Migracje 002, 007, 022, 042, 043, 132–133, 140–145 — RLS na poziomie `company_id` z `my_company_id()` SECURITY DEFINER. ✅

---

## TOP 5 P0 BLOCKERÓW (przed publikacją mobile/produkcją)

1. **[P0-001]** Dodać OpenAI do `06-polityka-subprocesorow.md` + DPA + polityki prywatności jako transfer do USA na podstawie SCC + DPF; uzyskać podpisaną BAA/DPA z OpenAI Inc.
2. **[P0-002]** Dodać Sentry do listy subprocesorów; wdrożyć `beforeSend` scrubbing PII (e-mail, NIP, telefony).
3. **[P0-003]** Zaimplementować endpoint `delete-account` (Netlify Function + UI w Settings) — wymóg Apple Guideline 5.1.1(v).
4. **[P0-004]** Zaimplementować endpoint `export-data` (JSON/ZIP wszystkich danych użytkownika) — RODO art. 20.
5. **[P0-005]** Dodać FCM/APNs do subprocesorów + ujawnienie push tokens jako device identifiers w privacy policy + permissions consent flow w aplikacji.

## TOP 5 P1 (enterprise readiness)

1. **[P1-001]** Wykonać DPIA (art. 35 RODO) dla AI parsing faktur i analizy zdjęć — `parse-invoice-ai.ts`, `analyze-room-photo.ts`.
2. **[P1-002]** Cron retencji: usuwanie `audit_logs`, `signature_events`, `invite_accept_events` starszych niż 12 mies.
3. **[P1-003]** Migracja KSeF tokenu z `localStorage` do `sessionStorage` lub Supabase row z RLS (encrypted at rest).
4. **[P1-004]** Rejestr czynności przetwarzania (RoPA, art. 30) jako dokument operacyjny + rejestr naruszeń (art. 33).
5. **[P1-005]** SCC + DPF compliance audit per processor (Stripe, Supabase, Netlify, OpenAI, Sentry, Resend, Google FCM, Apple APNs) + opt-in dla EU-US Data Privacy Framework.

## NAJWAŻNIEJSZE NIEŚCISŁOŚCI (kod ↔ dokumentacja)

1. **OpenAI wykonuje przetwarzanie faktur, zdjęć, transkrypcji głosu** (`netlify/functions/parse-invoice-ai.ts:340`, `analyze-room-photo.ts:540`, `voice-extract.ts:29`) — **w żadnym dokumencie legal nie ma o tym wzmianki**.
2. **Polityka prywatności § 3.3** mówi „Aplikacja nie stosuje zewnętrznych narzędzi analitycznych" — ale Sentry SDK jest aktywny (`src/shared/lib/monitoring.ts:65`) i wysyła telemetrię (tracesSampleRate 0.2 w prod).
3. **Polityka retencji § 2** deklaruje retencję 12 mies. dla logów technicznych i 5 lat dla logów audytowych — w kodzie brak jakiejkolwiek implementacji retencji (`audit_logs`, `signature_events`, `invite_accept_events`, `ksef_events`, `ai_analysis_runs` rosną bez ograniczeń).

## REKOMENDACJE (top 10)

1. Zaktualizować subprocessor list **przed** publikacją w App Store/Google Play.
2. Wdrożyć `delete-account` + `export-data` jako Netlify Functions z uwierzytelnieniem JWT.
3. Skonfigurować Sentry data scrubbing (`Sentry.beforeSend` z regex usuwającym NIP, e-maile, telefony, JWT).
4. Podpisać DPA z OpenAI (https://openai.com/policies/data-processing-addendum) i włączyć opt-out z trenowania modeli (already domyślnie wyłączony dla API od 2023, ale udokumentować).
5. Migrować KSeF token z `localStorage` do bazy z RLS lub krótko żyjących sesji w pamięci.
6. Dodać consent flow dla push notifications (mobile) + opt-out w Settings.
7. Zaimplementować cron retencji (`pg_cron` lub Netlify scheduled function) dla wszystkich tabel audit/log.
8. Wykonać DPIA dla AI features i opublikować abstrakt w polityce prywatności.
9. Dodać Apple/Google Data Safety forms (gotowe odpowiedzi w `04-app-store-privacy-disclosures.md`).
10. Opublikować `security@loftdesk.pl` jako kanał zgłaszania incydentów + procedurę 72h response.

---

*Audyt wygenerowany na podstawie skanu kodu źródłowego, migracji SQL, manifestów mobile i dokumentów `docs/legal/00–14`. Wymagana akceptacja kwalifikowanego prawnika RODO przed wdrożeniem treści.*
