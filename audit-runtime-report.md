# LoftDesk — Runtime usage audit snapshot

Status: **collect + classify only**. No deletion decisions from this snapshot.

## Important correction

The RPC query failed because `pg_stat_user_functions` uses `funcname`, not `proname`.

Run this instead:

```sql
select schemaname, funcname as proname, calls
from pg_stat_user_functions
order by calls desc;
```

If it still returns no meaningful data, check whether function tracking is enabled:

```sql
show track_functions;
```

It should be `pl` or `all`; if it is `none`, RPC call stats are not being collected.

## Table usage map from supplied pg_stat_user_tables snapshot

### HIGH / system activity

| Table | seq_scan | idx_scan | live_rows | Classification |
|---|---:|---:|---:|---|
| `subscription` | 0 | 1087 | 0 | SYSTEM / Supabase internal-like |
| `schema_migrations` | 70 | 0 | 0 | SYSTEM / migration tracking |
| `users` | 38 | 0 | 0 | SYSTEM / auth |
| `buckets` | 3 | 33 | 0 | SYSTEM / storage |

### LOW / app activity observed

| Table | seq_scan | idx_scan | live_rows | Classification |
|---|---:|---:|---:|---|
| `invoices` | 4 | 0 | 0 | USED — KSeF/invoice flow touched table |
| `ksef_events` | 3 | 0 | 0 | USED — KSeF status/event path touched table |

### LOW / system activity observed

| Table | seq_scan | idx_scan | live_rows | Classification |
|---|---:|---:|---:|---|
| `migrations` | 1 | 1 | 2 | SYSTEM |
| `secrets` | 1 | 0 | 0 | SYSTEM |

### ZERO observed activity but app-critical by design

These had `seq_scan = 0`, `idx_scan = 0`, `live_rows = 0` in the supplied snapshot, but must **not** be deleted because they are core LoftDesk flows or RLS dependencies:

| Table | Static role |
|---|---|
| `companies` | company scope / tenant root |
| `company_members` | auth + RLS tenant membership |
| `clients` | client records |
| `client_accounts` | invited client login |
| `projects` | project center |
| `project_threads` | project/client threads |
| `project_messages` | thread messages |
| `project_timeline_events` | workspace timeline |
| `project_documents` | project docs |
| `project_client_access` | client project access |
| `client_notifications` | client notifications |
| `operator_notifications` | contractor notifications |
| `cost_estimates` | estimates |
| `cost_estimate_items` | estimate items |
| `contracts` | contracts |
| `invoice_items` | invoice lines |
| `expense_invoices` | costs/OCR |
| `cost_approvals` | document/cost approvals |
| `company_invitations` | invitations |
| `profiles` | user profiles |
| `legal_acceptances` | legal acceptance records |

### ZERO observed activity and candidate UNKNOWN

These are candidates for later investigation only. They need row counts, code references, triggers/RLS checks, and runtime logs before any deletion:

| Table | Suspicion |
|---|---|
| `conversations` | old chat model, possibly replaced by `project_threads` |
| `conversation_messages` | old chat messages, possibly replaced by `project_messages` |
| `messages` | old/generic messages table |
| `portal_messages` | not present in supplied snapshot, but exists in migrations; possible old portal path |
| `assignment_queue` | queue feature not currently visible in primary UI |
| `export_jobs` | background export jobs |
| `invoice_counters` | old counter model, likely replaced by `doc_counters` |
| `project_activity_log` | old activity model |
| `project_milestones` | old project planning model |
| `project_tasks` | old project planning model |
| `project_members` | old project membership model |
| `flow_state` | old workflow state |
| `costing_lines` | old costing model |
| `price_list` | old price list model |
| `contractors` | old contractor table |
| `user_backups` / `backups` | backup subsystem |
| `audit_logs` / `audit_log_entries` | audit subsystem |

## RPC usage map

### Current status

RPC runtime stats were **not collected** because the query used the wrong column name (`proname`).

### Correct query to run

```sql
select schemaname, funcname as proname, calls
from pg_stat_user_functions
order by calls desc;
```

### Static RPC map to reconcile against runtime results

