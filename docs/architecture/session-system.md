# LoftDesk Session System — Architecture Contract v1.0

**Status:** `PRODUCTION` · **Effective:** 2026-05-06 · **Author:** Engineering  
**Supersedes:** Sprint A multi-query resolution, Sprint B.1 fallback layer  
**Implementation:** migrations 153–155, Sprint B/C refactors (commits 831d0696–c868a1a0)

---

## 1. CORE PRINCIPLE

> **`get_session_context()` is the single, exclusive source of truth for tenant identity, company membership, role, and plan.**

- One RPC call resolves everything.
- No fallback resolvers exist or are permitted.
- No client-side duplication of resolution logic.
- RLS enforces isolation only — no business logic in policies.

Violation of this principle is a critical architecture defect.

---

## 2. SYSTEM FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│  UI LAYER                                                               │
│  Component consumes: { data, isLoading, error }                        │
│  Stateless with respect to session resolution                           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ data | null | loading
┌──────────────────────────────▼──────────────────────────────────────────┐
│  HOOK LAYER  (policy interpreter)                                       │
│  useQuery  → SESSION_CONTEXT_MISSING → returns null (no error state)   │
│  useMutation → SESSION_CONTEXT_MISSING → re-throws → onError toast     │
│  Onboarding → SESSION_CONTEXT_MISSING → empty state                    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ SessionResult<T>
┌──────────────────────────────▼──────────────────────────────────────────┐
│  API LAYER                                                              │
│  Returns SessionResult<T> — never throws for session errors             │
│  billing.api.ts · settings.api.ts · dataScope.ts                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ supabase.rpc('get_session_context')
┌──────────────────────────────▼──────────────────────────────────────────┐
│  DB FUNCTION                                                            │
│  public.get_session_context()                                           │
│  SECURITY DEFINER · STABLE · RETURNS jsonb                             │
│  Migration 155                                                          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ auth.uid() anchored
┌──────────────────────────────▼──────────────────────────────────────────┐
│  RLS                                                                    │
│  Isolation only: company_id = active_company_id()                      │
│  No role evaluation · No business logic                                 │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│  DATABASE                                                               │
│  company_members · companies · client_accounts                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. LAYER DEFINITIONS

### A — DB LAYER

**Function:** `public.get_session_context()`  
**Migration:** 155  
**Qualifier:** `SECURITY DEFINER`, `STABLE`, `RETURNS jsonb`  
**Access anchor:** `auth.uid()` — a user reads only their own context

**Resolution paths (in order):**

| Priority | Condition | Returns |
|----------|-----------|---------|
| 1 | `company_members` row exists for `auth.uid()` | operator context + full `companies` row |
| 2 | `client_accounts` row exists for `auth.uid()` | client context, `company` null |
| 3 | neither exists | `null` company_id (→ onboarding) |

**Return shape (jsonb):**
```jsonc
{
  "company_id":        uuid | null,
  "company_name":      text | null,
  "company":           { /* full companies row */ } | null,
  "membership_role":   "owner"|"admin"|"manager"|"worker"|"accountant"|"client"|null,
  "membership_since":  timestamptz | null,
  "is_client":         boolean,
  "client_company_id": uuid | null
}
```

**RLS contract:**
- Policies use `company_id = active_company_id()` for isolation.
- `active_company_id()` is a lightweight helper — no membership joins.
- No policy evaluates role, plan, or subscription state.
- `my_role()` is deprecated (removal in migration 156).

**Bootstrap:**
- `bootstrap_my_company()` is a one-time side-effect RPC.
- It is called from `backend.ts` only when `company_id` is null post-auth.
- It is **never** called from `get_session_context()`.
- After bootstrap, context is re-resolved via a second `get_session_context()` call.

---

### B — API LAYER

**Contract:** Every API function that requires session context returns `SessionResult<T>`.

```ts
// src/shared/lib/sessionResult.ts
type SessionError = 'SESSION_CONTEXT_MISSING' | 'UNKNOWN_ERROR'

type SessionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: SessionError }
```

