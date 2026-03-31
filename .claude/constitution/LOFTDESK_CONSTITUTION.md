# LoftDesk Constitution
## wersja 3.0 — audiyt pełny, czerwiec 2025

---

## I. Tożsamość produktu (nienaruszalne twierdzenia)

LoftDesk **nie jest** aplikacją do fakturowania.  
LoftDesk **nie jest** systemem CRM.  
LoftDesk **nie jest** ciężkim ERP.

LoftDesk **jest** wspólną aplikacją procesową dla wykonawcy i klienta w Polsce —  
od pierwszego kontaktu, poprzez wycenę, dokumenty, projekt i komunikację,  
aż do rozliczenia i KSeF.

**Główna obietnica:** Jeden prosty wspólny system dla wykonawcy i klienta.

---

## II. Sacrum — Niemożliwe do zmiany bez decyzji architektonicznej

### 1. Dualny model ról
Aplikacja ma dokładnie dwie role pierwotne:

| Rola | Typ konta | Shell | Baza tożsamości |
|------|-----------|-------|-----------------|
| **Operator** (wykonawca, firm) | `auth.users` + `company_members` | AuthLayout + AppShell | `my_company_id()` z RLS |
| **Klient** (zaproszony inwestor) | `auth.users` + `client_accounts` | `ClientShell` at `/client/*` | `my_client_project_ids()` z RLS |

Te dwa role **nigdy nie mogą widzieć nawzajem swoich danych**.  
KSeF, marże, `expense_invoices`, `costs` — **zawsze tylko dla operatora**.  
Klient widzi: swoje projekty, dokumenty mu udostępnione, chat, protokoły, wyceny, faktury.

### 2. Sacred flow (kolejność procesowa — niezmiennie)
```
klient → wycena → umowa → faktura → KSeF → projekt → portal → komunikacja → dokumentacja → rozliczenie
```
Każdy krok MOŻE istnieć bez poprzedniego (system jest tolerancyjny),  
ale **powiązania muszą płynąć w tym kierunku** i być widoczne.

### 3. One-click progression (sacrum UX)
Z każdego dokumentu użytkownik musi mieć oczywistą ścieżkę do następnego.  
Wycena → "Utwórz umowę", Umowa → "Wystaw fakturę", Projekt → "Śledź status".  
Przerywanie tych ścieżek = regres produktu.

### 4. Wielodzierżawczość (multi-tenancy) — bezwzględna
Każda tabela zasobu posiada `company_id`.  
RLS jest obowiązkowe. Każdy SELECT przez API Supabase filtrowany przez RLS.  
Wyjątek: tabela `companies` (dostęp przez RPC `my_company_id()`).

### 5. Izolacja klienta w projekcie
Klient może być zaproszony tylko do konkretnych projektów (`project_client_access`).  
Dostęp nie wynika z `client_id` bezpośrednio — musi istnieć wpis w `project_client_access`.  
Zmiana projektu bez rewizji tej tabeli = potencjalny wyciek danych.

---

## III. Tiers (niezmienne zasady)

| Tier | Zasada |
|------|--------|
| **Free** | Pełny sacral flow MUSI działać. Nie może być blokowany. |
| **Pro** | Głębszy proces: szablony, wieloetapowe płatności, pełne KSeF, historia. |
| **Business** | W budowie. Nie wdrażać bez decyzji. |

**Zasada Free:** Im mniej Free, tym więcej użytkowników odchodzi do Excela.  
Nie wolno blokować podstawowego flow za paywallem.

---

## IV. Prawa architektury technicznej

### Technology stack (niezmienne)
- **Frontend:** React 18 + Vite + TanStack Router + TanStack Query
- **Auth:** Supabase GoTrue (JWT) — **jeden provider**
- **DB:** PostgreSQL + Supabase + RLS policies
- **Deploy:** Netlify (frontend) + Supabase Cloud (backend)
- **Walidacja danych:** Zod we wszystkich modelach encji
- **Styl:** Tailwind CSS + własne UI primitives

### Struktura src/ (kontrakt modułowy)
```
src/
  entities/       ← czyste modele (Zod schema + TypeScript types) — zero side-effectów
  features/       ← moduły funkcjonalne (api + hooks + components)
  services/       ← usługi przekrojowe (AI, PDF, autoLink, storage)
  workflows/      ← wielokrokowe przepływy cross-module (estimate→contract, estimate→invoice)
  shared/         ← hooks, lib, styles, types, ui primitives
  app/            ← routing, providers, inicjalizacja
```

