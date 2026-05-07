# 05 — Rozjazdy: kod vs dokumentacja prawna

> Każda pozycja zawiera: **cytat z kodu / migracji** (po lewej) i **cytat z dokumentu legal** (po prawej). Kategoria ryzyka: 🔴 KRYTYCZNE / 🟡 ŚREDNIE / 🟢 NISKIE.

---

### 🔴 GAP #1 — OpenAI brak w subprocesorach

**Kod:** `netlify/functions/parse-invoice-ai.ts:340–342`
```ts
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  return err(503, 'ai_not_configured', 'OPENAI_API_KEY is not set in Netlify environment variables', ...)
}
```
oraz `shared/openai-retry.ts:67`: `const url = 'https://api.openai.com/v1/responses'`

**Dokument:** `docs/legal/06-polityka-subprocesorow.md` § 2 — lista subprocesorów: tylko Stripe, Supabase, Netlify, GitHub, Google. **OpenAI nie wymieniony.**

**Naruszenie:** art. 28 ust. 2 RODO (brak uprzedniej zgody Administratora na sub-processor), art. 13 ust. 1 lit. e RODO (brak ujawnienia odbiorcy danych), art. 44 RODO (brak udokumentowanego mechanizmu transferu poza EOG).

**Akcja:** P0-001.

---

### 🔴 GAP #2 — Sentry brak w subprocesorach + sprzeczność z PP § 3.3

**Kod:** `src/shared/lib/monitoring.ts:65–106`
```ts
Sentry.init({ dsn: SENTRY_DSN, environment: ..., tracesSampleRate: IS_PROD ? 0.2 : 1.0, ... })
// linia 128–141:
Sentry.setUser({ id: user.id })
Sentry.setTag('loftdesk.company_id', user.companyId)
Sentry.setTag('loftdesk.role', user.role)
Sentry.setTag('loftdesk.plan', user.plan)
```

**Dokument:** `docs/legal/02-polityka-prywatnosci.md` § 3.3 (linia 53):
> „W aktualnej wersji Aplikacja **nie stosuje zewnętrznych narzędzi analitycznych** ani marketingowych."

**Sentry to narzędzie telemetrii (analytics + monitoring)** — sprzeczność wprost. Dodatkowo `tracesSampleRate: 0.2` oznacza próbkowanie wydajności (performance analytics).

**Naruszenie:** art. 13 RODO + zasada przejrzystości (art. 5.1.a RODO).

**Akcja:** P0-002.

---

### 🔴 GAP #3 — Brak endpointu `delete-account`

**Kod:** brak — szukanie `delete-account` zwraca tylko wzmianki w `audit-runtime-template.md` i `landing-page.html`. **Żadna funkcja Netlify ani komponent UI nie istnieje.**

**Dokument:** `docs/legal/09-polityka-retencji.md` § 5.1:
> „Użytkownik może zażądać usunięcia Konta w dowolnym momencie, przesyłając wniosek na adres szalecki.p@gmail.com z tytułem »USUNIĘCIE KONTA«."

**Naruszenie:**
- App Store Guideline 5.1.1(v) — wymaga in-app deletion;
- art. 17 RODO (prawo do usunięcia) — tryb manualny e-mail jest dopuszczalny prawnie, ale niezgodny z polityką sklepów;
- Google Play Account Deletion Requirement (od 2023) — wymaga URL-a do usunięcia poza aplikacją + opcji w aplikacji jeśli to możliwe.

**Akcja:** P0-003.

---

### 🔴 GAP #4 — Brak endpointu `export-data`

**Kod:** brak.

**Dokument:** `docs/legal/02-polityka-prywatnosci.md` § 7 deklaruje prawo do przeniesienia danych (art. 20 RODO) — „Tylko dane przetwarzane na podstawie zgody lub umowy". DPA § 4.1.e: „Pomoc ograniczona do funkcjonalności eksportu dostępnych w Aplikacji". **W aplikacji eksportów per-encja są (PDF faktur), ale nie ma globalnego eksportu wszystkich danych konta.**

**Naruszenie:** art. 20 RODO — prawo do przenoszenia.

**Akcja:** P0-004.

---

### 🔴 GAP #5 — Push notifications + device_tokens brak ujawnienia

**Kod:** `supabase/migrations/166_device_tokens.sql:14–21`
```sql
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY ...,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')), ...
)
```
+ `capacitor.config.ts:63`: `PushNotifications` plugin aktywny.

**Dokument:** brak. Polityka prywatności nie wymienia push tokens. Polityka subprocesorów nie wymienia FCM/APNs.

**Naruszenie:** art. 13 RODO; ePrivacy Directive 2002/58/EC art. 5(3) (cookie/storage consent — dotyczy też tokenów na urządzeniu).

**Akcja:** P0-005.

---

### 🟡 GAP #6 — Resend (e-mail provider) niewymieniony

**Kod:** `netlify/functions/send-invitation.ts:121`, `send-document.ts:184`, `notify-approval-response.ts:144`, `check-overdue-invoices.ts:234`:
```ts
headers: { Authorization: `Bearer ${resendKey}`, ... }
```

