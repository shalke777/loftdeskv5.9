# Reviewed MCP foundation deployment

Status as of 2026-10-16: the production database foundation was installed after
explicit user approval and an isolated PostgreSQL rehearsal using metadata from
63 production tables. Owner/company are provisioned, but enabled remains false;
there are no registered OAuth clients or persistent test jobs. Production app
deployment, Auth provider setup and actual ChatGPT connection remain outstanding.

The first production attempt was rejected. A retry was approved after user
confirmation and the rehearsal. A schema-only snapshot was retained; this was
not a full user-data backup or a complete Supabase staging environment. The
rehearsal restored columns, generated columns, CHECK, PK and UNIQUE constraints;
it did not reproduce all foreign keys, triggers, RLS policies or provider services.

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
- Completed: approved foundation installation, followed by a real draft/note
  smoke test inside BEGIN/ROLLBACK. Verified author, item link/description, totals,
  notification, job replay and note. After rollback: 0 jobs, 0 notes, 0 clients;
  existing owner invoice and estimate counts remain 9 each.
- Default grants in the live schema differed from the original local fixture:
  explicit anon/authenticated function EXECUTE survived REVOKE FROM PUBLIC.
  Applied a corrective grant migration and verified all five internal functions
  deny anon/authenticated while service_role retains access. Fixtures now model
  those default grants, and the original migration sources also remove them.
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

Reproduce the isolated rehearsal without contacting a service:

```sh
node scripts/prepare-mcp-rollout.mjs /tmp/loftdesk-mcp-foundation.sql
node scripts/test-mcp-schema-snapshot.mjs tests/fixtures/mcp-production-schema.json /tmp/loftdesk-mcp-foundation.sql
```

The fixture is catalog metadata only and contains no user records or credentials.
Before any later broad private cutover, establish a full restorable backup and
test the complete production schema and real provider behavior on staging.
