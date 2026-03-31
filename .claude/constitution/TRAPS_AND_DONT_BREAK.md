# Traps and Don't Break
## LoftDesk v5.9 — lista pułapek z historii + zasady ochrony systemu

---

## Zasada naczelna

> Przed każdą zmianą: "Co może się rozpaść?"  
> Nie: "Co chcę zaimplementować?"

---

## I. Pułapki historyczne (dokumentowane regresje)

### T-01: Stare UI / stare flow — przywracanie przez przypadek
**Co się stało:** Refaktoryzacja lub przywrócenie starego kodu przywróciła przepływ, który był celowo zmieniony.  
**Symptom:** Feature działa "inaczej niż oczekiwano", UX regresja.  
**Reguła:** Zawsze sprawdź git log przed "przywróceniem" czegokolwiek. Stary kod = stale code.  
**Defence:** Code Guardian przy każdym restore z archiwum.

### T-02: Naprawianie objawu w UI gdy przyczyna jest w DB/RLS
**Co się stało:** Invoice nie wyświetlał się klientowi. Naprawiono renderowanie w komponencie. Prawdziwa przyczyna: brak wpisu w `project_client_access`.  
**Symptom:** Fix nie działa, problem wraca.  
**Reguła:** Root cause analysis PRZED kodem. Zawsze pytaj: "czy to RLS / brak dostępu / brak wiersza w tabeli?"  
**Debug checklist:** spojrzeć na RLS policies, sprawdzić `my_client_project_ids()`, zweryfikować `project_client_access`.

### T-03: Duplikowanie logiki zamiast naprawienia wspólnej utility
**Co się stało:** `autoLinkService` był powielony w trzech miejscach z małymi różnicami.  
**Symptom:** Update jednej kopii nie naprawia pozostałych.  
**Reguła:** Jeśli widzisz podobny kod w dwóch miejscach — szukaj wspólnej utility. Napraw nią.

### T-04: Przerywanie one-click flow przez rozdzielenie logiki
**Co się stało:** CTA "Utwórz umowę" z wyceny przestało przekazywać `estimateId` do formularza umowy — klient musiał wypełniać ponownie.  
**Symptom:** Użytkownik musi ręcznie uzupełniać dane które powinny być automatyczne.  
**Fix (commit 304bd080):** `initialEstimateId`, `initialProjectId`, `initialClientId` przekazywane przez konstruktory.  
**Reguła:** Każdy krok sacral flow musi znać poprzedni krok. Nie wolno "tracić kontekstu" między modułami.

### T-05: Klient widzący dane operatora
**Ryzyko:** Przypadkowe zapytanie przez `invoices.api.ts` zamiast `client-portal.api.ts` w ClientShell.  
**Symptom:** Klient widzi wszystkie faktury firmy, nie tylko swoje z projektu.  
**Reguła:** W components pod `/client/*` ZAWSZE używaj `client-portal.api.ts`. Nigdy bezpośrednio operator API.  
**Defence:** RLS chroni na poziomie DB, ale frontend nie powinien w ogóle próbować.

### T-06: Fałszywy sukces KSeF / email
**Co się stało:** Handler wysyłki pokazywał "Wysłano" mimo błędu timeout z KSeF API.  
**Symptom:** Operator myśli że faktura jest w KSeF, a nie jest. Prawne konsekwencje.  
**Reguła:** Nigdy nie wyświetlaj success toast bez potwierdzenia od backendu. KSeF errors = explicit error state.

### T-07: Reintrodukcja niespójności modali
**Co się stało:** Nowy modal z dwoma primary buttons lub CTA na całą szerokość bez hierarchii.  
**Reguła:** Każdy modal = jeden primary action. Destrukcyjna = czerwona. Secondary = ghost/outline.

### T-08: Obciążanie Free przez pomysły Pro
**Co się stało:** Free users zaczęli widzieć banery Pro i paywall buttons nagminnie, zaburzone UX.  
**Reguła:** Free musi mieć pełny sacred flow bez barier. Pro = upgrade path, nie blokada.

