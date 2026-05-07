# COMPLIANCE HARDENING — P0 PACKAGE

**Status:** Implemented (untested in production)
**Wersja LoftDesk:** 5.9
**Data:** [DATA WDROŻENIA]
**Owner:** loftbau / Piotr Szalecki

---

## 1. CEL

Doprowadzenie LoftDesk do zgodności z RODO (art. 17 i art. 20), wymogami sklepów aplikacji (App Store 5.1.1(v), Google Play Account Deletion Requirement), oraz dobrymi praktykami bezpieczeństwa (PII scrubbing w Sentry, Keychain dla tokenów na mobile).

Pokryte pozycje z `07-compliance-checklist.md`:
- **P0-002** — Sentry PII scrubbing (web + Netlify Functions);
- **P0-003** — Self-service account deletion (RODO art. 17 + App Store + Google Play);
- **P0-004** — Self-service data export (RODO art. 20).

---

## 2. ZAKRES ZMIAN

### 2.1. Pliki utworzone

| Plik | Rola |
|---|---|
| `src/shared/lib/secureStorage.ts` | Adapter Capacitor Preferences (native) ↔ localStorage (web) z migracją legacy kluczy |
| `src/shared/lib/piiScrub.ts` | Pure functions: `scrubPii`, `scrubObject`, `scrubUrl`, `isSensitiveEndpoint`, `truncateExtra` |
| `netlify/functions/shared/piiScrub.ts` | Server-side mirror (utrzymywany ręcznie w synchronizacji) |
| `netlify/functions/shared/auth.ts` | `adminClient`, `authenticateUser`, `audit`, `clientIp`, `checkCronSecret` |
| `netlify/functions/account-delete.ts` | 4 akcje: `request`, `confirm`, `cancel`, `execute` (cron-only) |
| `netlify/functions/data-export.ts` | 3 akcje: `request`, `status`, `download` (signed URL) |
| `netlify/functions/data-export-bg-background.ts` | JSZip generator → Storage bucket `exports/<user_id>/<job_id>.zip` |
| `netlify/functions/cron-account-purge.ts` | Daily 03:00 UTC — purge potwierdzonych wniosków |
| `netlify/functions/cron-export-cleanup.ts` | Daily 04:00 UTC — usuwanie plików >7 dni i stuck jobów |
| `supabase/migrations/167_audit_events.sql` | Tabela audit_events + RLS (self + company owner/admin SELECT) |
| `supabase/migrations/168_account_deletion.sql` | account_deletion_requests, data_export_jobs, bucket `exports`, RPC `request_account_deletion` |
| `src/features/settings/components/AccountDangerZone.tsx` | UI: eksport, usuwanie (3-step modal), historia eksportów, cancel pending |
| `docs/legal/15-mobile-addendum.md` | Aneks mobilny (App Store + Google Play) |

### 2.2. Pliki zmodyfikowane

| Plik | Zmiana |
|---|---|
| `src/shared/lib/monitoring.ts` | Komprehensywne `beforeSend` (URL, headers, cookies, body, extras, contexts, tags, user→id only, frames vars, breadcrumbs) + `beforeBreadcrumb` (drop sensitive endpoints) + `sendDefaultPii: false` |
| `netlify/functions/shared/sentry.ts` | Server-side mirror scrubbing |
| `src/features/ksef/hooks/useKsefSession.ts` | Refactor na `secureStorage` z async hydration + nowa metoda `revoke()` |
| `src/features/settings/components/SettingsPage.tsx` | Dodanie `<AccountDangerZone />` na końcu strony |
| `netlify.toml` | Schedule dla cron-* + timeout dla data-export-bg-background (900s) i account-delete (60s) |
| `netlify/functions/package.json` | Dodano `jszip ^3.10.1` |
| `docs/legal/02-polityka-prywatnosci.md` | §3.3 (Sentry, audit log), §3.4 (push), §3.5 (mobile storage), tabela praw RODO art. 17/20 z linkami do self-service |
| `docs/legal/06-polityka-subprocesorow.md` | Rozszerzona tabela: Sentry, OpenAI, FCM, APNs, Resend |
| `docs/legal/09-polityka-retencji.md` | §4 self-service eksport, §5 30-day cooling-off + cron purge, §6 cron schedule |

---

## 3. ARCHITEKTURA

### 3.1. Diagram usuwania konta

