# 07 — Compliance checklist (P0 / P1 / P2)

> Każdy task: ID, opis, plik(i), kryterium odbioru. P0 = blocker przed publikacją mobile/produkcją. P1 = enterprise readiness (przed pierwszym kontraktem B2B 50+ users). P2 = nice-to-have / hardening.

---

## 🔴 P0 — BLOCKERY (wymagane przed App Store / Google Play / produkcyjnym mailingiem)

### P0-001 — Ujawnić OpenAI w polityce prywatności + DPA + subprocessor list
- **Pliki:** `docs/legal/02-polityka-prywatnosci.md`, `docs/legal/04-dpa-umowa-powierzenia.md` § 2.2/§ 6, `docs/legal/06-polityka-subprocesorow.md` § 2 tabela
- **Akcje:**
  1. Dodać wiersz „OpenAI, L.L.C. (USA) — AI parsing faktur, transkrypcja głosu, analiza zdjęć"
  2. Załączyć link do DPA OpenAI + zarejestrować się jako Customer w panelu OpenAI z opt-out trenowania.
  3. W polityce prywatności § 5 dodać kategorię „Dostawca AI"
- **Done:** dokumenty zaktualizowane + DPA z OpenAI podpisana + screenshot panelu OpenAI z opt-out trening
- **Owner:** legal + DevOps

### P0-002 — ✅ DONE — Ujawnić Sentry + scrubbing PII
- **Implementacja:** v5.9 — patrz `docs/legal/audit/COMPLIANCE-HARDENING-P0.md`
- **Pliki:** `src/shared/lib/monitoring.ts`, `src/shared/lib/piiScrub.ts`, `netlify/functions/shared/sentry.ts`, `netlify/functions/shared/piiScrub.ts`, `docs/legal/02-polityka-prywatnosci.md` §3.3, `docs/legal/06-polityka-subprocesorow.md`
- **Carryover P1:** zmiana DSN na region UE (`*.ingest.de.sentry.io`) — wymaga przeniesienia projektu w Sentry; Sentry React Native dla mobile.

### P0-003 — ✅ DONE — Self-service account deletion
- **Implementacja:** v5.9 — patrz `docs/legal/audit/COMPLIANCE-HARDENING-P0.md`
- **Pliki:** `netlify/functions/account-delete.ts`, `netlify/functions/cron-account-purge.ts`, `supabase/migrations/168_account_deletion.sql`, `src/features/settings/components/AccountDangerZone.tsx`
- **Edge case obsłużone:** sole-owner-with-members (409), idempotent re-request, 30-day cooling-off + cancel.
- **Carryover P1:** Stripe `subscriptions.cancel` w purge; magic-link reauth dla OAuth-only users.

### P0-004 — ✅ DONE — Self-service data export (RODO art. 20)
- **Implementacja:** v5.9 — patrz `docs/legal/audit/COMPLIANCE-HARDENING-P0.md`
- **Pliki:** `netlify/functions/data-export.ts`, `netlify/functions/data-export-bg-background.ts`, `netlify/functions/cron-export-cleanup.ts`, `supabase/migrations/168_account_deletion.sql` (bucket `exports`), `src/features/settings/components/AccountDangerZone.tsx`
- **Carryover P1:** e-mail po zakończeniu (Resend); multi-part ZIP dla >50MB.

### P0-005 — Push notifications: subprocessor + consent + opt-out
- **Pliki:** `docs/legal/02-polityka-prywatnosci.md`, `docs/legal/06-polityka-subprocesorow.md`, `docs/legal/10-privacy-policy-mobile-addendum.md`, `src/features/settings/...` + `src/app/init/registerPush.ts` (nowy)
- **Akcje:**
  1. Dodać FCM/APNs do subprocesorów.
  2. Wprowadzić ekran consent przed `PushNotifications.requestPermissions()`.
  3. UI Settings: toggle „Powiadomienia push" → DELETE z `device_tokens` przy off.
- **Done:** consent + manifest + docs + opt-out
- **Owner:** Mobile + legal

### P0-006 — Resend dodać do subprocesorów
- **Plik:** `docs/legal/06-polityka-subprocesorow.md`
- **Akcja:** wiersz „Resend, Inc. (USA) — transactional e-mail (zaproszenia, powiadomienia, faktury)"
- **Done:** dokument zaktualizowany
- **Owner:** legal

### P0-007 — Privacy Policy + Cookie Policy URL na produkcji
- **Plik:** `index.html` / `src/features/marketing/components/LandingPage.tsx`
- **Akcja:** podlinkować `/legal/polityka-prywatnosci`, `/legal/polityka-cookies`, `/legal/regulamin` w stopce, linki w App Store/Play.
- **Done:** linki dostępne publicznie bez logowania

### P0-008 — ✅ DONE — Sprzeczność § 3.3 PP usunąć
- **Plik:** `docs/legal/02-polityka-prywatnosci.md` § 3.3
- **Akcja:** zastąpiono tekstem opisującym Sentry, audit log, push, mobile storage (v5.9).