### T-09: Broad refactor dla wąskiego buga
**Co się stało:** Bug w `useInvoices.ts` naprawiony przez przebudowę całego modułu invoices.  
**Symptom:** 15 plików zmienionych, jeden bug naprawiony, trzy nowe regresjy.  
**Reguła:** Minimal safe change. Zawsze pytaj: "ile plików naprawdę muszę zmienić?"

### T-10: Łamanie mobile clarity
**Co się stało:** Nowe widoki z 3-kolumnowym layoutem który na telefonie jest nieczytelny.  
**Reguła:** Każda nowa strona/komponent testowana na mobile. Jeśli nieczytelna na 375px — nie ship.

---

## II. Pułapki specyficzne dla LoftDesk (nie w kanonicznym traps.md)

### T-11: Stary token portal (`/portal/$token`) vs. nowy ClientShell
**Stan faktu:** Route `/portal/$token` ISTNIEJE w routerze, ale `portal_access_tokens` tabela mogła zostać wyczyszczona przez mig 051.  
**Ryzyko:** Dodawanie kodu do `features/portal/` myśląc że to aktywny klient portal — to BŁĄD.  
**Aktywny portal klienta = `features/client-portal/` + `/client/*` routes.**  
`features/portal/` = skrzynka operatora (`PortalInboxPage`) + legacy route handler.  
**Reguła:** Nigdy nie dodawaj kodu do `src/features/portal/components/` dla client-facing UX.

### T-12: `completeness_flags` staleness
**Co się stało:** Projekt pokazywał "bez wyceny" mimo że wycena istniała — `autoLinkService` się nie wywołał lub `invalidateQueries` nie obejmowało `['projects', companyId]`.  
**Reguła:** Po każdym create/update estimate/contract/invoice — MUSI być:
1. `autoLinkService.link(...)` wywołany
2. `.then(() => qc.invalidateQueries(['projects', companyId]))` 

### T-13: Numer faktury przydzielany przy zdarzeniu innym niż "Wystaw"
**Co się stało:** Numer był przydzielany przy save draftu.  
**Fix (mig 082):** `number = NULL` dla draftu. Numer tylko przy świadomym "Wystaw fakturę".  
**Reguła:** `invoices.number` jest NULL dla draft. Nigdy nie przydzielaj numeru bez explicitnej intencji użytkownika.

### T-14: Brak RPC `my_company_id()` / `my_role()` w nowych tabelach
**Co się stało:** Nowa tabela z polityką "IS owner" zamiast `my_role() IN ('owner','admin')` — manager nie może zarządzać.  
**Reguła:** Zawsze używaj `my_company_id()`, `my_role()`, `my_client_project_ids()` w RLS policies.

### T-15: Podwójna wysyłka KSeF przy retry
**Ryzyko:** Timeout przy wysyłce → retry → dwie faktury w KSeF pod tym samym numerem.  
**Defence:** `ksef_ref` sprawdzany przed wysyłką. Idempotency key w `ksef_queue`.

### T-16: `client_accounts` vs `clients` — dwie różne tablice!
**Pułapka poznawcza:** `clients` = lista klientów operatora (dane kontaktowe). `client_accounts` = konto auth klienta.  
Klient może być w `clients` BEZ konta w `client_accounts`.  
Klient może mieć konto w `client_accounts` BEZ dostępu do projektów.  
**Reguła:** Dostęp do projektu = TYLKO `project_client_access`. Sprawdzaj obie tabele niezależnie.

### T-17: Prompt injection przez dane użytkownika
**Ryzyko:** Pole `notes` na fakturze lub nazwy projektów mogą zawierać instrukcje dla LLM (`"Ignore previous instructions..."`).  
**Reguła:** Każde user-generated field wstrzykiwane do promptu MUSI być sanitizowane lub escapowane.