| RPC | Static classification |
|---|---|
| `next_doc_number` | CORE — estimates/contracts/invoices/corrections numbering |
| `next_invoice_number` | LEGACY fallback — can be retired only if runtime confirms zero |
| `bootstrap_my_company` | CORE — onboarding/company bootstrap |
| `resolve_my_client_account` | CORE — invited client auth callback |
| `create_timeline_event` | CORE — project timeline |
| `client_send_message` | CORE — portal/client message flow |
| `delete_portal_message` | CORE — message deletion |
| `increment_thread_unread` | CORE — thread unread counts |
| `delete_project_hard` | ADMIN/MAINTENANCE |
| `reset_doc_counter` | SETTINGS |
| `check_rate_limit` | NETLIFY shared guard |
| `increment_bundle_counter` | AI extraction |
| `my_company_id`, `my_role`, `my_app_role` | RLS indirect |
| `my_client_project_ids`, `my_client_estimate_ids`, `my_client_invoice_ids`, `my_client_record_ids` | RLS indirect |
| `portal_session_project_id`, `portal_session_has_scope`, `_portal_validate_session` | portal RLS indirect |
| `handle_new_user`, `handle_updated_at`, `set_updated_at`, `touch_updated_at` | triggers |
| `project_messages_after_insert`, `trg_notify_operator_on_client_message` | thread/message triggers |
| `cost_approvals_after_update`, `trg_notify_operator_on_approval_response` | approval triggers |
| `projects_prevent_delete`, `prevent_role_escalation`, `prevent_admin_plan_escalation` | safety triggers |

## Netlify function usage map

No Netlify log export was supplied in this snapshot, so this map remains static classification until log evidence is added.

### Static USED from frontend references

| Function | Static caller |
|---|---|
| `voice-to-estimate` | `FloatingVoiceButton` |
| `voice-to-expense` | `FloatingVoiceButton`, `ExpensesPage` |
| `voice-to-note` | `FloatingVoiceButton` |
| `voice-extract` | `VoiceNotesList` |
| `parse-invoice` | `useParseInvoice` |
| `parse-invoice-ai` | `useParseInvoice` AI path |
| `analyze-project` | `useAnalyzeProject` |
| `analyze-room-photo` | `useAnalyzeRoomPhoto`, `AiIntakeSection` |
| `composite-extract-asset` | AI composite extraction |
| `bundle-fusion` | `useAiBundles` |
| `ai-project-assistant` | `AiAssistantPanel` |
| `memory-context` | `AiAssistantPanel` |
| `memory-check` | `ProjectMemoryPanel` |
| `daily-report` | `ProjectWorkspace` |
| `send-document` | `SendToClientModal`, `ProjectWorkspace` |
| `notify-approval-response` | `ClientProjectPage` |
| `client-identify` | `ProjectPortalCTA` |
| `ksef-send` | KSeF invoice flow |
| `ksef-upo` | KSeF status/UPO polling |

### Static INDIRECT

| Function | Reason |
|---|---|
| `check-missing-costs` | Netlify scheduled function |
| `check-overdue-invoices` | Netlify scheduled function |
| `analyze-project-bg-background` | Netlify background function |
| `stripe-checkout` | Stripe route/proxy |
| `stripe-portal` | Stripe route/proxy |
| `stripe-webhook` | external Stripe webhook |
| `ksef-auth`, `ksef-session`, `ksef-receive`, `ksef-http` | KSeF internal/support functions |

### Static UNKNOWN / needs logs

| Function | Reason |
|---|---|
| `memory-add` | configured but no frontend caller found |
| `ksef-debug` | likely diagnostic/dev-only |
| `ksef-mock` | likely diagnostic/dev-only |

## Phase 3 — Legacy Portal RPC Cleanup (2026-05-03)

### Executed SQL

```sql
DROP FUNCTION IF EXISTS public.portal_get_by_token(text) CASCADE;
DROP FUNCTION IF EXISTS public.portal_send_message(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.portal_decide(text, text) CASCADE;
DROP TABLE IF EXISTS public.portal_messages CASCADE;
```

Result: `Success. No rows returned` — all 4 were no-ops (none existed in production).

### Classification