**Rules:**
- API functions MUST NOT `throw` for session context errors.
- API functions MUST return `sessionMissing()` when `company` is null in multi-tenant mode.
- DB/network errors (non-session) MAY be thrown normally.
- `get_session_context()` is the only permitted source of company/role/plan data.

**Affected files:**
- `src/features/billing/api/billing.api.ts` — `summary()`
- `src/features/settings/api/settings.api.ts` — `profile()`, `inviteMember()`
- `src/shared/lib/dataScope.ts` — adapter only, no resolution logic
- `src/shared/lib/backend.ts` — `resolveSupabaseSession()`, bootstrap trigger

---

### C — HOOK LAYER

The hook layer is the **single place** where `SessionResult` semantics are interpreted.

| Context | `SESSION_CONTEXT_MISSING` behaviour |
|---------|-------------------------------------|
| `useQuery` | return `null` — no TanStack error state, no UI crash |
| `useMutation` | re-throw → `onError` → toast — user-visible, non-fatal |
| Onboarding progress | treat as empty state (no steps completed) |

**Rules:**
- Hooks MUST unwrap `SessionResult<T>` — components must never receive `SessionResult` directly.
- `data: null` is a valid, safe state for all query consumers.
- No hook may implement fallback resolution.

---

### D — UI LAYER

**Rules:**
- Components are stateless with respect to session resolution.
- Components consume: `data`, `isLoading`, `error` from hooks.
- Components handle `data === null` as an empty/loading/unavailable state.
- No component queries Supabase directly for company, membership, or plan.
- No component reads `localStorage` for session data.

---

## 4. ERROR MODEL

### Single error type

```
SESSION_CONTEXT_MISSING
```

Triggered when: authenticated user, `get_session_context()` returned non-null result, but `company` object is null in multi-tenant mode.

### Observability

Captured in `monitoring.ts:captureSessionContextNull()`:
- Sentry event: `SESSION_CONTEXT_MISSING`
- Payload: `{ user_id, timestamp, environment }`
- Always logged to console regardless of Sentry DSN.

### Degradation model

| Degradation path | Allowed | Method |
|-----------------|---------|--------|
| `data: null` in UI | ✅ | SessionResult → hook unwrap |
| Sentry error logged | ✅ | `captureSessionContextNull()` |
| Toast in mutation | ✅ | hook `onError` handler |
| Silent fallback to free plan | ❌ | **forbidden** |
| Wrong company resolution | ❌ | **forbidden** |
| Plan downgrade without DB change | ❌ | **forbidden** |
| Alternative resolver activation | ❌ | **forbidden** |

---

## 5. FORBIDDEN PATTERNS

The following patterns are permanently prohibited. Any PR introducing these is a critical defect:

```
❌ supabase.from('companies').select(...)        outside get_session_context()
❌ supabase.from('company_members').select(...)  in runtime API paths
❌ supabase.rpc('get_my_company_billing')        deprecated, removed
❌ my_role() IN (...)                            in RLS policies
❌ PGRST202 / 42883 catch blocks                fallback trigger, forbidden
❌ isFunctionNotFound()                          removed, must not be recreated
❌ legacyResolveContext()                        removed, must not be recreated
❌ useLocalStorage('loftdesk-*-session')         session duplication
❌ plan: 'free' as default when context missing  silent downgrade
❌ company_id from URL/params for data queries   param-driven resolution
❌ multiple .rpc('get_session_context') calls    in single request path (except bootstrap re-resolve)
```

---

## 6. STABILITY CONTRACT

### System invariants

1. `get_session_context()` is the only function that resolves company/role/plan.
2. Every API call that needs company context calls `getDataScope()` which wraps the RPC.
3. `getDataScope()` contains no resolution logic beyond delegating to the RPC.
4. `SessionResult` is always unwrapped at the hook layer, never passed to components.
5. Degradation is always observable (Sentry + console) and always UI-safe (null state).

### Bootstrap invariant

