# Active System Map
## LoftDesk v5.9 — stan na czerwiec 2025

---

## I. Routing — wszystkie 36 tras

### Trasy publiczne (bez auth)
| Path | Komponent | Status |
|------|-----------|--------|
| `/` | LandingPage | AKTYWNA — strona marketingowa |
| `/login` | LoginPage | AKTYWNA |
| `/portal/$token` | PortalTokenRoutePage | **LEGACY** — stary portal tokenowy. Route istnieje ale `portal_access_tokens` tabela może być pusta. Klienci powinni używać `/join/$token` i logować się do `/client/*` |
| `/join/$token` | InvitationPage | AKTYWNA — wejście zaproszonego klienta |
| `/auth/callback` | AuthCallback | AKTYWNA — callback OAuth / magic link |
| `/legal` | LegalIndexPage | AKTYWNA |
| `/legal/$doc` | LegalDocPage | AKTYWNA |
| `/color-demo` | ColorDemoPage | DEV ONLY |

### Trasy operatora (auth required, AppShell)
| Path | Moduł | Status |
|------|-------|--------|
| `/dashboard` | features/dashboard | AKTYWNA — centrum operatora |
| `/clients` | features/clients | AKTYWNA |
| `/estimates` | features/estimates | AKTYWNA |
| `/invoices` | features/invoices | AKTYWNA — draft mode od mig 082 |
| `/contracts` | features/contracts | AKTYWNA |
| `/projects` | features/projects | AKTYWNA — centrum realizacji |
| `/reports` | features/reports | AKTYWNA |
| `/ksef` | features/ksef | AKTYWNA — business-critical |
| `/settings` | features/settings | AKTYWNA |
| `/expenses` | features/expenses | AKTYWNA — koszty / OCR |
| `/billing` | features/billing | AKTYWNA |
| `/team` | features/team | AKTYWNA |
| `/onboarding` | features/onboarding | AKTYWNA |
| `/documentation` | features/documentation | AKTYWNA — dokumentacja projektowa |
| `/portal-inbox` | features/portal/components/PortalInboxPage | AKTYWNA — skrzynka wiadomości operatora |
| `/chat` | features/chat | AKTYWNA — czat operator-klient (conversations) |
| `/room-analysis` | app/routes/room-analysis | AKTYWNA — AI analiza zdjęć pomieszczeń |
| `/project-analysis` | app/routes/project-analysis | AKTYWNA — AI analiza dokumentów projektowych |
| `/ai` | app/routes/ai | AKTYWNA — hub AI |

### Trasy klienta (auth required, ClientShell)
| Path | Komponent | Status |
|------|-----------|--------|
| `/client/dashboard` | ClientDashboardPage | AKTYWNA — lista projektów klienta |
| `/client/project/$id` | ClientProjectPage | AKTYWNA — szczegół projektu dla klienta |
| `/client/profile` | ClientProfilePage | AKTYWNA |

---

## II. Feature modules — 23 modułów

### AKTYWNE — rdzeń produktu
| Moduł | Ścieżka | Kluczowe pliki | Rola |
|-------|---------|----------------|------|
| **auth** | features/auth | hooks/useAuth.ts | Supabase GoTrue, detects role (operator vs client) |
| **clients** | features/clients | api/clients.api.ts | CRUD klientów firmy |
| **estimates** | features/estimates | api/estimates.api.ts | Wyceny (draft→sent→accepted→rejected) |
| **contracts** | features/contracts | api/contracts.api.ts | Umowy z transzami (unsigned→signed) |
| **invoices** | features/invoices | api/invoices.api.ts | Faktury (draft→unpaid→paid→overdue) + KSeF status |
| **projects** | features/projects | api/projects.api.ts | Centrum realizacji, project_documents |
| **ksef** | features/ksef | ksef.service.ts | KSeF pipeline (ksef_pending→ksef_sent/ksef_error) |
| **client-portal** | features/client-portal | api/client-portal.api.ts, ClientShell.tsx | Cały shell klienta — **AKTYWNY** portal |
| **documentation** | features/documentation | api/ | Protokoły odbioru, decyzje klienta, zdjęcia, standardy |
| **signatures** | features/signatures | api/signature-requests.api.ts | Podpisy elektroniczne, akceptacje (approval_only + QTSP) |
| **chat** | features/chat | api/conversations.api.ts | Czat operator-klient, wątki rozmów |
| **notifications** | features/notifications | api/operator-notifications.api.ts | Powiadomienia dla operatora (trigger-generowane) |
| **expenses** | features/expenses | (OCR/koszty) | Koszty projektu, import faktur OCR |

### AKTYWNE — infrastruktura
| Moduł | Ścieżka | Rola |
|-------|---------|------|
| **onboarding** | features/onboarding | Przeprowadzenie nowych użytkowników |
| **settings** | features/settings | Ustawienia firmy, numeracja dokumentów |
| **billing** | features/billing | Stripe / plany subskrypcji |
| **team** | features/team | Zaproszenia pracowników, role |
| **reports** | features/reports | Raporty finansowe |
| **dashboard** | features/dashboard | Dashboard operatora |
| **legal** | features/legal | Regulaminy, polityki prywatności |
| **marketing** | features/marketing | Landing page |

### LEGACY / KOMPATYBILNOŚĆ
| Moduł | Status | Uwagi |
|-------|--------|-------|
| **portal** | CZĘŚCIOWO LEGACY | `features/portal/components/PortalInboxPage.tsx` = skrzynka OPERATORA (aktywna). `/portal/$token` route = stary token portal (może być martwy). |
| **admin** | BRAK DANYCH | Moduł `features/admin/` — prawdopodobnie wewnętrzne narzędzia |

---

## III. Services layer — src/services/

