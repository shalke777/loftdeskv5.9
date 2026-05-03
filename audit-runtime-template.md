# LoftDesk — Audyt Runtime (Faza 2)
## Instrukcja + Szablon do wypełnienia

---

## KROK 1 — Uruchom w Supabase SQL Editor

### Zapytanie A — użycie funkcji RPC (posortowane malejąco)

```sql
SELECT proname, calls
FROM pg_stat_user_functions
ORDER BY calls DESC;
```

### Zapytanie B — użycie tabel (scan seq vs index)

```sql
SELECT
  relname                                          AS table_name,
  seq_scan,
  idx_scan,
  n_live_tup                                       AS live_rows
FROM pg_stat_user_tables
ORDER BY seq_scan + COALESCE(idx_scan, 0) DESC;
```

### Zapytanie C — sprawdzenie ile wierszy mają "martwe" tabele

```sql
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE n_live_tup = 0
ORDER BY relname;
```

---

## KROK 2 — Wklej wyniki tutaj

### A. Wyniki pg_stat_user_functions

```
(wklej tutaj wynik SELECT proname, calls ...)
```

### B. Wyniki pg_stat_user_tables

```
(wklej tutaj wynik SELECT relname, seq_scan, idx_scan ...)
```

---

## ZNANE MAPOWANIE — RPC z kodu (statyczna analiza)

| RPC | Wywołujący | Klasyfikacja |
|-----|-----------|-------------|
| `next_doc_number` | invoices.api, estimates.api, contracts.api | ✅ CORE |
| `next_invoice_number` | invoices.api (legacy fallback) | 🟡 LEGACY — do usunięcia gdy zero calls |
| `bootstrap_my_company` | backend.ts, dataScope.ts | ✅ CORE (nowy user onboarding) |
| `resolve_my_client_account` | auth-callback, backend.ts | ✅ CORE (client login flow) |
| `create_timeline_event` | projects/lib/timeline.ts | ✅ CORE |
| `client_send_message` | client-portal.api | ✅ CORE (portal chat) |
| `delete_portal_message` | client-portal.api, threads.api | ✅ CORE |
| `increment_bundle_counter` | bundle.service.ts, evidence-persist.ts | ✅ AI flow |
| `increment_thread_unread` | threads.api | ✅ CORE (wątki) |
| `delete_project_hard` | projects.api | ✅ CORE (admin delete) |
| `reset_doc_counter` | settings.api | ✅ SETTINGS |
| `check_rate_limit` | rate-limit.ts (Netlify shared) | ✅ KAŻDA FUNCJA |
| `portal_get_project` | (via Netlify) | ❓ sprawdzić |
| `portal_get_messages` | (via Netlify) | ❓ sprawdzić |
| `portal_get_approvals` | (via Netlify) | ❓ sprawdzić |
| `portal_get_timeline` | (via Netlify) | ❓ sprawdzić |
| `portal_send_message` | (via Netlify) | ❓ sprawdzić |
| `portal_mark_messages_read` | (via Netlify) | ❓ sprawdzić |
| `portal_respond_approval` | (via Netlify) | ❓ sprawdzić |
| `portal_get_by_token` | (via Netlify) | ❓ sprawdzić |
| `portal_decide` | (via Netlify) | ❓ sprawdzić |
| `portal_session_has_scope` | RLS trigger | 🟡 INDIRECT |
| `portal_session_project_id` | RLS trigger | 🟡 INDIRECT |
| `_portal_validate_session` | RLS trigger | 🟡 INDIRECT |
| `my_company_id` | RLS policies | 🟡 INDIRECT (każde zapytanie) |
| `my_role` | RLS policies | 🟡 INDIRECT |
| `my_app_role` | RLS policies | 🟡 INDIRECT |
| `my_client_project_ids` | RLS policies | 🟡 INDIRECT |
| `my_client_estimate_ids` | RLS policies | 🟡 INDIRECT |
| `my_client_invoice_ids` | RLS policies | 🟡 INDIRECT |
| `my_client_record_ids` | RLS policies | 🟡 INDIRECT |
| `check_client_portal_access` | RLS policies | 🟡 INDIRECT |
| `handle_new_user` | trigger on auth.users | 🟡 INDIRECT |
| `handle_updated_at` | trigger on many tables | 🟡 INDIRECT |
| `set_updated_at` | trigger | 🟡 INDIRECT |
| `accept_company_invitation` | (invitation flow) | ❓ sprawdzić czy używany |
| `cleanup_rate_limits` | (cron lub manual) | 🟡 MAINTENANCE |
| `check_missing_costs` / `check_overdue_invoices` | Netlify cron | 🟡 CRON |
| `fn_voice_note_to_memory` | trigger na voice_notes | 🟡 INDIRECT |
| `project_messages_after_insert` | trigger | 🟡 INDIRECT |
| `prevent_admin_plan_escalation` | trigger | 🟡 INDIRECT |
| `prevent_role_escalation` | trigger | 🟡 INDIRECT |
| `projects_prevent_delete` | trigger | 🟡 INDIRECT |
| `cost_approvals_after_update` | trigger | 🟡 INDIRECT |
| `trg_notify_operator_on_approval_response` | trigger | 🟡 INDIRECT |
| `trg_notify_operator_on_client_message` | trigger | 🟡 INDIRECT |
| `fn_close_sig_req_on_participant_decision` | trigger | 🟡 INDIRECT |
| `fn_propagate_sig_req_decision` | trigger | 🟡 INDIRECT |
| `fn_doc_questioned_timeline_event` | trigger | 🟡 INDIRECT |
| `trg_set_updated_at_signature` | trigger | 🟡 INDIRECT |
| `_start_company_trial` | (onboarding) | ❓ sprawdzić |
| `sync_client_auth_user` | (client account sync) | ❓ sprawdzić |
| `ai_analysis_bundles_set_updated_at` | trigger | 🟡 INDIRECT |
| `ai_analysis_runs_set_updated_at` | trigger | 🟡 INDIRECT |
| `ai_bundle_assets_set_updated_at` | trigger | 🟡 INDIRECT |
| `ai_extraction_results_set_updated_at` | trigger | 🟡 INDIRECT |

