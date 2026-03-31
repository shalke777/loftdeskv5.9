# Source of Truth Map
## LoftDesk v5.9 — po każdej domenie: gdzie dane żyją i skąd je czytać

---

## Zasada ogólna

> Każda dziedzina ma **jedno** miejsce źródłowej prawdy.  
> Duplikowanie logiki = trap #3.  
> Zawsze pytaj: "czy to już gdzieś istnieje?"

---

## 1. Firma (Company)

| Pytanie | Źródło prawdy |
|---------|--------------|
| Dane firmy (nazwa, NIP, plan) | `companies` tabela |
| Plan subskrypcji | `companies.plan` (free/pro/business/admin) |
| Rola bieżącego użytkownika | `company_members.role` → `my_role()` RPC |
| ID firmy bieżącego użytkownika | `company_members` → `my_company_id()` RPC |
| Konfiguracja numeracji dokumentów | `document_numbering_config` tabela (mig 081) |
| Dane firmy w frontend | `useCompanyId()` hook → `useAuth()` |

---

## 2. Klient (Client)

| Pytanie | Źródło prawdy |
|---------|--------------|
| Dane kontaktowe klienta | `clients` tabela (company_id scoped) |
| Konto do logowania klienta | `client_accounts` tabela (auth_user_id → Supabase auth) |
| Do jakich projektów klient ma dostęp | `project_client_access` tabela — **NIE clients.id bezpośrednio** |
| Bieżący zalogowany klient (frontend) | `useAuth()` → `user.role === 'client'` → `ClientShell` |
| Lista projektów klienta | `my_client_project_ids()` RPC → zwraca tablicę project_id |

**PUŁAPKA:** klient może istnieć w `clients` bez konta (`client_accounts`) i bez dostępu (`project_client_access`). Zaproszenie tworzy `client_accounts` + `project_client_access`.

---

## 3. Projekt (Project)

| Pytanie | Źródło prawdy |
|---------|--------------|
| Metadane projektu | `projects` tabela |
| Status projektu | `projects.status` (offer/active/done/cancelled) |
| Kompletność projektu | `projects.completeness_flags` + `projects.completeness_score` — aktualizowane przez autoLinkService |
| Powiązane dokumenty | `project_documents` tabela (doc_type + doc_id) |
| Historia zdarzeń projektu | `project_timeline_entries` |
| Kolejka auto-powiązania | `assignment_queue_items` |
| Zalogowani klienci projektu | `project_client_access` |
| Protokoły odbioru | `handover_protocols` |
| Decyzje klienta | `client_decisions` |
| Zdjęcia dokumentacyjne | `photo_documentation` |
| Standardy techniczne | `technical_standards` |

---

## 4. Wycena (Estimate)

| Pytanie | Źródło prawdy |
|---------|--------------|
| Dane wyceny | `estimates` + `estimate_items` tabele |
| Status wyceny | `estimates.status` (draft/sent/accepted/rejected) |
| Pozycje wyceny | `estimate_items` (z `sort_order`) |
| Numer wyceny | `estimates.number` — generowany przez numerację (document_numbering_config) |
| Frontend state | `useEstimates()` hook → TanStack Query `['estimates', 'list', companyId]` |
| Połączenie z projektem | `estimates.project_id` + `project_documents` |

---

## 5. Umowa (Contract)

| Pytanie | Źródło prawdy |
|---------|--------------|
| Dane umowy | `contracts` + `contract_tranches` + `custom_paragraphs` tabele |
| Status umowy | `contracts.status` (unsigned/signed) |
| Transze płatności | `contract_tranches` |JSON w row— `contracts.tranches` JSONB |
| Własne paragrafy | `custom_paragraphs` lub `contracts.custom_paragraphs` JSONB |
| Numer umowy | `contracts.number` — numeracja konfigurowana |
| Skąd pochodzi umowa | `contracts.estimate_id` → z wyceny (nullable) |
| Frontend state | `useContracts()` hook → `['contracts', companyId]` |

---

## 6. Faktura (Invoice)

| Pytanie | Źródło prawdy |
|---------|--------------|
| Dane faktury | `invoices` + `invoice_items` tabele |
| Status faktury | `invoices.status` (draft/unpaid/paid/overdue) |
| Faktura draft | `invoices.number IS NULL` AND `invoices.status = 'draft'` |
| Status KSeF | `invoices.ksef_status` (ksef_sent/ksef_pending/ksef_error/null) |
| Numer KSeF | `invoices.ksef_ref` |
| Numer faktury | `invoices.number` — NULL dla draftu, przypisywany przy wystawieniu |
| Rodzaj faktury | `invoices.invoice_type` (standard/advance/final/partial) |
| Transa umowy | `invoices.tranche_id` → `contract_tranches.id` |
| Frontend state | `useInvoices()` hook → `['invoices', 'list', companyId]` |

---

## 7. KSeF

| Pytanie | Źródło prawdy |
|---------|--------------|
| Czy faktura wysłana do KSeF | `invoices.ksef_status = 'ksef_sent'` + `invoices.ksef_ref` |
| Kolejka KSeF | `ksef_queue` tabela |
| Partie wysyłki | `ksef_batches` tabela |
| Stan kolejki frontend | `useKsefQueue()` hook |
| Logika wysyłki | `services/ksef/ksef.service.ts` |

**UWAGA:** KSeF jest business-critical. `ksef_status` na fakturze = truth. `ksef_queue` = przejściowy.

---

## 8. Portal klienta / Komunikacja