### Kontrakt entities/
- Każda encja = jeden plik `model.ts` z Zod schema
- Zero side-effectów, zero importów z features/
- Eksportuje: Schema, Type, Input type (Create/Update)

### Kontrakt features/
- Każdy feature = `api/`, `components/`, `hooks/`, opcjonalnie `model/`, `types/`
- API layer używa **supabase client bezpośrednio lub przez RPC**
- Hooks owijają TanStack Query
- Components = React, muszą być mobile-safe

### autoLinkService — zasada ognia i zapomnienia
`autoLinkService.link(...)` jest zawsze `fire-and-forget` + `.catch(warn)`.  
Nigdy nie blokuje głównej mutacji. Niepowodzenie nie przerywa flow.  
Po każdym linkowaniu: `invalidateQueries(['projects', companyId])`.

---

## V. Prawa UX (niezmienne)

1. **Mobile clarity jest priorytetem** — każdy ekran musi być używalny na telefonie
2. **Jeden primary action per modal** — CTA hierarchy: destructive → secondary → primary
3. **Inline creation** — klient/projekt można tworzyć wewnątrz formularza (bez wychodzenia)
4. **Stany są widoczne** — draft/unpaid/paid/overdue, offer/active/done, pending/accepted/rejected
5. **Kolejny krok jest oczywisty** — każdy ważny ekran prowadzi do następnej akcji
6. **Noise reduction** — nie dodawać opcji bez przyczyny; cofać przed dodaniem

---

## VI. Prawa bezpieczeństwa (niezmienne)

1. **Nigdy nie zwracać danych operatora do klienta** — marże, koszty, expense_invoices są zawsze ukryte
2. **Nigdy nie fałszować sukcesu email/KSeF** — jeśli wysyłka się nie powiodła, użytkownik musi wiedzieć
3. **RLS nie jest opcjonalny** — każda nowa tabela MUSI mieć RLS + polityki
4. **Service role = narzędzie awaryjne** — nie używać w logice aplikacji
5. **Migracje bez transakcji** — Supabase Management API nie obsługuje BEGIN/COMMIT
6. **Kolejność migracji jest ważna** — nigdy nie usuwać numeru z listy; zawsze następny numer
7. **DROP POLICY IF EXISTS przed CREATE POLICY** — idempotentność migracji

---

## VII. Kluczowe relacje danych (rozumienie systemu)

```
companies (1) ──┬──> (N) company_members  [operatorzy]
                ├──> (N) clients           [lista klientów operatora]
                ├──> (N) client_accounts   [konta klientów do logowania]
                ├──> (N) projects          [centrum realizacji]
                ├──> (N) estimates         [wyceny]
                ├──> (N) contracts         [umowy]
                └──> (N) invoices          [faktury]

projects (1) ───┬──> (N) project_documents    [powiązane dokumenty]
                ├──> (N) project_client_access [kto może project widzieć]
                ├──> (N) project_timeline_entries [historia zdarzeń]
                ├──> (N) assignment_queue_items [oczekujące powiązania]
                ├──> (N) client_decisions   [decyzje klienta]
                ├──> (N) handover_protocols  [protokoły odbioru]
                ├──> (N) photo_documentation [zdjęcia dokumentacyjne]
                └──> (N) signature_requests  [wnioski o podpis/akceptację]

clients (1) ────> (0-1) client_accounts (auth klienta)
                         └──> (N) project_client_access
```

---

## VIII. Operacyjne prawa agentów

Przed każdym niebanalnym zadaniem:
1. Klasyfikuj (typ / ryzyko / zakres / obszar) — patrz `operational/task-classification.md`
2. Sprawdź `needs-human-decision.md`
3. Uruchom właściwych agentów domenowych
4. Uruchom Code Guardian dla HIGH/CRITICAL
5. Wdróż tylko po przejściu quality-gates (tsc + build + git clean)
6. Raportuj w formacie 10-sekcyjnym (polish)

**NIGDY** nie reportuj "done" z błędami TypeScript lub build failures.
