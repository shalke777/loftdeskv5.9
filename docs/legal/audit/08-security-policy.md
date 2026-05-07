# 08 — Polityka bezpieczeństwa LoftDesk (DRAFT)

**Wersja:** [WERSJA]  
**Data wejścia w życie:** [DATA WDROŻENIA]  
**Właściciel:** loftbau, Piotr Szalecki | **Kontakt CISO/Security:** security@loftdesk.pl  
**Status:** DRAFT do akceptacji prawnej i operacyjnej.

---

## 1. Cel i zakres

Niniejsza Polityka określa techniczne i organizacyjne środki bezpieczeństwa stosowane w LoftDesk zgodnie z art. 32 RODO oraz dobrymi praktykami branży SaaS B2B.

Zakres: aplikacja webowa (PWA), aplikacje mobilne (iOS, Android), backend Supabase + Netlify Functions, integracje (Stripe, OpenAI, Sentry, Resend, FCM/APNs, KSeF).

## 2. Model bezpieczeństwa

### 2.1. Multi-tenancy + RLS
- Każdy rekord biznesowy zawiera `company_id` (UUID).
- Row-Level Security (RLS) wymusza filtrację per `my_company_id()` (mig. 002, 007, 022, 042, 080, 132–145).
- `SECURITY DEFINER` funkcje pomocnicze mają jawnie ograniczony `search_path` (mig. 058, 059).
- Brak możliwości obejścia z poziomu klienta — anon key + JWT podlegają RLS.

### 2.2. Service-role key
- `SUPABASE_SERVICE_ROLE_KEY` używany **wyłącznie** w Netlify Functions (BFF) — nigdy w bundle frontendowym.
- Każda funkcja BFF, która używa service-role, weryfikuje JWT użytkownika (np. `parse-invoice-ai.ts:60`, `stripe-checkout.ts:56`) i wykonuje autoryzację biznesową w warstwie aplikacyjnej.

### 2.3. JWT
- Supabase Auth JWT (HS256, secret zarządzany przez Supabase).
- Odświeżanie automatyczne (`autoRefreshToken: true`).
- Storage native: Capacitor Preferences (iOS Keychain / Android SharedPreferences).
- Storage web: `localStorage` (default Supabase).
- Magic link / OTP — Supabase Auth, link na `loftdesk.pl/auth/callback` (Universal Links / App Links zweryfikowane przez `apple-app-site-association` / `assetlinks.json`).

### 2.4. Stripe webhook
- Każdy event weryfikowany przez `stripe.webhooks.constructEvent` z `STRIPE_WEBHOOK_SECRET` (`netlify/functions/stripe-webhook.ts:135–150`).

## 3. Szyfrowanie

| Warstwa | Mechanizm |
|---|---|
| Tranzyt HTTPS | TLS 1.2+ wymuszony przez Netlify, Supabase, OpenAI, Stripe, KSeF |
| Spoczynek (DB) | AES-256 (Supabase managed, AWS KMS) |
| Spoczynek (Storage) | AES-256 (Supabase Storage / S3-compatible) |
| Hasła | bcrypt (Supabase Auth managed) |
| KSeF tokeny | TODO (P1-003) — sessionStorage / in-memory |
| Backups | szyfrowane w spoczynku przez Supabase |

## 4. Kontrola dostępu

### 4.1. Role
- `service_role` — tylko Netlify Functions
- `authenticated` (JWT) — użytkownicy
- `anon` — publiczne endpointy (rejestracja, magic link)
- Aplikacja: role aplikacyjne `owner`, `member`, `client`, `viewer` (mig. 028, 040, 076)

### 4.2. MFA (roadmap P1-008)
- TOTP via Supabase Auth — opt-in dla wszystkich, wymóg dla Plan Business (po wdrożeniu).
- SMS NIE — niezgodne z NIST SP 800-63B (rev.4).

### 4.3. Sesje
- Web: refresh token rotation, idle timeout = brak (do weryfikacji P2).
- Mobile: persistent w Keychain, kasowane przy logout.

## 5. Dziennik zdarzeń (audit logging)

- `audit_logs` (mig. 003) — generyczne zdarzenia
- `signature_events` (mig. 072) — immutable
- `ksef_events` (mig. 136) — interakcje KSeF
- `invite_accept_events` (mig. 146) — akceptacje zaproszeń
- `ai_analysis_runs` (mig. 084) — wywołania AI

Retencja: P1-002 cron (12 mies. dla logów technicznych, 5 lat dla finansowych).

## 6. Bezpieczeństwo aplikacji

### 6.1. CSP
`netlify.toml:51` — `default-src 'self'`, `connect-src` z whitelistą:
- `https://*.supabase.co`, `wss://*.supabase.co`
- `https://api.stripe.com`, `https://js.stripe.com`, `https://hooks.stripe.com`
- `https://api.ksef.mf.gov.pl` + test/demo

> ⚠️ Po wdrożeniu OpenAI/Sentry/Resend należy rozszerzyć `connect-src` o `api.openai.com`, `*.ingest.de.sentry.io`, `api.resend.com` (przed go-live).

### 6.2. Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`

### 6.3. Rate limiting
- AI: `ai_rate_limits_persistent` (mig. 099)
- Auth: Supabase managed
- Public: Netlify edge protection

### 6.4. Walidacja
- `zod` (npm package.json) — wszystkie wejścia z formularzy
- SQL injection: prevention przez postgrest + parametryzowane RPC (`SECURITY DEFINER`)

## 7. Incident Response

### 7.1. Kontakt
- **security@loftdesk.pl** — kanał zgłaszania podatności (PGP key: TBD)
- **szalecki.p@gmail.com** — fallback
- `.well-known/security.txt` (P1-010)

### 7.2. Procedura 72h (art. 33 RODO)
1. **T+0:** Wykrycie incydentu (Sentry alert / user report / monitoring).
2. **T+1h:** Triage (obszar dotknięty, kategorie danych, liczba osób).
3. **T+24h:** Zatrzymanie wycieku, izolacja, audyt logów.
4. **T+48h:** Notyfikacja DPO/legal, decyzja o zgłoszeniu PUODO.
5. **T+72h:** Zgłoszenie PUODO (jeśli ryzyko dla osób) — formularz GDPR.GOV.PL.
6. **T+72h+:** Powiadomienie poszkodowanych (jeśli wysokie ryzyko, art. 34).
7. Wpis do `incident-register.md` (P1-006).

### 7.3. Komunikacja
- Templaty notyfikacji w `docs/legal/audit/templates/incident-notification-*.md` (do przygotowania).

## 8. Backup & Disaster Recovery

- Supabase PITR (Point-in-Time Recovery) — do 7 dni (Pro plan)
- Brak własnych snapshotów (P2: rozważyć eksport off-site co 24h)
- RTO/RPO: nieformalne (zgodnie z `09-polityka-retencji.md` § 6.2 — brak SLA)

## 9. Dostawcy zewnętrzni

Patrz `03-third-party-processor-register.md`. Każdy nowy dostawca podlega ocenie (DPA, SCC, audyty) przed integracją.

## 10. Szkolenia i odpowiedzialność

- Zobowiązanie pracowników/współpracowników do zachowania tajemnicy (DPA § 4.1.b).
- Szkolenia RODO co 12 miesięcy (do wdrożenia operacyjnie).

## 11. Audyt i przegląd

- Polityka rewidowana co 12 mies. lub przy istotnej zmianie architektury.
- Audyt zewnętrzny: planowany przed sprzedażą Enterprise (P2-004).

---

*loftbau, Piotr Szalecki | security@loftdesk.pl | NIP 8732958793*