| Serwis | Ścieżka | Status | Opis |
|--------|---------|--------|------|
| **autoLinkService** | services/project/autoLinkService | AKTYWNY | Automatyczne powiązywanie dokumentów z projektami po create/update |
| **AI service** | services/ai/ai.service.ts | AKTYWNY (rozbudowany) | Multi-modal pipeline: document engine, room engine, project engine |
| **PDF service** | services/pdf/ | AKTYWNY | Generowanie PDF dla faktur, umów, wycen |
| **Storage service** | services/storage/ | AKTYWNY | Upload/download plików (zdjęcia, załączniki) |

---

## IV. Workflows — src/workflows/

| Workflow | Pliki | Status | Opis |
|----------|-------|--------|------|
| **estimate-to-contract** | EstimateToContractFlow.tsx, useEstimateToContract.ts | AKTYWNY | Tworzy umowę z danych wyceny. Uruchamia autoLink. |
| **estimate-to-invoice** | EstimateToInvoiceFlow.tsx, useEstimateToInvoice.ts | AKTYWNY | Tworzy fakturę z danych wyceny. Uruchamia autoLink. |

---

## V. Entities layer — src/entities/ (Zod schemas)

| Encja | Kluczowe pola | Status |
|-------|---------------|--------|
| **Company** | id, name, nip, plan (free/pro/business/admin) | AKTYWNA |
| **Client** | id, company_id, name, email, phone, nip | AKTYWNA |
| **Project** | id, company_id, client_id, number, status (offer/active/done/cancelled), completeness_flags | AKTYWNA |
| **Estimate** | id, company_id, client_id, project_id, number, status (draft/sent/accepted/rejected), items[] | AKTYWNA |
| **Contract** | id, company_id, client_id, project_id, estimate_id, number, status (unsigned/signed), tranches[], custom_paragraphs[] | AKTYWNA |
| **Invoice** | id, company_id, client_id, project_id, contract_id, number (null=draft), status (draft/unpaid/paid/overdue), ksef_status, items[] | AKTYWNA |
| **Documentation** | ClientDecision, HandoverProtocol, PhotoDocumentation, TechnicalStandard | AKTYWNA |
| **User (AppUser)** | id, email, companyId, role (owner/admin/manager/worker/accountant) | AKTYWNA |
| **Invitation** | id, company_id, email, role, token, status (pending/accepted/expired/revoked) | AKTYWNA |

---

## VI. Database — aktywne tabele i migracje

### Główne tabele zasobów (mig 000-025)
- `companies`, `company_members`, `clients`, `projects`
- `estimates`, `estimate_items`
- `contracts`, `contract_tranches`, `custom_paragraphs`
- `invoices`, `invoice_items`
- `project_documents`, `project_timeline_entries`, `assignment_queue_items`

### KSeF (mig 030-033)
- `ksef_queue` — kolejka wysyłki do KSeF
- `ksef_batches` — partie wysyłki

### Portal klienta (mig 040-055)
- `client_accounts` (mig 040) — konta klientów w Supabase Auth
- `project_client_access` (mig 040) — tabela dostępu klienta do projektów
- `portal_messages` / `client_messages` (mig 048-055) — wiadomości klient↔operator
- `portal_access_tokens` — prawdopodobnie wyczyszczone (mig 051 drop)

### Dokumentacja projektowa (mig 060-078)
- `client_decisions` — decyzje klienta
- `handover_protocols`, `handover_checklist_items`
- `photo_documentation`
- `technical_standards`
- `doc_approval_requests`, `doc_approval_events` (mig 077-078)

### Podpisy elektroniczne (mig 072-076)
- `signature_requests` — wniosek (approval_only / qualified_signature_required)
- `signature_participants`, `signature_events`, `signature_artifacts`, `approval_events`

### Numeracja i drafts (mig 079-082)
- `document_numbering_config` (mig 081) — konfigurowalna numeracja dokumentów
- `invoices.status` rozszerzony o `'draft'` (mig 082)
- `invoices.number` nullable dla draftów (mig 082)

### Notifikacje (mig 070)
- `operator_notifications` — generowane przez Postgres triggery

### Konwersacje (nowe)
- `conversations`, `conversation_messages` — czat operator-klient

---

## VII. AI pipeline — src/services/ai/

```
Input (zdjęcie / PDF / tekst)
  ↓
input-classifier.ts → InputType + suggestedEngine
  ↓
  ├── 'document' → engines/document.types.ts  (faktury, rachunki, umowy)
  ├── 'room'     → engines/room.types.ts       (zdjęcia pomieszczeń, postęp prac)
  └── 'project'  → engines/project.types.ts    (projekty architektoniczne, PDF)
  ↓
analysis.types.ts → AnalysisResult (unified output)
  ↓
UI mapping → auto-fill formularzy
```

**Typy InputType (aktywne):**
- document: `invoice`, `receipt`, `formal_document`, `cost_note`
- room: `room_photo`, `work_progress_photo`
- project: `project_pdf`, `technical_drawing`, `design_visualization`
- legacy: `plan_visualization` → mapuje do `project`

---

## VIII. Podwójny portal — kluczowe rozróżnienie

```
/portal/$token   →  features/portal  →  PortalTokenRoutePage
                    (STARY token portal — prawdopodobnie martwy od mig 051)
                    
/client/*        →  features/client-portal  →  ClientShell
                    (NOWY portal klienta — auth-based — AKTYWNY)
                    
/portal-inbox    →  features/portal/components/PortalInboxPage
                    (SKRZYNKA OPERATORA — widok wiadomości od klientów — AKTYWNA)
```

**UWAGA:** `src/features/portal/` ≠ portal klienta.  
Aktywny ClientShell jest w `src/features/client-portal/`.