| Element | Production status | Action |
|---|---|---|
| `portal_get_by_token(text)` | Never deployed | ✅ `DROP IF EXISTS` (no-op) |
| `portal_send_message(text,text,text)` | Never deployed | ✅ `DROP IF EXISTS` (no-op) |
| `portal_decide(text,text)` | Never deployed | ✅ `DROP IF EXISTS` (no-op) |
| `portal_messages` table | Never deployed | ✅ `DROP IF EXISTS` (no-op) |
| `delete_portal_message(uuid)` | **LIVE** (2 callers) | 🔒 KEPT — soft-deletes `project_messages` |
| `client_send_message(uuid,uuid,text,text)` | **LIVE** | 🔒 KEPT — portal chat backbone |

### Scope correction noted

`delete_portal_message` has a misleading name — it operates on `project_messages` (soft delete), NOT `portal_messages`. Callers: `client-portal.api.ts` + `threads.api.ts`. Must never be dropped.

### Migration applied

- File: `supabase/migrations/139_phase3_drop_legacy_portal_rpcs.sql`
- Commit: `3a52c728`

### Remaining for Phase 4

| Table | Blocker |
|---|---|
| `client_decisions` | Trigger `trg_client_decision_to_memory` (migration 114). Drop trigger + function first, then table. |

---

## Phase 2 — DB Ghost Table Cleanup Results (2026-05-03)

### Classification summary

| Table | Production status | Action taken |
|---|---|---|
| `handover_protocols` | EXISTS, 0 rows, no RPC, no triggers | ✅ **DROPPED** |
| `technical_standards` | EXISTS, 0 rows, no RPC, no triggers | ✅ **DROPPED** |
| `company_memory_feedback` | MISSING (migration 088 never applied) | ✅ **DROP IF EXISTS** (no-op) |
| `portal_messages` | EXISTS — live RPCs 026/062/063 reference it | 🔒 KEPT — annotated DEPRECATED |
| `client_decisions` | EXISTS — trigger `trg_client_decision_to_memory` (migration 114) | 🔒 KEPT — annotated DEPRECATED |
| `project_portal_sessions` | EXISTS — `delete_project_hard()` RPC uses it | 🔒 KEPT (user constraint) |
| `conversations` | EXISTS — user constraint + RPC reference | 🔒 KEPT (user constraint) |
| `invoice_counters` | EXISTS — user constraint | 🔒 KEPT (user constraint) |
| `assignment_queue` | EXISTS — user constraint | 🔒 KEPT (user constraint) |
| `export_jobs` | EXISTS — user constraint | 🔒 KEPT (user constraint) |

### Migration applied

- File: `supabase/migrations/138_phase2_ghost_table_cleanup.sql`
- Commit: `b05ffda3`
- SQL executed in production Supabase: `DROP TABLE IF EXISTS` for all 3 tables
- Result: `Success. No rows returned` — clean execution, no errors

### Remaining INVESTIGATE candidates (Phase 3 scope)

| Table | Blocker | Next step |
|---|---|---|
| `portal_messages` | Legacy RPCs `portal_send_message`, `delete_portal_message`, `portal_get_conversation` | Drop RPCs first (migration 139), then table |
| `client_decisions` | Trigger `fn_client_decision_to_memory` wired to `project_memory_entries` | Drop trigger + function first, then table |

---

## Interpretation

This snapshot proves only a small amount of app runtime activity:

- `invoices` and `ksef_events` were touched, matching the recent production KSeF test.
- Most app tables show zero scans and zero estimated rows, which likely means the sample did not cover full app usage, stats are stale, or the queried database is not the active data store expected by the app.
- `n_live_tup = 0` is an estimate, not deletion proof. Before deleting tables, confirm with exact `count(*)`, RLS/trigger dependencies, and production logs.

## Next SQL for exact row counts of app tables

Run exact counts only for public app tables:

```sql
select 'companies' as table_name, count(*) from public.companies
union all select 'company_members', count(*) from public.company_members
union all select 'clients', count(*) from public.clients
union all select 'projects', count(*) from public.projects
union all select 'project_threads', count(*) from public.project_threads
union all select 'project_messages', count(*) from public.project_messages
union all select 'invoices', count(*) from public.invoices
union all select 'invoice_items', count(*) from public.invoice_items
union all select 'ksef_events', count(*) from public.ksef_events
union all select 'cost_estimates', count(*) from public.cost_estimates
union all select 'contracts', count(*) from public.contracts
union all select 'expense_invoices', count(*) from public.expense_invoices;
```