**Dokument:** Subprocessor list wymienia tylko Google Workspace/Gmail jako e-mail provider — błędne, Workspace służy supportowi, ale **transactional e-maile (zaproszenia, faktury, powiadomienia) idą przez Resend**.

**Akcja:** P0-006 (dodać do `06-polityka-subprocesorow.md`).

---

### 🟡 GAP #7 — Polityka deklaruje retencję 12 mies. dla logów — brak implementacji

**Dokument:** `docs/legal/09-polityka-retencji.md` § 2:
> „Logi techniczne / bezpieczeństwa (IP, logowania, sesje) — Maksymalnie 12 miesięcy od zdarzenia"

**Kod:** `supabase/migrations/003_audit_logs.sql` tworzy `audit_logs` ale **nie ma funkcji ani crona usuwającego rekordy starsze niż 12 mies.** Analogicznie: `signature_events` (mig. 072), `ai_analysis_runs` (mig. 084), `ksef_events` (mig. 136), `invite_accept_events` (mig. 146).

**Naruszenie:** art. 5.1.e RODO (minimalizacja czasu przechowywania).

**Akcja:** P1-002.

---

### 🟡 GAP #8 — KSeF token w localStorage

**Kod:** `src/features/ksef/hooks/useKsefSession.ts:58,103`:
```ts
localStorage.setItem(SESSION_KEY, JSON.stringify(s))
```

**Dokument:** `03-polityka-cookies.md` § 3.1 wymienia tylko „Sesja użytkownika (token auth)" Supabase — **nie wspomina o KSeF tokenie**, mimo że ten jest danym uwierzytelniającym do API Ministerstwa Finansów.

**Ryzyko:** XSS → exfiltration tokenu KSeF → atak na API skarbowe pod tożsamością firmy.

**Akcja:** P1-003.

---

### 🟡 GAP #9 — IP logging — polityka deklaruje, kod nie zbiera w app-layer

**Dokument:** `02-polityka-prywatnosci.md` § 3.1 wymienia „Adres IP, dane logowania, dane sesji".

**Kod:** brak własnego logowania IP po stronie aplikacji. IP logowane są wyłącznie przez Supabase (Auth events) i Netlify (request logs). Tabela `legal_acceptances` (mig. 031) zawiera kolumnę `ip` — sprawdzić czy populated z `event.headers['x-forwarded-for']`.

**Akcja:** P1 — udokumentować źródło IP per kategoria; rozważyć anonimizację (ostatni oktet zerowany — IAB TCF zalecenie).

---

### 🟡 GAP #10 — DPA § 2.2 wymienia tylko „typowe" dane — brak biometrii i podpisów

**Dokument:** `04-dpa-umowa-powierzenia.md` § 2.2 wymienia: imię, nazwisko, e-mail, telefon, adres, NIP, REGON, KRS, dane finansowe, treść wiadomości.

**Kod:** dodatkowo:
- **Podpisy elektroniczne** (`signature_artifacts`, `signature_pad` lib) — sygnatury graficzne mogą być traktowane jako dane biometryczne (kontrowersyjne; CJEU C-184/20 — kategoria art. 9 jeśli służą identyfikacji).
- **Nagrania głosowe** — voice notes mogą zawierać dane osób trzecich (klienci budowy, pracownicy).
- **PESEL klientów** (mig. 125) — szczególnie wrażliwy identyfikator (ustawa o ewidencji ludności).

**DPA § 2.3 zakazuje danych szczególnych kategorii art. 9 RODO** — ale zakaz adresowany jest do Administratora, więc PESEL i podpisy są dopuszczalne (PESEL nie jest art. 9). Mimo to:

**Akcja:** P1 — rozszerzyć DPA § 2.2 o explicite: PESEL, podpis odręczny graficzny, nagrania audio.

---

### 🟢 GAP #11 — CSP zawiera `'unsafe-inline'` dla script-src

**Kod:** `netlify.toml:51`: `script-src 'self' 'unsafe-inline' https://js.stripe.com`

**Dokument:** `10-zasady-bezpieczenstwa-aup.md` (do weryfikacji) deklaruje „środki techniczne odpowiednie do ryzyka" (art. 32).

**Ryzyko:** `'unsafe-inline'` osłabia ochronę XSS. Stripe wymaga `js.stripe.com`, ale `unsafe-inline` nie. Akcja P2 — wdrożyć nonce/hash-based CSP.

---

### 🟢 GAP #12 — Polityka cookies wspomina sessionStorage jako „Draft formularzy"

**Dokument:** `03-polityka-cookies.md` § 3.1 wymienia `sessionStorage` jako „Draft formularzy".

**Kod:** brak użycia `sessionStorage` (grep zwraca 0 wyników w `src/`). Polityka opisuje funkcjonalność, której nie ma.

**Akcja:** P2 — zsynchronizować z faktycznym stanem (lub wdrożyć drafty w sessionStorage zgodnie z polityką).