### T-18: Migracje z BEGIN/COMMIT łamią Supabase Management API
**Co się stało:** Migracja z `BEGIN; ... COMMIT;` odrzucona przez Supabase.  
**Reguła:** Żadnych transakcji w plikach migracji. Każda instrukcja samodzielna.

### T-19: Usunięcie numeru migracji z sekwencji
**Ryzyko:** Luka w numeracji (np. 079 → 081 bez 080) powoduje problem z `supabase db push`.  
**Reguła:** Zawsze następny numer. Nigdy nie usuwać numeru z historii.

### T-20: Draft invoice w KSeF queue
**Ryzyko:** Faktura z `status = 'draft'` trafiona do KSeF pipeline przez błąd w `useKsefQueue`.  
**Reguła:** `useKsefQueue` i `ksef.service.ts` muszą filtrować: tylko faktury z `status != 'draft'` i `ksef_status IS NOT NULL`.

---

## III. Lista "Co sprawdzić przed merge"

Dla każdej niebanalnej zmiany:

```
□ 1. Czy zmiana łamie sacred flow (wycena→umowa→faktura)?
□ 2. Czy nowe query jest RLS-safe (company_id scope)?
□ 3. Czy klient może przez przypadek widzieć dane operatora?
□ 4. Czy autoLinkService jest wywołany po mutacji i invalidateQueries obejmuje 'projects'?
□ 5. Czy stan widoczny użytkownikowi odzwierciedla rzeczywisty stan DB (nie cached)?
□ 6. Czy nowa tabela/kolumna ma migrację z DROP POLICY IF EXISTS + RLS?
□ 7. Czy numer faktury nie jest przydzielany przy drafcie?
□ 8. Czy KSeF flow nie może się wykonać dwukrotnie na tej samej fakturze?
□ 9. Czy komponent jest używalny na 375px (mobile)?
□ 10. Czy error states są wyświetlane użytkownikowi (nie silent fail)?
□ 11. Czy demo mode guard jest w nowym AI feature?
□ 12. Czy user-generated content wstrzykiwany do LLM jest sanitizowany?
```

---

## IV. Lista "Nigdy nie rób tego"

```
✗ Nie pobieraj invoice.api.ts w ClientShell — użyj client-portal.api.ts
✗ Nie dodawaj BEGIN/COMMIT do migracji
✗ Nie przydzielaj numeru faktury przy zapisie draftu
✗ Nie wywołuj KSeF wysyłki z frontend bezpośrednio — tylko przez service z idempotency
✗ Nie ignoruj błędów autoLinkService (nawet fire-and-forget, zawsze .catch(warn))
✗ Nie modyfikuj company_id na istniejącym dokumencie
✗ Nie traktuj features/portal/ jako aktywny client portal
✗ Nie usuwaj wymagania kompletności projektu bez konsultacji
✗ Nie blokuj podstawowego flow za paywallem Free
✗ Nie dodawaj dwóch primary buttons do jednego modalu
✗ Nie fałszuj success KSeF/email bez potwierdzenia z backendu
✗ Nie commituj z błędami tsc lub build failures
```

---

## V. Sygnały alarmowe w kodzie (code smells dla LoftDesk)

| Signal | Ryzyko |
|--------|--------|
| `import ... from '@/features/invoices/api/invoices.api'` w ClientShell | Boundary leakage |
| `supabase.from('invoices').select('*')` bez `.eq('company_id', ...)` | Multi-tenant breach |
| `toast.success('Wysłano do KSeF')` bez sprawdzenia `ksef_ref` | Silent fail KSeF |
| Nowy modal z dwoma `variant="primary"` buttons | Modal law violation |
| `autoLinkService.link(...)` bez `.catch(warn)` | Unhandled rejection |
| `if (status === 'draft') return null` zamiast render obsługi draftu | Ukrywanie stanu |
| Nowa tabela bez `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | RLS gap |
| Migracja z `BEGIN;` | Supabase incompatible |
| Prompt template z `${userInput}` bez sanitizacji | Prompt injection |