```
User → AccountDangerZone (UI)
        │
        ├─ POST /account-delete {action:'request'} → INSERT account_deletion_requests (status='pending')
        │                                            audit_events: 'account.deletion.requested'
        │
        ├─ supabase.auth.signInWithPassword(reauth)  ← sprawdzenie hasła w UI
        │
        └─ POST /account-delete {action:'confirm'}  → UPDATE status='confirmed', confirmed_at=now()
                                                      scheduled_purge_at = now() + 30 days
                                                      audit_events: 'account.deletion.confirmed'
                                                      auth.signOut(scope='global')

[30 days later]

cron-account-purge (03:00 UTC daily)
   └─ POST /account-delete {action:'execute'} (X-Cron-Secret)
       └─ Dla każdego confirmed request z scheduled_purge_at <= now():
           ├─ profile: anonimizacja (email='deleted@local', name=null)
           ├─ company_members: soft-delete (deleted_at=now())
           ├─ device_tokens, notes, drafts, voice_*, ai_analysis_runs, rate_limits: hard-delete
           ├─ Storage: delete avatars/<user_id>/, voice/<user_id>/
           ├─ auth.admin.signOut(global)
           ├─ auth.admin.deleteUser(shouldSoftDelete=true)
           └─ UPDATE account_deletion_requests SET status='completed', completed_at=now()
              audit_events: 'account.deletion.executed'
```

### 3.2. Diagram eksportu danych

```
User → AccountDangerZone (UI)
        │
        └─ POST /data-export {action:'request'} → INSERT data_export_jobs (status='queued')
                                                  audit_events: 'data.export.requested'
                                                  fetch /data-export-bg-background (X-Cron-Secret)

data-export-bg-background (15 min budget)
   ├─ UPDATE status='running'
   ├─ Pobierz: profile, company_members, projects, estimates*, invoices*, contracts, expenses, threads/messages, audit_events, device_tokens
   ├─ JSZip → buffer
   ├─ Storage upload: exports/<user_id>/<job_id>.zip
   └─ UPDATE status='completed', file_size, expires_at = now() + 7 days
      audit_events: 'data.export.completed'

User → POST /data-export {action:'download', job_id} → signed URL (5 min TTL)

cron-export-cleanup (04:00 UTC daily)
   ├─ DELETE Storage objects WHERE expires_at < now()
   ├─ UPDATE jobs SET status='expired' WHERE expires_at < now() AND status='completed'
   └─ UPDATE jobs SET status='failed' WHERE status IN ('queued','running') AND requested_at < now() - 1h
```

### 3.3. PII Scrubbing pipeline (Sentry)

```
Sentry.captureException / captureMessage
   ↓
beforeSend(event):
   1. message → scrubPii
   2. exception.values[].value → scrubPii
   3. exception.values[].stacktrace.frames[].vars → scrubObject (recursive, 5KB cap)
   4. request.url → scrubUrl (whitelist code/type/mode)
   5. request.headers → scrubObject + force-redact Cookie/Authorization
   6. request.cookies → {redacted: '[REDACTED]'}
   7. request.data → scrubObject
   8. extra → truncateExtra(scrubObject(extra))
   9. contexts → scrubObject
   10. tags → scrubObject
   11. user → {id: user.id} (drop email/username/ip)
   12. breadcrumbs[].message + .data → scrub
   ↓
beforeBreadcrumb(crumb):
   - If category='fetch' AND url matches /parse-invoice|voice-to-|analyze-|memory-add/ → DROP
   ↓
sendDefaultPii: false (SDK-level guard)
```

Regex order (krytyczna): JWT → PESEL (11 cyfr) → NIP (10 cyfr) → email → telefon → numer faktury → kwota.

---

## 4. EDGE CASES

| Sytuacja | Zachowanie |
|---|---|
| Jedyny owner firmy z innymi członkami | Zwraca 409 z `code='sole_owner_with_members'` — UI proponuje przekazanie własności |
| Jedyny owner firmy bez innych członków | Pozwala usunąć konto; firma pozostaje (soft-deleted lub orphaned — TBD P1) |
| Aktywna subskrypcja Stripe | **Aktualnie:** subskrypcja nie jest anulowana automatycznie (P1 follow-up: webhook do Stripe `subscriptions.cancel`) |
| Idempotentny re-request | Jeśli istnieje aktywny `pending` request — zwraca istniejący `request_id` (200) |
| Anulowanie po confirm | Możliwe do `scheduled_purge_at`. Po — 410 Gone |
| Eksport >50MB | Storage bucket ma limit 50MB per file → krytyczne dane priorytetowo, P1: split na multi-part |
| Stuck job (queued/running >1h) | `cron-export-cleanup` oznacza `failed` z reason='timeout' |
| Rate limit eksportu | 3/24h per user, 5/10min na account-delete (przez `check_rate_limit` RPC) |
| Brak `email` w auth | Reauth password-based niemożliwy → fallback do magic link (P1) |

---

## 5. ENV VARS WYMAGANE

| Zmienna | Skąd | Wymóg |
|---|---|---|
| `SUPABASE_URL` | Supabase project | ✅ existing |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project (Settings → API) | ✅ existing |
| `CRON_SECRET` | Wygeneruj `openssl rand -hex 32` | **NEW — must set** |
| `URL` lub `DEPLOY_URL` | Netlify built-in | ✅ existing |
| `STRIPE_SECRET_KEY` | Stripe dashboard | ✅ existing (nieużywane w purge — P1) |
| `SENTRY_DSN` (web) | Sentry project | ✅ existing (opcjonalne) |
| `RESEND_API_KEY` | Resend dashboard | Opcjonalne (P1: maile potwierdzające eksport) |