| Pytanie | Źródło prawdy |
|---------|--------------|
| Wiadomości klient↔operator | `client_messages` (lub `portal_messages`) tabela — mig 048-055 |
| Odczyt przez klienta | `client_messages.read_by_client` |
| Konwersacje (operator view) | `conversations` + `conversation_messages` tabele |
| Aktywny portal klienta (shell) | `features/client-portal/ClientShell.tsx` + `/client/*` routes |
| Co klient widzi w projekcie | `client-portal.api.ts` — tylko odczyt, bez marż/kosztów |
| Dostęp do projektu | `project_client_access` — MUSI istnieć, RLS egzekwuje |

---

## 9. Dokumentacja projektowa

| Pytanie | Źródło prawdy |
|---------|--------------|
| Protokoły odbioru | `handover_protocols` + `handover_checklist_items` |
| Akceptacja klienta protokołu | `handover_protocols.status` (draft/sent/accepted/rejected) |
| Decyzje klienta o zmianach | `client_decisions` |
| Decyzja klienta: status | `client_decisions.status` (pending_client/accepted/rejected/revision_requested) |
| Zdjęcia dokumentacyjne | `photo_documentation` (kategorie: before/progress/after/issue/handover) |
| Standardy techniczne | `technical_standards` |
| Wnioski o podpis | `signature_requests` + `signature_participants` + `signature_events` |
| Akceptacja bez QTSP | `approval_events` tabela |
| Aprobata żądania doc | `doc_approval_requests` + `doc_approval_events` (mig 077-078) |

---

## 10. Podpisy elektroniczne (Signatures)

| Pytanie | Źródło prawdy |
|---------|--------------|
| Wniosek o podpis | `signature_requests` (company_id + document_type + document_id) |
| Tryb podpisu | `signature_requests.mode` (approval_only / qualified_signature_required) |
| Status wniosku | `signature_requests.status` (pending/in_progress/completed/rejected/cancelled/expired) |
| Uczestnicy | `signature_participants` (signer/approver/observer) |
| Historia zdarzeń (immutable) | `signature_events` |
| Plik podpisany | `signature_artifacts` |
| Hash dokumentu | `signature_requests.document_hash` (SHA-256 zamrożonego PDF) |
| Zewnętrzny provider | `signature_requests.provider_name` (autenti/mszafir/certum) |
| API frontend | `features/signatures/api/signature-requests.api.ts` |

---

## 11. Powiadomienia

| Pytanie | Źródło prawdy |
|---------|--------------|
| Powiadomienia operatora | `operator_notifications` tabela — generowane przez Postgres triggery |
| Typy powiadomień | `client_message`, `client_approval_response` |
| Odczytane | `operator_notifications.read_at` |
| API frontend | `features/notifications/api/operator-notifications.api.ts` |

---

## 12. Numeracja dokumentów

| Pytanie | Źródło prawdy |
|---------|--------------|
| Konfiguracja wzorców | `document_numbering_config` tabela (mig 081) |
| Bieżący numer | `document_numbering_config.current_number` per doc_type per company |
| Format numeru | `document_numbering_config.pattern` (np. `{PREFIX}/{YEAR}/{NUM}`) |
| Logika przydzielania | DB-side (RPC lub trigger) — **nie frontend** |
| Draft = brak numeru | `invoices.number IS NULL` |

---

## 13. Role i uprawnienia

| Pytanie | Źródło prawdy |
|---------|--------------|
| Role operatorów | `company_members.role`: owner/admin/manager/worker/accountant |
| Role klientów | Brak sub-ról — jeden typ: klient zaproszony do projektu |
| Sprawdzenie roli w SQL | `my_role()` RPC |
| Sprawdzenie roli w frontend | `useAuth().user.role` |
| Polityki dostępu | RLS policies na każdej tabeli (mig 002 + uzupełnienia) |
| Zaproszenia pracowników | `invitations` tabela — token + email + role |
| Zaproszenia klientów | osobny flow — tworzy `client_accounts` + `project_client_access` |

---

## 14. Completeness / AutoLink

| Pytanie | Źródło prawdy |
|---------|--------------|
| Czy projekt ma dokumenty | `projects.completeness_flags` JSONB (has_client, has_estimate, ...) |
| Wynik kompletności | `projects.completeness_score` (0-100) |
| Kto aktualizuje flagi | `autoLinkService` → `services/project/autoLinkService` |
| Kolejność wywołania | po każdym create/update estimate/contract/invoice → `autoLinkService.link()` |
| Kiedy invalidować query | po `autoLinkService.link()` → `invalidateQueries(['projects', companyId])` |
| Oczekujące powiązania | `assignment_queue_items` tabela |

---

## 15. Plany subskrypcji (Billing)

| Pytanie | Źródło prawdy |
|---------|--------------|
| Plan firmy | `companies.plan` (free/pro/business/admin) |
| Zarządzanie subskrypcją | `features/billing` → Stripe (external) |
| Gating funkcji | `companies.plan` sprawdzany w frontend/backend |

---

## Szybka ściągawka: "gdzie szukać X"

| X | Szukaj w |
|---|---------|
| Kto może widzieć projekt | `project_client_access` |
| Czy faktura jest draftem | `invoices.status = 'draft'` AND `invoices.number IS NULL` |
| Czy umowa pochodzi z wyceny | `contracts.estimate_id` |
| Historia projektu | `project_timeline_entries` |
| Bieżąca numeracja | `document_numbering_config` |
| Status wysyłki KSeF | `invoices.ksef_status` |
| Kto podpisał dokument | `signature_participants` + `signature_events` |
| Wiadomość od klienta | `client_messages` lub `conversation_messages` |
| Powiadomienie dla operatora | `operator_notifications` |
