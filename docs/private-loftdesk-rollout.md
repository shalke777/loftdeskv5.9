# Private LoftDesk: implementation and activation

This branch is a staged implementation, not a completed or deployed replacement for production. Do not merge/deploy it as a finished private product before the outstanding items below are resolved against the actual database and connected accounts.

## Implemented and locally tested

- Explicit private-mode flags; owner gate at the Netlify API edge and in shared authentication; owner-only restrictive RLS alongside existing tenant policies; signup rejection when private mode is enabled.
- Existing multi-company reminder/purge/export-cleanup schedules are disabled in private mode; replacement owner rules still require completion.
- Private UI hides registration, client-portal entry, billing promotion, limits and team controls. The existing data is not deleted.
- KSeF acknowledged submissions persist original-session metadata, remain pending until verified and retain their identity on rejection. Closing the invoice session no longer revokes authentication needed for verification.
- Separate scheduled KSeF verification reads one document per minute in the configured environment. It refreshes the MF access token and stores official UPO XML in a private bucket, with a SHA-256 digest. It never submits invoices. A returned XML is stored as received; this code does not implement XAdES signature validation.
- Gmail OAuth binds a single configured account, checks one-use expiring state, encrypts refresh credentials with AES-256-GCM and imports plain-text messages/attachment metadata with a durable pagination window. Favore/Oferteo sender messages are excluded. Attachment bytes are not downloaded.
- A durable automation queue supports transactional estimate drafts/notes, Gmail reads and Gmail drafts. Stable keys prevent duplicate database documents; expired ambiguous external-write leases become `unknown`, not automatic retries.
- MCP JSON-RPC endpoint supports initialize, tool listing/calls, scoped record reads, estimate drafts, notes, Gmail sync and email drafts. It uses a server-side bearer token. No OAuth authorization-server integration or live ChatGPT connector onboarding has been implemented/tested.
- In-app notifications report ready offer/mail drafts and terminal task problems, not routine mail arrival. No emails have been sent by this implementation work.

## Required configuration (do not put secret values in Git or chats)

Server/Edge Functions scope on Netlify:

| Variable | Meaning |
| --- | --- |
| `SUPABASE_URL` | Existing project URL |
| `SUPABASE_ANON_KEY` | Public API key used by the Edge owner check |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database credential |
| `LOFTDESK_PRIVATE_MODE=true` | Enable server owner gate |
| `LOFTDESK_OWNER_USER_ID` | Verified existing Supabase auth UUID |
| `LOFTDESK_COMPANY_ID` | Verified existing LOFTBAU company UUID |
| `LOFTDESK_ENCRYPTION_KEY` | 32 random bytes encoded as base64; preserve it for credential decryption |
| `LOFTDESK_ASSISTANT_TOKEN` | Separate random integration token; never expose it in the frontend |
| `LOFTDESK_AUTOMATION_ENABLED=true` | Enable scheduled workers after staging checks |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Dedicated Google OAuth web application |
| `GOOGLE_REDIRECT_URI` | Exact registered URL `https://loftdesk.pl/.netlify/functions/gmail-oauth-callback` |
| `GMAIL_ACCOUNT_EMAIL` | Explicit account to connect |
| `GMAIL_SYNC_ENABLED=true` | Enable periodic mailbox import after consent |
| `KSEF_SYNC_ENABLED=true` | Save MF refresh credentials on login and enable background verification |
| `KSEF_ENV` | Explicit `test`, `demo` or `prod`; use test/demo for staging |
| `KSEF_NIP` | NIP of the selected company |

Build scope:

- `VITE_PRIVATE_APP=true`
- Keep the existing Supabase public configuration and `VITE_APP_URL` appropriate for web/native.
- No server secret may use a `VITE_` prefix.

## Deployment sequence

1. Use an existing administrator session (Supabase SQL editor or a direct PostgreSQL connection); no ChatGPT Supabase plugin is required. Run `scripts/private-access-audit.sql` for a read-only inventory, then inspect actual owner/company IDs, all SECURITY DEFINER RPC grants, existing portal tokens and storage buckets. The inventory does not prove those RPCs are safe; review their implementations and grants. Audit is required: restrictive table RLS alone does not constrain pre-existing SECURITY DEFINER functions or public storage URLs.
2. On an isolated staging database, apply 169, 170, 171, 172 and 173 in order. Back up production before any production migration.
3. Verify the owner is a member/owner of the configured company. Set the one settings row with verified UUIDs:

