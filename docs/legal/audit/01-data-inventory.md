# 01 — Inwentarz danych osobowych (Data Inventory)

**Cel:** kompletna mapa danych osobowych przetwarzanych przez LoftDesk wraz z podstawą prawną (art. 6 RODO), retencją, możliwością eksportu i usunięcia.

> Każdy wiersz oznaczony **[NOT IMPLEMENTED]** wskazuje brakującą funkcjonalność wymagającą realizacji (P0/P1 — patrz `07-compliance-checklist.md`).

---

## A. DANE LOFTBAU JAKO ADMINISTRATOR (Użytkownicy = klienci SaaS)

| Kategoria | Konkretne pola | Źródło (kod / tabela) | Podstawa RODO | Retencja | Eksport | Usunięcie |
|---|---|---|---|---|---|---|
| Konto auth | `auth.users.email`, `auth.users.id`, `encrypted_password` | Supabase Auth (managed) | art. 6.1.b | Do usunięcia + 30 dni backup | NOT IMPL. — manualnie e-mail | NOT IMPL. — manualnie e-mail |
| Profil firmy (Administrator) | `companies.name`, `companies.nip`, `companies.regon`, `companies.address_*`, `companies.bank_account`, `companies.logo_url` | mig. 001, 027, 030 | art. 6.1.b + 6.1.c | 5 lat (Ustawa o rachunkowości) | NOT IMPL. | NOT IMPL. |
| Członkostwo zespołu | `company_members.user_id`, `company_members.role` | mig. 028 | art. 6.1.b | Do opuszczenia firmy | – | CASCADE on user delete |
| Historia logowań / sesji / IP | NOT IMPLEMENTED — Supabase Auth gromadzi logi po stronie Supabase Dashboard | Supabase managed | art. 6.1.f | Polityka deklaruje 12 mies. — **brak implementacji retencji** | – | – |
| Subskrypcja Stripe | `company_billing.stripe_customer_id`, `stripe_subscription_id`, `plan`, `status` | mig. 036, 153 | art. 6.1.b | Do anulacji + 5 lat (rachunkowość) | – | – |
| Akceptacje legal | `legal_acceptances.user_id`, `document_key`, `version`, `accepted_at`, `ip` | mig. 031, 064, 156 | art. 6.1.b + dowód zgody | 6 lat (przedawnienie + dowód) | – | – |

## B. DANE KLIENTÓW UŻYTKOWNIKA (loftbau jako podmiot przetwarzający — DPA)

| Kategoria | Pola | Źródło | Podstawa | Retencja | Eksport | Usunięcie |
|---|---|---|---|---|---|---|
| Klient/kontrahent | `clients.name`, `clients.email`, `clients.phone`, `clients.nip`, `clients.address`, `clients.pesel` (opcjonalnie) | mig. 040, 125 | wg. polecenia Administratora | wg. § 9 polityki retencji | NOT IMPL. (export per client) | manualnie przez UI |
| Faktury sprzedaży | `invoices.*` (numer, dane klienta, kwoty, NIP) | mig. 032, 119–122, 134–137 | art. 6.1.c (rachunkowość) — po stronie Użytkownika | 5 lat | UI export PDF/XML | nie usuwa się (obowiązek) |
| Faktury kosztowe | `expenses.*`, `expense_invoices.*` (NIP dostawcy, kwoty) | mig. 033, 038, 122 | art. 6.1.c | 5 lat | UI | nie usuwa się |
| Wyceny | `estimates.*`, `estimate_items.*` | mig. 001+ | art. 6.1.b | bezterminowo (do usunięcia projektu) | UI PDF | UI delete |
| Umowy | `contracts.*`, `contract_penalties` | mig. 056, 057, 124 | art. 6.1.b/c | 6 lat (przedawnienie) | UI PDF | UI |
| Projekty | `projects.*`, `project_documents`, `project_memory_entries` | mig. 034, 067, 113 | art. 6.1.b | wg. polecenia | UI | UI (hard_delete_project_rpc — mig. 060/061) |
| Komunikacja portal | `conversations`, `messages`, `client_notifications`, `operator_notifications` | mig. 033, 062–066, 070 | art. 6.1.b/f | 3 lata (obrona roszczeń) | – | CASCADE |
| Pliki/zdjęcia/podpisy | `storage.objects` w bucketach: `company-logos`, `company-files`, `ai-inputs`, `voice-notes`, `signature_artifacts` | mig. 030, 037, 039, 083, 128, 072 | art. 6.1.b/f | wg. polecenia | UI download | UI delete |
| Podpisy elektroniczne | `signature_requests`, `signature_events`, `signature_artifacts`, `signature_participants` | mig. 072–077 | art. 6.1.b/f + dowód zawarcia umowy | 6 lat (eIDAS + dochodzenie roszczeń) | UI | NIE usuwać przed terminem (dowód) |
| Dane głosowe | `voice_notes.*`, `voice_notes` bucket | mig. 111, 112, 128 | art. 6.1.b + zgoda osoby nagrywanej (jeśli dotyczy) | wg. polecenia | UI | UI |
| AI input/output | `ai_analysis_runs`, `ai_extraction_results`, `ai_estimate_source_link`, `ai_input_assets`, `ai_governance_*`, `ai_inputs` bucket | mig. 083–108 | art. 6.1.f + DPA z OpenAI **[NOT IMPLEMENTED]** | wg. polecenia | UI | UI |

