# Private LoftDesk MCP for ChatGPT

Code is implemented and locally tested; no live connection has been activated.
This is the priority integration. Invoice/KSeF writes are outside this MCP scope.

## What it does

Endpoint: `https://loftdesk.pl/api/assistant/mcp` (stateless Streamable HTTP,
JSON responses; GET returns 405 because no SSE stream is offered).

| Tool | Result |
| --- | --- |
| `list_records` | Last 25 clients, projects, estimates, invoices, imported mails, notes or jobs |
| `search_records` | Search names, invoice numbers, mail subjects or note content |
| `get_document` | One estimate/invoice with its line items |
| `get_record` | One client/project/imported mail/note/job, including queued task result |
| `prepare_estimate` | Queue an offer draft using supplied prices |
| `add_note` | Queue a note |
| `sync_gmail` | Queue a mailbox import |
| `prepare_email` | Queue a Gmail draft; does not send it |

Every query is constrained to the configured company. Writes require both the
current database permission and a signed token permission. Keep an action's
idempotency key unchanged on retries. A `queued` result is not completion:
call `get_record` with `entity=jobs` and the returned job ID until done/failed/unknown.
The scheduled worker must be enabled for queued operations to run.

## Authentication design

Reuse the existing project's **Supabase Auth OAuth 2.1 server**; a ChatGPT
Supabase plugin is not needed. Supabase handles PKCE S256, authorization codes,
refresh rotation and the OAuth client's registered redirect URI. LoftDesk serves
protected-resource discovery and a first-party consent page at `/oauth/consent`.
There is no custom password store, homemade code exchange or OAuth token endpoint.

The resource server verifies ES256/RS256 signatures using the issuer JWKS, exact
issuer/audience, expiry, owner UUID, company UUID, approved OAuth client, token
version and permissions. Disabling a client immediately rejects its existing
JWTs. Re-enabling it must use a newer `token_version`.

Migration 174 supplies a Custom Access Token Hook. It leaves first-party tokens
unchanged and gives approved OAuth tokens a dedicated audience and role
`loftdesk_mcp_only`. **Do not create that database role or grant it to
`authenticator`**: MCP tokens intentionally cannot act directly as the owner's
ordinary Supabase REST/RPC session. Tools use constrained server operations.
Verify REST, storage and RPC denial with a real token before activation.

Supabase currently supports standard identity scopes, not custom application
scopes. Request only `email`; the actual read/draft permission is independently
enforced by the client row and signed MCP claims. The consent screen explains
the full business-data access. Access tokens are capped at 15 minutes by the
hook; revocation is checked on every MCP call, not just expiry.

## Activation sequence

Before activation, run `scripts/mcp-database-preflight.sql` in an administrator
SQL session. It only reads catalogs and bucket flags, reports absent objects
even before the new migrations exist, and returns no credentials or document
contents. Resolve its missing columns/functions against the actual schema;
do not use a local fixture pass as proof of production compatibility.

Production project verified in Netlify on 2026-10-16 (Europe/Warsaw): both
`SUPABASE_URL` and `VITE_SUPABASE_URL` point to project `ymozrnytqvvncwseppfa`
(`loftdeskv3`). The project's OAuth Server was disabled. No production migration,
OAuth grant or hook activation has been performed.

Direct Supabase plugin access subsequently verified the owner membership in
`LOFTBAU - PAWEŁ SZALECKI` (9 invoices and 9 estimates at audit time). The other
account candidate had no company membership. Actual schema inspection found
three draft-creation incompatibilities that are now fixed: the estimate needs
`user_id`, its item foreign key is `cost_estimate_id`, and item `description`
is mandatory. The PostgreSQL fixture enforces these production constraints.
No production tables or documents were modified by the audit.

Private tables/functions are still absent in production. The audit also found
public `company-files` (206 objects) and `company-logos` buckets, and the
security advisor flags a SECURITY DEFINER view `ghost_companies_candidates`.
Do not make the file bucket private without migrating existing public file
URLs to authenticated signed downloads. Audit each exposed SECURITY DEFINER
RPC before private cutover; a linter warning alone does not prove exploitation.