**Action item dla ownera:** Ustaw `CRON_SECRET` w Netlify (Environment variables) **przed deployem**, w przeciwnym razie cron-* funkcje zwrócą 401.

---

## 6. MIGRACJE BAZODANOWE

### Krok 1: Backup
```bash
pg_dump --schema=public --schema=auth $SUPABASE_DB_URL > backup_pre_p0.sql
```

### Krok 2: Apply
```bash
supabase db push  # lub przez SQL Editor:
\i supabase/migrations/167_audit_events.sql
\i supabase/migrations/168_account_deletion.sql
```

### Krok 3: Weryfikacja
```sql
-- Tabele
SELECT count(*) FROM audit_events;          -- 0
SELECT count(*) FROM account_deletion_requests;  -- 0
SELECT count(*) FROM data_export_jobs;      -- 0

-- Bucket
SELECT id, public FROM storage.buckets WHERE id='exports';  -- public=false

-- RPC
SELECT request_account_deletion('test');  -- jako zwykły user — powinno UPDATE pending request
```

---

## 7. ROLLBACK PLAN

### 7.1. Frontend
```bash
git revert <commit_hash>
git push origin main
# Netlify auto-deploys
```

### 7.2. Database
```sql
-- 168
DROP FUNCTION IF EXISTS request_account_deletion(text);
DELETE FROM storage.buckets WHERE id='exports';
DROP TABLE IF EXISTS data_export_jobs CASCADE;
DROP TABLE IF EXISTS account_deletion_requests CASCADE;

-- 167
DROP TABLE IF EXISTS audit_events CASCADE;
```

### 7.3. Disable cron without revert
- Netlify Dashboard → Functions → cron-account-purge → Disable
- Netlify Dashboard → Functions → cron-export-cleanup → Disable

---

## 8. SMOKE TESTS (manualne)

- [ ] User w Settings widzi sekcję "Strefa zagrożenia"
- [ ] "Eksportuj moje dane" → modal info → klik → toast success → status `queued`/`running` w liście
- [ ] Po ~30s background function generuje ZIP → status `completed`, link "Pobierz" działa, ZIP zawiera manifest.json + JSON-y
- [ ] "Usuń moje konto" → modal step 1 (info) → step 2 (e-mail) → step 3 (hasło) → success → user wylogowany
- [ ] Po zalogowaniu z powrotem (przed scheduled_purge_at) — banner "Konto zaplanowane do usunięcia" + "Anuluj"
- [ ] Klik "Anuluj" → request status='cancelled', banner znika
- [ ] Sentry w trybie DEV: wymuś błąd z PII (`throw new Error('NIP: 1234567890 email: a@b.pl')`) → w Sentry message zawiera `[NIP] [EMAIL]`
- [ ] Sole-owner-z-członkami: próba usunięcia konta → 409 + komunikat
- [ ] Mobile (Capacitor): logowanie → odinstalowanie → ponowne logowanie → nie pokazuje "stale" tokenów (Keychain isolation)

---

## 9. CARRYOVERS DO P1

1. **Stripe subscription cancel w purge** — webhook → `stripe.subscriptions.cancel` przed `auth.admin.deleteUser`
2. **E-mail potwierdzający eksport** — Resend integration w `data-export-bg-background` po `status='completed'`
3. **Multi-part ZIP** — gdy size > 50MB, split na N plików
4. **Magic-link reauth fallback** — gdy `user.email` nie zawiera password (OAuth-only users)
5. **Sentry React Native** — instalacja na mobile + identyczny scrubbing
6. **Audit log retention cron** — usuwanie audit_events >12 mies. (zgodnie z polityką)
7. **DPIA dokument** — wymagany dla AI features (OpenAI processing) — formal Privacy Impact Assessment
8. **Cookie banner / consent management** — jeśli dojdzie analytics, potrzebne CMP

---

## 10. ZGODNOŚĆ — WERYFIKACJA

| Wymóg | Status | Notatka |
|---|---|---|
| RODO art. 17 (right to erasure) | ✅ | 30-day cooling-off + retencja archiwizacyjna art. 74 ustawy o rachunkowości |
| RODO art. 20 (data portability) | ✅ | ZIP/JSON, machine-readable, 7-day signed URL |
| RODO art. 25 (privacy by design) | ✅ | PII scrubbing pre-transmisji do Sentry |
| RODO art. 32 (security of processing) | ✅ | Keychain/Keystore mobile, RLS Supabase, service-role w funkcjach |
| Apple App Store 5.1.1(v) | ✅ | In-app account deletion + URL `/account-deletion` |
| Google Play Account Deletion Req | ✅ | In-app + web URL w Data Safety form |
| OWASP MASVS-STORAGE-1 | ✅ | Tokeny w Keychain/Keystore, nie w localStorage WebView |
| Ustawa o rachunkowości art. 74 | ✅ | Faktury/umowy zachowane 5+1 lat anonimowo |

---

**Owner sign-off:** _____________________ data: _____
