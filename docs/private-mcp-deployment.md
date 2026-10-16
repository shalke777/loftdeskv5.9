# Reviewed MCP foundation deployment

Status: production application and database have not been changed. The automatic
approval reviewer rejected the production foundation migration on 2026-10-16
because a production backup and staging verification were not established.
Do not retry the same operation through another tool or split it to avoid review.

## Concrete package

Generate without connecting to production:

```sh
node scripts/prepare-mcp-rollout.mjs /tmp/loftdesk-mcp-foundation.sql
```

The output is one transaction containing migrations 170, 171, 172 and 174.
It creates owner settings, an empty OAuth client allowlist, the automation
queue, notes and inbox, credential/state tables, queue functions and notification
triggers. It adds restrictive gates to existing tables that already have RLS
and a signup trigger. These gates remain permissive while settings.enabled is
false; signup also remains unchanged until owner mode is enabled.

It extends the checked notification type list with `automation`. That original
constraint and existing types were inspected in production before packaging.
There are no document/data deletions, no invoice submissions, no OAuth grants,
no signing-key changes and no scheduled worker activation in this package.
Migrations 130–169 and 173 are excluded; do not deploy unrelated backlog work.

Locks time out after five seconds; each statement has a 45-second limit.
An error rolls back the transaction. Owner mode is asserted to remain disabled.
Applying through the Supabase migration tool should omit the outer BEGIN/COMMIT
if that tool provides its own transaction.

## Evidence and remaining gates

- The live project is loftdeskv3 (`ymozrnytqvvncwseppfa`), matching both Netlify URLs.
- Verified LOFTBAU owner membership and existing document counts by read-only SQL.
- Local official MCP SDK tests and PostgreSQL integration pass. The fixture now
  requires the actual estimate author, cost_estimate_id FK and item description.
- Required before production: verify a restorable backup; test the package on an
  isolated schema/environment; obtain approval for this exact production package.
- After production install: run `mcp-database-preflight.sql`; inspect grants and
  advisors; test a draft/note inside BEGIN/ROLLBACK and confirm no records remain.
- Native Auth provider configuration and Netlify env/deploy configuration are
  separate steps. The installed Supabase tools expose database operations but
  do not expose management of Auth server configuration or Netlify environments.
- Before private cutover: review exposed privileged RPCs and migrate public file
  URLs. Do not simply hide public bucket downloads and break existing documents.
- Before claiming ChatGPT is connected: complete native OAuth consent, actual
  token issuance/refresh, direct REST denial, one completed queue job and revoke.

`mcp-foundation-revert.sql` removes only the foundation's legacy-access changes
before activation; it preserves all new tables. It refuses after owner mode,
OAuth clients or jobs have been enabled/used. After activation, first revoke
OAuth grants and use a separately reviewed rollback that preserves private access.