1. Finish private-owner provisioning from `private-loftdesk-rollout.md`, and apply
   migration 174 after 170–173. Use staging first. Do not run every historical
   migration against production blindly.
2. In the existing Supabase project, enable OAuth Server, set the authorization
   path to `/oauth/consent`, and use the correct site origin. Keep dynamic client
   registration disabled for this single-user integration.
3. Enable asymmetric JWT signing (ES256 or RS256). Preserve existing session
   compatibility during key rotation. Do not use HS256 for this MCP endpoint.
4. Register a dedicated confidential OAuth client in Supabase, with
   `authorization_code` and `refresh_token`, response type `code`, scope `email`
   and token authentication `client_secret_post` (or `client_secret_basic`,
   supported by the provider). Obtain its ID/secret in the administrator UI.
   Copy the **exact callback URI shown by ChatGPT** into its registered redirect
   URIs; callback-ID URLs may differ from the stable callback below. Do not
   invent a callback ID or use a wildcard.
5. Allow the same client in the private table, with its verified callback URI:

```sql
INSERT INTO public.private_mcp_clients
  (client_id, display_name, resource_url, redirect_uris, enabled, allow_write)
VALUES
  ('<registered-client-id>', 'ChatGPT — prywatny LoftDesk',
   'https://loftdesk.pl/api/assistant/mcp',
   ARRAY['<exact-callback-uri-from-chatgpt>'], TRUE, TRUE);
```

6. Enable the **PostgreSQL Custom Access Token Hook**
   `public.private_mcp_access_token_hook` in Supabase Authentication → Hooks.
   Inspect any existing hook first: Supabase uses one access-token hook, so
   compose existing behavior if necessary rather than replacing it blindly.
7. Configure server `LOFTDESK_MCP_RESOURCE_URL=https://loftdesk.pl/api/assistant/mcp`,
   existing Supabase server credentials and private owner/company flags.
   No new frontend secret is required. Leave `LOFTDESK_MCP_ALLOW_STATIC_TOKEN`
   unset/false; legacy bearer compatibility is explicitly opt-in.
8. Deploy the consent page, functions and metadata redirects together.
9. In ChatGPT's custom MCP connection UI, enter the server URL, select OAuth,
   supply the registered OAuth client ID/secret, and scope `email` where the UI
   allows it. Install/use this as a private personal connection; public directory
   submission is unnecessary. Complete login and consent in LoftDesk.
10. Verify the actual ChatGPT flow: discovery → native Supabase authorization →
    owner consent → token exchange → `initialize` → `tools/list` → company read.
    Then test one note/offer draft and inspect its completed job. Test expiry/
    refresh, another user, wrong audience/client and immediate revocation.

Current resource metadata:
`/.well-known/oauth-protected-resource/api/assistant/mcp` (root alias also served).
It advertises issuer `https://<existing-project>.supabase.co/auth/v1`; the native
provider publishes its own authorization-server discovery. Do not fabricate a
discovery document on LoftDesk that advertises capabilities the provider lacks.

## Unverified deployment details

- OAuth Server activation, account capabilities, registered callbacks and native
  issuer metadata must be checked against the real project. They cannot be
  inferred from the repo. If native discovery fails ChatGPT's current validation,
  inspect that document and fix the provider configuration before connecting.
- Live hook input/claims, refresh issuance and the dedicated-role denial still
  need real-project tests. The local PostgreSQL fixture exercises the hook but
  does not simulate Supabase Auth's entire token issuance pipeline.
- Existing OAuth grants must be revoked before removing the hook or rolling
  back the dedicated-role isolation.
- The repository has no administrator credentials for production Netlify or
  Supabase. No real Google/MF/account operation was performed by this work.

## Checks

`npm run test:mcp` uses actual signed JWTs, adversarial claim checks, revocation,
read-only enforcement and the official MCP SDK over a local HTTP server.
`npm run test:private` includes the PostgreSQL hook/owner/client/expiry tests.
`npm run typecheck` and `npm run build` cover the consent/settings UI.

Primary references:
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
- https://supabase.com/docs/guides/auth/oauth-server/token-security
