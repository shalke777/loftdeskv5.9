# LoftDesk v5.9 — Deploy & Release Checklist (Etap 10)

> Wersja: v5.9  
> Data: 2026-03-12  
> Branch deploy: `main`  
> Build: `npm install && cd netlify/functions && npm install && cd ../.. && npx vite build`  
> Publish dir: `dist`  
> Functions dir: `netlify/functions`

---

## STATUS PRZED DEPLOYEM

| Co | Stan |
|----|------|
| `tsc --noEmit` (src/) | ✅ PASS |
| `tsc --noEmit` (netlify/functions/) | ✅ PASS |
| `npm run build` | ✅ PASS |
| Uncommitted changes | ✅ czyściwe (webhook fix scommitowany) |
| Branch main | ✅ 14 commitów przed origin |
| SPA fallback `/*` → `index.html` | ✅ w netlify.toml |
| Stripe webhook pola (SDK v20) | ✅ naprawione |

---

## 1. LISTA BLOCKERÓW / PRIORYTETÓW

### 🔴 BLOCKER — blokuje produkcję i sprzedaż

| # | Problem | Gdzie | Jak naprawić |
|---|---------|-------|-------------|
| B1 | `STRIPE_WEBHOOK_SECRET` nie ustawiony | Netlify env vars | Skopiować z Stripe Dashboard → Webhooks → Signing secret. Bez tego webhook zwraca 500, stan subskrypcji nigdy nie trafia do DB |
| B2 | Webhook endpoint nie zarejestrowany w Stripe | Stripe Dashboard → Webhooks | Dodać URL: `https://TWOJA-DOMENA/api/stripe/webhook`, listenować 6 eventów |
| B3 | `STRIPE_SECRET_KEY` nie ustawiony na Netlify | Netlify env vars | Skopiować z Stripe Dashboard. Bez tego `/api/stripe/checkout` i `/api/stripe/portal` zwracają 500 |
| B4 | `SUPABASE_SERVICE_ROLE_KEY` nie ustawiony na Netlify | Netlify env vars | Skopiować z Supabase Dashboard → Settings → API. Bez tego portal-token-create i stripe-checkout nie działają |
| B5 | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` nie ustawione | Netlify env vars (build-time) | Bez tych dwóch app działa w trybie demo — nie można się zalogować do realnych danych |
| B6 | `VITE_STRIPE_BUSINESS_PRICE_ID` nie ustawiony | Netlify env vars (build-time) | Bez tego przycisk „Kup plan" rzuca błąd przed wywołaniem API |
| B7 | Push gałęzi main na GitHub/GitLab nie wykonany | git | `git push origin main` — Netlify nie wdroży bez pusha |

### 🟠 HIGH — poważnie ogranicza działanie

| # | Problem | Gdzie | Jak naprawić |
|---|---------|-------|-------------|
| H1 | `SUPABASE_ANON_KEY` nie ustawiony jako backend var | Netlify env vars | portal-token-create używa tego do weryfikacji JWT operatora (fallback do `VITE_SUPABASE_ANON_KEY` działa, ale lepiej ustawić dedykowany) |
| H2 | `VITE_STRIPE_PUBLISHABLE_KEY` nie ustawiony | Netlify env vars (build-time) | `@stripe/stripe-js` nie zainicjalizuje się jeśli potrzebny. Checkout działa przez server-redirect więc nie blokuje, ale może powodować JS warning |
| H3 | Stripe Billing Portal nie skonfigurowany | Stripe Dashboard → Customer Portal | Bez konfiguracji Portalu Klienta Stripe, `openCustomerPortal` zwróci błąd 400 |
| H4 | Produkty/ceny nie stworzony w Stripe | Stripe Dashboard → Products | Price ID z env musi istnieć w Stripe. Inaczej checkout session nie zostanie stworzona |

### 🟡 MEDIUM — ogranicza funkcje, nie blokuje

| # | Problem | Uwagi |
|---|---------|-------|
| M1 | `OPENAI_API_KEY` nie ustawiony | parse-invoice fallbackuje do regex — działa, ale AI parsing wyłączony |
| M2 | `SITE_URL` nie ustawiony | portal_url w odpowiedzi funkcji użyje `process.env.URL` które Netlify ustawia automatycznie. OK dla preview deploys. Dla custom domeny — ustaw ręcznie |
| M3 | `VITE_DATA_MODE` nie ustawiony | Jeśli SUPABASE vars są ustawione, app automatycznie wejdzie w tryb supabase. Ale lepiej jawnie ustawić `VITE_DATA_MODE=live` |
| M4 | Chunk size warning w buildzie | index.js: 560 kB. Nie blokuje, ale warto code-split w przyszłości |

### 🟢 LOW — kosmetyka/nice-to-have

| # | Notatka |
|---|---------|
| L1 | Redirect rule `/api/portal/*` w netlify.toml jest nieużywany (portal funkcje wywoływane przez `/.netlify/functions/` bezpośrednio) — nieszkodliwe |
| L2 | `VITE_PUBLIC_BASE_URL` nie ustawiony — pojawia się w settings info, nie blokuje |
| L3 | `VITE_STRIPE_PRO_PRICE_ID` / `STRIPE_PRICE_PRO` nie ustawiony — plan Pro nie istnieje jako SKU, checkout i tak dostanie cenę z `VITE_STRIPE_BUSINESS_PRICE_ID` |

---

## 2. CHECKLISTA DEPLOYU — KROK PO KROKU

### 2A. Przed pushem — lokalnie

- [ ] `git status` → powinien być czysty (0 modified files)
- [ ] `npm run build` → powinno przejść bez błędów (chunk warnings = OK)
- [ ] `cd netlify/functions && npx tsc --noEmit` → 0 błędów
- [ ] `git log --oneline -5` → skonfirmuj że stripe-webhook fix jest scommitowany
- [ ] `git push origin main`

### 2B. Netlify — konfiguracja przed deployem

W Netlify Dashboard → **Site settings → Build & Deploy**:
- [ ] **Build command**: `npm install && cd netlify/functions && npm install && cd ../.. && npx vite build`
- [ ] **Publish directory**: `dist`
- [ ] **Functions directory**: `netlify/functions`
- [ ] **Node version**: `20` (już w `netlify.toml` via `NODE_VERSION = "20"`)

### 2C. Netlify — Environment Variables

Idź do: **Netlify Dashboard → Site settings → Environment variables**

**Obowiązkowe (BLOCKER jeśli brak):**

| Zmienna | Zakres | Skąd skopiować |
|---------|--------|----------------|
| `VITE_SUPABASE_URL` | All (build-time) | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | All (build-time) | Supabase → Settings → API → anon/public key |
| `VITE_DATA_MODE` | All (build-time) | Wpisz: `live` |
| `VITE_STRIPE_BUSINESS_PRICE_ID` | All (build-time) | Stripe → Products → wybrany plan → price ID (`price_...`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | All (build-time) | Stripe → Developers → API keys → Publishable key (`pk_live_...`) |
| `SUPABASE_URL` | Functions | Jak VITE_SUPABASE_URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions | Supabase → Settings → API → service_role key (**NIGDY nie dawać do frontendu!**) |
| `SUPABASE_ANON_KEY` | Functions | Jak VITE_SUPABASE_ANON_KEY |
| `STRIPE_SECRET_KEY` | Functions | Stripe → Developers → API keys → Secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Functions | Stripe → Webhooks → Twój endpoint → Signing secret (`whsec_...`) — **skopiuj PO stworzeniu endpointu** |
| `STRIPE_PRICE_BUSINESS` | Functions | Jak VITE_STRIPE_BUSINESS_PRICE_ID |

**Opcjonalne:**

| Zmienna | Zakres | Uwagi |
|---------|--------|-------|
| `OPENAI_API_KEY` | Functions | Włącza AI parsing faktur. Bez tego — regex fallback |
| `SITE_URL` | Functions | Custom domena np. `https://app.loftdesk.pl`. Netlify auto-ustawia `URL` jako fallback |
| `VITE_PUBLIC_BASE_URL` | All (build-time) | Wyświetlana w ustawieniach. Niewymagana do działania |

### 2D. Stripe Dashboard — konfiguracja

#### Products & Prices
- [ ] Stworzony produkt **LoftDesk Business** (lub nazwa własna)
- [ ] Stworzony plan cenowy (recurring monthly/annual)
- [ ] Skopiowany `price_...` ID do `VITE_STRIPE_BUSINESS_PRICE_ID` i `STRIPE_PRICE_BUSINESS`

#### Customer Portal
- [ ] **Stripe Dashboard → Billing → Customer portal → Activate test link** lub **Live**
- [ ] Włączone: zarządzanie subskrypcją (cancel, update payment method)
- [ ] Ustawiony **Return URL**: `https://TWOJA-DOMENA/billing`
- [ ] Business information uzupełnione (nazwa firmy, email wsparcia)

#### Webhook Endpoint
- [ ] Dodany endpoint: `https://TWOJA-DOMENA/api/stripe/webhook`
  - (*Na Netlify: `https://[site-name].netlify.app/api/stripe/webhook`*)
- [ ] Zaznaczone eventy (wszystkie 6):
  - [x] `checkout.session.completed`
  - [x] `customer.subscription.created`
  - [x] `customer.subscription.updated`
  - [x] `customer.subscription.deleted`
  - [x] `invoice.paid`
  - [x] `invoice.payment_failed`
- [ ] Skopiowany **Signing secret** (`whsec_...`) do `STRIPE_WEBHOOK_SECRET` w Netlify

#### API Keys — Live vs Test
- [ ] Zdecydować: używamy kluczy **test** (`sk_test_`, `pk_test_`) czy **live** (`sk_live_`, `pk_live_`)
- [ ] Spójność: Stripe Dashboard i env vars muszą być z tego samego trybu
- [ ] Konta testowe: użyć karty `4242 4242 4242 4242` do smoke testów

### 2E. Supabase — konfiguracja produkcyjna

- [ ] Migracje uruchomione: sprawdź że *wszystkie* pliki z `supabase/migrations/` są aktywne
  - Minimum: `001_` przez `036_billing_subscription.sql`
- [ ] **Row Level Security (RLS)** włączony na tabelach produkcyjnych
- [ ] **Auth → URL Configuration**:
  - Site URL: `https://TWOJA-DOMENA`
  - Redirect URLs: dodaj `https://TWOJA-DOMENA/auth/callback`
- [ ] **Auth → Email templates**: skonfiguruj jeśli używane
- [ ] Sprawdź czy `companies` tabela ma kolumny: `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_current_period_end`, `trial_ends_at`, `plan_source`

---

## 3. SMOKE TEST — KRYTYCZNE FLOW

Po deployu wykonaj ręcznie:

### A. Logowanie i onboarding
- [ ] Wejdź na `https://TWOJA-DOMENA/`
- [ ] Kliknij „Zaloguj się" → formularz się pojawia
- [ ] Zaloguj się na konto testowe
- [ ] Dashboard się ładuje — brak pustych errorów w konsoli
- [ ] Jeśli nowe konto: onboarding flow się pojawia
- [ ] Empty states renderują się (nie crash)

### B. Projekty
- [ ] Wejdź na `/projects` → lista się ładuje
- [ ] Wejdź w projekt → ProjectDetail się ładuje
- [ ] Odśwież stronę na `/projects` → SPA fallback działa, nie ma 404

### C. Portal klienta
- [ ] Wejdź w projekt → zakładka Portal → kliknij „Generuj link"
- [ ] Funkcja `portal-token-create` zwraca URL (sprawdź network tab)
- [ ] Skopiuj URL portalu → otwórz w anonimowym oknie
- [ ] `/portal/:token` ładuje się bez logowania
- [ ] Odśwież na `/portal/:token` → nie ma 404 (SPA fallback)
- [ ] Sprawdź expired token → pojawia się ekran błędu zamiast crash

### D. Koszty i parse-invoice
- [ ] Wejdź w projekt → zakładka Koszty
- [ ] Dodaj koszt ręcznie → zapisuje się
- [ ] Dodaj koszt przez upload pliku (JPG) → parse-invoice odpowiada
  - Jeśli bez OPENAI_API_KEY: pojawia się warning, dane z regex
  - Koszt zapisuje się do projektu

### E. Akceptacje
- [ ] Wyślij koszt do akceptacji (przycisk „Do akceptacji")
- [ ] W portalu klienta: koszt pojawia się w sekcji akceptacji
- [ ] Klient akceptuje → status zmienia się na „zaakceptowany"

### F. Timeline
- [ ] Wejdź w projekt → zakładka Oś czasu
- [ ] Eventy renderują się (bez crash)
- [ ] Portal updates widoczne w portalu klienta

### G. Billing i Stripe
- [ ] Wejdź na `/billing`
- [ ] Strona ładuje się z poprawnym planem/statusem
- [ ] Kliknij „Kup plan Business":
  - Pojawia się formularz zgód
  - Po zaznaczeniu: przycisk aktywny
  - Po kliknięciu → redirect do Stripe Checkout
  - (Testowo: karta `4242 4242 4242 4242`, dowolny termin/CVC)
  - Po powrocie: `?checkout=success` — toast sukcesu
  - Plan w Supabase zaktualizowany (sprawdź `companies` table)
- [ ] Kliknij „Zarządzaj subskrypcją" → redirect do Stripe Customer Portal
- [ ] Po powrocie: redirect na `/billing`

### H. Reszta tras — SPA test (sprawdź 404)
- [ ] Bezpośrednie wejście URL (F5) na każdą trasę nie daje 404:
  - `/dashboard`
  - `/projects`
  - `/billing`
  - `/clients`
  - `/chat`
  - `/expenses`
  - `/portal-inbox`
  - `/portal/:token`
  - `/join/:token`

---

## 4. RZECZY DO KLIKNIĘCIA RĘCZNIE — NETLIFY / STRIPE / SUPABASE

### Netlify (konieczne przed/po deployu)
1. **Netlify UI → Site settings → Environment variables** — dodaj wszystkie obowiązkowe zmienne z sekcji 2C
2. Po dodaniu env vars: **Trigger deploy** (lub push na main)
3. **Netlify UI → Deploys** → potwierdź że build przeszedł (zielona lampka)
4. **Netlify UI → Functions** → sprawdź czy pojawia się 7 funkcji:
   - `parse-invoice`, `portal-revoke`, `portal-token-create`, `portal-validate`, `stripe-checkout`, `stripe-portal`, `stripe-webhook`

### Stripe (konieczne)
1. **Stripe Dashboard → Products** → stwórz produkt i cenę, skopiuj price ID
2. **Stripe Dashboard → Developers → Webhooks** → dodaj endpoint z 6 eventami (patrz sekcja 2D)
3. **Stripe Dashboard → Billing → Customer portal** → aktywuj, ustaw return URL
4. Skopiuj `whsec_...` do Netlify env vars

### Supabase (konieczne)
1. **Supabase Dashboard → SQL Editor** → sprawdź czy migration 036 jest aktywna (tabela `companies` ma kolumny billing)
2. **Supabase Dashboard → Auth → URL Configuration** → dodaj custom domain do Site URL i redirects
3. Opcjonalnie: **Supabase Dashboard → Table Editor → companies** → sprawdź dane testowe

---

## 5. RELEASE NOTES — CO WIDOCZNE PO WDROŻENIU v5.9

Funkcjonalności dostępne dla użytkowników po tym deployu:

**Billing & Stripe**
- Plan Business z przyciskiem „Kup plan" → Stripe Checkout
- Zarządzanie subskrypcją → Stripe Customer Portal
- Widok statusu planu: trial / aktywny / past_due / anulowany
- Baner „Upgrade" dla kont trial i free

**Portal klienta**
- Generowanie bezpiecznych tokenów dostępu (SHA-256, auto-revoke)
- Portal klienta z aktualizacjami, wiadomościami, dokumentami, akceptacjami
- Wygaśnięcie, unieważnienie, statusy dostępu

**Koszty projektów**
- Ręczne dodawanie kosztów
- Upload zdjęcia/PDF → parse-invoice (regex + opcjonalnie OpenAI Vision)
- Flow akceptacji kosztów przez klienta

**Oś czasu projektu**
- Eventy wewnętrzne i widoczne przez portal
- Automatyczne eventy (portal_activated, cost_submitted, itp.)

**Onboarding**
- First-run onboarding dla nowych firm
- Empty states we wszystkich modułach
- Limity planów (read-only UI, plany free vs business)

**Architektura**
- Multi-tenant (RLS per company)
- PWA (Service Worker, manifest, offline fallback)
- CSP security headers
- JWT-authenticated Netlify Functions

---

## 6. KOMENDY POMOCNICZE

```bash
# Push na produkcję
git push origin main

# Sprawdzenie lokalnego buildu
npm run build

# Typecheck: src/
npx tsc --noEmit

# Typecheck: Netlify functions
cd netlify/functions && npx tsc --noEmit

# Sprawdzenie brakujących env vars (lokalnie)
npm run env:check

# Deploy readiness report (lokalnie)
npm run deploy:ready
```

---

*Checklist wygenerowany dla LoftDesk v5.9, commit `271f6508`, branch `main`.*