```sql
UPDATE public.private_app_settings
SET owner_user_id = '<verified-auth-uuid>',
    company_id = '<verified-company-uuid>',
    enabled = TRUE
WHERE singleton = TRUE;
```

4. Configure matching server/build flags and credentials in Netlify, then deploy to staging. Netlify environment variables for Edge Functions must include Functions scope; TOML build variables alone do not supply them.
5. Confirm login/refresh, registration rejection and denial of non-owner direct REST/RPC/API access. Existing client portal RPCs and public file buckets must be closed or migrated before claiming fully private access. Existing files that still use public URLs require a signed-URL migration; this branch does not perform that migration.
6. Register Google OAuth configuration, enable Gmail API, complete owner consent through Settings → Asystent i Gmail. Verify wrong account/state replay are rejected. Run one mailbox page and one draft creation without sending email.
7. Log in to MF test/demo with matching NIP/environment. Verify encrypted credentials are saved; close the invoice session; close the browser; check final status and UPO arrive through the scheduled worker. Refresh-token expiry/revocation requires reauthentication; this is visible in settings.
8. Test MCP using a client that supplies `Authorization: Bearer <integration token>` to `/api/assistant/mcp`. The deployed endpoint has not been connected to this conversation. A ChatGPT surface requiring OAuth still needs an OAuth bridge/authorization server.
9. Complete the outstanding document and integration work below, verify end-to-end, then request approval for a concrete production deployment.

## Still outstanding — not represented as complete

- Proper source references and VAT deductions for advance/final settlement, persisted settlement links and correct correction XML; legacy invoice reconciliation. The current aggregate `advance_total` is insufficient. Until implemented, the exporter explicitly blocks advance/final/correction documents and any invoice carrying correction/advance-settlement data before network dispatch, instead of producing an incomplete or misclassified XML.
- Durable server-owned invoice dispatch/outbox for ambiguous submissions and duplicate-safe retries. Current dispatch is still client initiated.
- Atomic contract-tranche reconciliation for multiple invoices, corrections, reassignment and payment reversal.
- Actual production RPC/storage privacy audit and migration of existing public asset URLs.
- OAuth onboarding for the target ChatGPT/Work connector if static bearer headers are unsupported there.
- Autonomous email classification/client creation, attachment-content import, sending mail/offers under configured rules, and automatic invoicing are not implemented by the new queue. The current email tool prepares drafts only.
- Full business lifecycle automation and live account testing, including UI/mobile verification and deployment.

## Validation

- `npm run test:documents`: document/KSeF regression tests with mocked external services.
- `npm run test:private`: backend/auth/credential/queue tests plus real PostgreSQL behavior through PGlite on a minimal schema fixture. This is not a migration test against the production schema.
- `npm run typecheck` and `npm run build`.
- GitHub Quality gate now includes document regressions, private PostgreSQL integration and official XSD fixture validation. A local pass does not substitute for a successful hosted CI run.
- Bundle Netlify handlers/Edge function separately with esbuild to catch imports/runtime-target build errors.
- `node tests/ksef/render-fixtures.mjs /tmp/loftdesk-fa3-fixtures` then `python tests/ksef/validate-xsd.py /tmp/loftdesk-fa3-fixtures` (requires lxml). Fixtures validate standard/partial/domestic-zero XML against the official FA(3) XSD only; they do not certify tax semantics or ZAL/ROZ/correction handling.

Official references: https://developers.google.com/identity/protocols/oauth2/web-server ; https://github.com/CIRFMF/ksef-api/blob/main/uwierzytelnianie.md ; https://github.com/CIRFMF/ksef-api/blob/main/faktury/sesje/sesja-sprawdzenie-stanu-i-pobranie-upo.md ; https://docs.netlify.com/build/functions/scheduled-functions/ ; https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