---

## ZNANE TABELE — klasyfikacja wstępna

### ✅ CORE — krytyczne, aktywne
| Tabela | Dlaczego |
|--------|---------|
| `companies` | każdy użytkownik |
| `company_members` | RLS + auth |
| `clients` | baza klientów |
| `projects` | centrum systemu |
| `invoices` + `invoice_items` | faktury, KSeF |
| `ksef_events` | KSeF send/status |
| `cost_estimates` + `cost_estimate_items` | wyceny |
| `contracts` | umowy |
| `expense_invoices` | koszty/OCR |
| `project_threads` | wątki |
| `project_messages` | wiadomości w wątkach |
| `project_portal_tokens` | tokeny portalu |
| `project_portal_sessions` | sesje portal |
| `client_portal_tokens` | logowanie klienta |
| `client_accounts` | konta klientów |
| `profiles` | profile użytkowników |
| `project_timeline_events` | oś czasu |
| `doc_counters` | numeracja dokumentów |
| `cost_approvals` | zatwierdzenia kosztów |
| `operator_notifications` | powiadomienia operatora |
| `client_notifications` | powiadomienia klienta |
| `company_invitations` | zaproszenia |

### 🟡 INDIRECT — używane przez AI / opcjonalne flow
| Tabela | Dlaczego |
|--------|---------|
| `ai_analysis_bundles` | AI extraction |
| `ai_analysis_runs` | AI runs |
| `ai_bundle_assets` | pliki AI |
| `ai_extraction_results` | wyniki AI |
| `ai_fusion_snapshots` | AI fusion |
| `ai_input_assets` | inputy AI |
| `ai_assistant_queries` | pytania do asystenta |
| `ai_questions` / `ai_risks` / `ai_scope_items` | AI review |
| `ai_review_actions` | akcje AI |
| `ai_rate_limits` | rate limit AI |
| `project_analysis_jobs` | background analysis |
| `voice_notes` | notatki głosowe |
| `project_memory_entries` | pamięć projektu |
| `company_memory_feedback` | feedback AI memory |
| `signature_requests` | podpisy |
| `signature_participants` | uczestnicy podpisów |
| `signature_artifacts` | pliki podpisów |
| `signature_events` | zdarzenia podpisów |
| `approval_events` | zdarzenia zatwierdzeń |
| `service_catalog` | cennik usług |
| `company_price_list` | ceny własne |
| `legal_acceptances` | akceptacje RODO |
| `project_documents` | dokumenty projektowe |
| `project_photo_docs` | dokumentacja zdjęciowa |
| `project_client_access` | dostęp klienta |
| `handover_protocols` | protokoły odbioru |
| `technical_standards` | standardy techniczne |
| `client_decisions` | decyzje klientów |