---

## 🟡 P1 — ENTERPRISE READINESS

### P1-001 — DPIA dla AI features
- **Pliki nowe:** `docs/legal/audit/dpia/parse-invoice-ai.md`, `dpia/analyze-room-photo.md`, `dpia/voice-notes.md`
- **Owner:** DPO/legal
- **Done:** 3 dokumenty DPIA + akceptacja DPO

### P1-002 — Cron retencji
- **Pliki:** nowa migracja `167_retention_jobs.sql` z `pg_cron` lub Netlify scheduled function `cleanup-old-logs.ts`
- **Akcja:** czyść `audit_logs`, `signature_events`, `invite_accept_events`, `ksef_events`, `ai_analysis_runs` starsze niż 12/24 mies. (różnicując).
- **Done:** cron uruchomiony, log czyszczeń audytowany

### P1-003 — ✅ DONE — KSeF token: migracja z localStorage
- **Implementacja:** v5.9 — `src/shared/lib/secureStorage.ts` + refactor `useKsefSession.ts` na Capacitor Preferences (Keychain/Keystore-backed). Patrz `docs/legal/audit/COMPLIANCE-HARDENING-P0.md` §3.1, `docs/legal/15-mobile-addendum.md`.
- **Plik:** `src/features/ksef/hooks/useKsefSession.ts`
- **Akcja:** użyć `sessionStorage` (życie sesji KSeF i tak ≤ 2h) lub trzymać w pamięci (React state) bez persystencji.
- **Done:** brak `localStorage.setItem(SESSION_KEY, ...)` w grep

### P1-004 — SCC + DPF audit per processor
- **Plik:** `docs/legal/audit/transfer-mechanisms.md` (nowy)
- **Akcja:** udokumentować każdy processor: SCC moduł 2 lub 3, DPF status, link do registry, data zawarcia DPA.

### P1-005 — Sprzeczność cookies sessionStorage usunąć
- **Plik:** `docs/legal/03-polityka-cookies.md` § 3.1
- **Akcja:** usunąć wiersz „Draft formularzy (sessionStorage)" lub wdrożyć funkcjonalność.

### P1-006 — RoPA + rejestr naruszeń
- **Pliki nowe:** `docs/legal/audit/ropa.md`, `docs/legal/audit/incident-register.md` + tabela `incident_log` (mig.)

### P1-007 — Voice notes: klauzula info + opt-out osób nagrywanych
- **Pliki:** UI `FloatingVoiceButton.tsx`, polityka prywatności
- **Akcja:** modal pre-record: „Upewnij się, że osoby nagrywane wiedzą o nagrywaniu i wyraziły zgodę. Naciskając »Nagrywaj« potwierdzasz, że zebrałeś podstawę prawną."

### P1-008 — MFA (TOTP) dla operatorów
- **Plik:** `src/features/auth/components/MfaSetup.tsx` (nowy), Supabase Auth MFA enable
- **Akcja:** opt-in TOTP w Settings; wymagane dla planu Business; SMS auth NIE (NIST SP 800-63B deprecation).

### P1-009 — Anonimizacja IP w `legal_acceptances`
- **Plik:** mig. nowa, RPC zapisująca `acceptance` z IP zerowanym ostatnim oktetem
- **Done:** zachowany dowód zgody + zgodność z minimalizacją

### P1-010 — security@ alias + pdf disclosure policy
- **Plik:** `docs/legal/audit/08-security-policy.md` + skrzynka security@loftdesk.pl + `.well-known/security.txt`

---

## 🟢 P2 — NICE-TO-HAVE / HARDENING

### P2-001 — CSP nonce-based (usunąć `unsafe-inline`)
- **Plik:** `netlify.toml`, `vite.config.ts` (plugin generujący nonces)

### P2-002 — Ujednolicenie `[WERSJA]` i `[DATA WDROŻENIA]` w docs
- **Pliki:** wszystkie `docs/legal/0*.md`
- **Akcja:** podpiąć do `package.json` version + `legal_acceptances.version`

### P2-003 — Public subprocessor changelog
- **Plik:** `docs/legal/subprocessor-changelog.md`
- **Akcja:** historia zmian z datą + e-mail blast template

### P2-004 — Penetration test (zewnętrzny)
- **Akcja:** OWASP ASVS L2; wynik → załącznik do DPA enterprise

### P2-005 — ISO 27001 / SOC 2 roadmap

### P2-006 — Bug bounty program

### P2-007 — Ujednolicić numerowanie wersji dokumentów + e-mail notyfikacja przed wejściem zmian

### P2-008 — Voice notes: detekcja długości + auto-delete dla draftów

### P2-009 — Podpis offline (PAdES) jako alternatywa dla app-only approval

### P2-010 — Audit log: pseudonymization user_id