```
resolveSupabaseSession()
  ├─ get_session_context() → company_id present → return user ✅
  ├─ get_session_context() → company_id null
  │     └─ bootstrap_my_company() → get_session_context() → return user ✅
  └─ get_session_context() → company_id null after bootstrap
        └─ captureSessionContextNull() → return { user: null } (→ logout/onboarding) ✅
```

### Multi-tenant isolation invariant

```
Every DB query in multi-tenant mode MUST be scoped to scope.companyId.
scope.companyId comes exclusively from get_session_context().company_id.
No companyId from URL params, component state, or localStorage is used for data queries.
```

---

## 7. DO / DO NOT

### DO

- Call `supabase.rpc('get_session_context')` once per request lifecycle via `getDataScope()`.
- Return `SessionResult<T>` from any API function that requires company context.
- Use `sessionOk(data)` and `sessionMissing()` helpers from `sessionResult.ts`.
- Unwrap `SessionResult` in hooks, not in components.
- Call `captureSessionContextNull()` when an authenticated user has no context after bootstrap.
- Use `checkSessionContext()` (from `sessionHealthCheck.ts`) for dev/CI/staging verification only.

### DO NOT

- Query `companies`, `company_members`, or `client_accounts` directly in API layer runtime paths.
- Add any fallback resolution when `get_session_context()` fails.
- Interpret `company_id` from URL or React state for data filtering.
- Add role-based conditions to RLS policies.
- Cache session context in `localStorage` or React state.
- Call `get_session_context()` multiple times in a single request (exception: bootstrap re-resolve).
- Add new DB functions that duplicate `get_session_context()` logic.

---

## 8. HEALTH CHECK

**For dev / staging / CI only.** Not for runtime.

**TypeScript:**
```ts
import { checkSessionContext } from '@/shared/lib/sessionHealthCheck'
const result = await checkSessionContext()
// { ok, company_id, membership_role, is_client, raw, error, checked_at }
```

**SQL (Supabase SQL Editor / psql, as authenticated user):**
```sql
SELECT public.get_session_context();
```

---

## 9. DEFINITION OF DONE (for future changes)

Any change that touches session context, billing, or RLS is complete when:

- [ ] `tsc --noEmit` passes with zero errors
- [ ] No new calls to `supabase.from('companies')` or `supabase.from('company_members')` in API runtime paths
- [ ] No new fallback blocks for PGRST202/42883
- [ ] `SessionResult<T>` used for any new API function requiring company context
- [ ] `SessionResult` unwrapped in hook layer, not in components
- [ ] `captureSessionContextNull()` called if a new authenticated-but-no-context path is added
- [ ] `checkSessionContext()` verified manually in staging before deploy
- [ ] This document updated if the contract changes

---

## 10. FILE MAP

| File | Role |
|------|------|
| `supabase/migrations/155_get_session_context.sql` | DB function definition |
| `src/shared/lib/backend.ts` | Session bootstrap + `captureSessionContextNull` |
| `src/shared/lib/dataScope.ts` | Adapter — wraps RPC, no resolution logic |
| `src/shared/lib/sessionResult.ts` | `SessionResult<T>` type + helpers |
| `src/shared/lib/sessionHealthCheck.ts` | Dev/CI health check utility |
| `src/shared/lib/monitoring.ts` | `captureSessionContextNull()` |
| `src/features/billing/api/billing.api.ts` | `summary()` → `SessionResult<BillingSummary>` |
| `src/features/settings/api/settings.api.ts` | `profile()`, `inviteMember()` → `SessionResult` |
| `src/features/billing/hooks/useBilling.ts` | Unwraps `SessionResult`, soft failure |
| `src/features/settings/hooks/useSettings.ts` | Unwraps `SessionResult`, soft/toast failure |

---

*This document is the authoritative engineering contract for the LoftDesk session system.*  
*Changes to any file in §10 that violate §5 (Forbidden Patterns) or §6 (Stability Contract) require this document to be updated before merging.*