## C. DANE TECHNICZNE / DEVICE

| Kategoria | Pola | Źródło | Podstawa | Retencja | Eksport | Usunięcie |
|---|---|---|---|---|---|---|
| Push token | `device_tokens.token`, `platform`, `user_id` | mig. 166 | art. 6.1.f (komunikacja) | przy revoke FCM/APNs | – | CASCADE on user delete |
| KSeF token sesyjny | `localStorage['loftdesk.ksef.session.v2']` | `src/features/ksef/hooks/useKsefSession.ts:58` | art. 6.1.b/c | sesja KSeF (≤ 1h auth, 2h session) | – | clear on logout — **NIE WERYFIKOWANE** |
| KSeF historia wysyłek | `localStorage['loftdesk.ksef.history']` | `src/services/ksef/ksef.service.ts:406` | art. 6.1.f | 300 ostatnich rekordów | – | clear browser |
| Cookie banner dismiss | `localStorage['loftdesk-cookie-notice-dismissed']` | `src/features/legal/components/CookieBanner.tsx:4` | art. 6.1.f | trwale | – | clear browser |
| Theme/preferencje UI | `localStorage` w `useTheme.ts:58`, `useLocalStorage.ts:16` | – | art. 6.1.f | trwale | – | clear browser |
| Invite intent | `localStorage['loftdesk-invite-records']` | `src/shared/lib/inviteIntent.ts:40` | art. 6.1.b (ułatwienie rejestracji) | 30 dni | – | – |
| Demo data (tryb demo) | `localStorage` `demoDb.ts` | tylko tryb demo | n/d | – | – | – |
| Auth session (mobile) | Capacitor `Preferences` (iOS Keychain / Android SharedPreferences) | `src/shared/lib/nativeAuthStorage.ts` | art. 6.1.b | refresh do 7 dni | – | logout/uninstall |
| Auth session (web) | `localStorage` (Supabase domyślnie) | `src/shared/lib/supabase.ts` | art. 6.1.b | refresh | – | logout |
| Sentry breadcrumbs / extras | `event.tags = { user.id, company_id, role, plan, route, area }` | `src/shared/lib/monitoring.ts:128–141` | art. 6.1.f | 90 dni (default Sentry) | – | – |

## D. DANE PODATKOWE (KSeF)

| Pole | Źródło | Retencja |
|---|---|---|
| KSeF reference / status | `invoices.ksef_reference`, `ksef_send_status`, `ksef_last_error`, `ksef_number` | mig. 135–137 |
| KSeF audit events | `ksef_events` | mig. 136 — **brak retencji w kodzie**, prawne min. 5 lat |
| Faktury w KSeF API | przesyłane do `https://api.ksef.mf.gov.pl` | przechowywane w KSeF — Ministerstwo Finansów RP (administrator równoległy) |

---

## PODSUMOWANIE — luki

| Luka | Plik docelowy / Task |
|---|---|
| Brak `delete-account` Netlify function | P0-003 |
| Brak `export-data` (RODO art. 20) | P0-004 |
| Brak retencji `audit_logs`, `signature_events`, `ai_analysis_runs`, `ksef_events` | P1-002 |
| Brak ujawnienia `device_tokens` w polityce | P0-005 |
| Brak ujawnienia AI input assets (faktury → OpenAI) | P0-001 |
| Brak ujawnienia Sentry user/company tagów | P0-002 |