### ❓ UNKNOWN — sprawdzić runtime
| Tabela | Podejrzenie |
|--------|-----------|
| `conversations` + `conversation_messages` | stary chat (zastąpiony threads?) |
| `portal_messages` | stary portal messages (przed project_messages?) |
| `assignment_queue` | kolejka zadań — nigdy renderowana w UI |
| `export_jobs` | eksport jobów — background? |
| `invoice_reminders` | przypomnienia faktur |
| `invoice_counters` | stary licznik (zastąpiony doc_counters?) |
| `project_client_access` | stary model dostępu? |
| `audit_logs` | logi audytu |
| `client_tokens` | stare tokeny? |
| `company_price_list` | aktywnie używana? |

---

## NETLIFY FUNCTIONS — klasyfikacja wstępna (z audytu statycznego)

| Funkcja | Typ | Wywołujący | Status |
|---------|-----|-----------|--------|
| `voice-to-estimate` | HTTP | FloatingVoiceButton | ✅ USED |
| `voice-to-expense` | HTTP | FloatingVoiceButton, ExpensesPage | ✅ USED |
| `voice-to-note` | HTTP | FloatingVoiceButton | ✅ USED |
| `voice-extract` | HTTP | VoiceNotesList | ✅ USED |
| `parse-invoice` | HTTP | useParseInvoice | ✅ USED |
| `parse-invoice-ai` | HTTP | useParseInvoice (AI path) | ✅ USED |
| `analyze-project` | HTTP | useAnalyzeProject | ✅ USED |
| `analyze-room-photo` | HTTP | useAnalyzeRoomPhoto, AiIntakeSection | ✅ USED |
| `composite-extract-asset` | HTTP | call-extract-asset.ts (AI) | ✅ USED |
| `bundle-fusion` | HTTP | useAiBundles | ✅ USED |
| `ai-project-assistant` | HTTP | AiAssistantPanel | ✅ USED |
| `memory-context` | HTTP | AiAssistantPanel | ✅ USED |
| `memory-check` | HTTP | ProjectMemoryPanel | ✅ USED |
| `daily-report` | HTTP | ProjectWorkspace, ProjectDetail | ✅ USED |
| `send-document` | HTTP | SendToClientModal, ProjectWorkspace | ✅ USED |
| `notify-approval-response` | HTTP | ClientProjectPage | ✅ USED |
| `client-identify` | HTTP | ProjectPortalCTA | ✅ USED |
| `check-missing-costs` | CRON `0 8 * * *` | Netlify scheduler | 🟡 CRON |
| `check-overdue-invoices` | CRON `30 8 * * *` | Netlify scheduler | 🟡 CRON |
| `analyze-project-bg-background` | BG function | analyze-project (async) | 🟡 BACKGROUND |
| `stripe-checkout` | HTTP (redirect) | `/api/stripe/*` proxy | 🟡 STRIPE |
| `stripe-portal` | HTTP (redirect) | `/api/stripe/*` proxy | 🟡 STRIPE |
| `stripe-webhook` | HTTP (webhook) | Stripe events | 🟡 STRIPE |
| `ksef-send` | HTTP | KsefPage (prod) | ✅ KSeF CORE |
| `ksef-upo` | HTTP | KsefPage (status poll) | ✅ KSeF CORE |
| `ksef-auth` | HTTP | KSeF internal | 🟡 KSeF INTERNAL |
| `ksef-session` | HTTP | KSeF internal | 🟡 KSeF INTERNAL |
| `ksef-receive` | HTTP | KSeF receive | 🟡 KSeF RECEIVE |
| `ksef-http` | HTTP | KSeF proxy | 🟡 KSeF INTERNAL |
| `memory-add` | HTTP | **BRAK wywołującego w src/** | ❓ UNKNOWN |
| `ksef-debug` | HTTP | brak importu | ❓ DEV ONLY? |
| `ksef-mock` | HTTP | brak importu | ❓ DEV ONLY? |

---

## Szablon do uzupełnienia po otrzymaniu danych z Supabase

Po wklejeniu wyników pg_stat, przekształcimy je w:

```
RPC USAGE RANKING:
  HIGH  (>100 calls): ...
  MED   (10-100):     ...
  LOW   (1-9):        ...
  ZERO  (0):          ...  ← kandydaci do usunięcia
```

```
TABLE ACTIVITY:
  ACTIVE  (seq+idx > 0, live_rows > 0): ...
  EMPTY   (live_rows = 0):               ... ← kandydaci
  UNKNOWN (brak w pg_stat):              ...
```

---

*Szablon wygenerowany przez audyt statyczny. Uzupełnij sekcję "Wklej wyniki tutaj" danymi z Supabase SQL Editor.*
