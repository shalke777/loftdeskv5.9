# KSeF reconciliation rollout

## Included behavior

- Persist the original submission session reference and environment on each acknowledged submission. No access tokens or encryption keys are added to invoice rows.
- Keep `ksef_pending` after submission. Set `ksef_sent` only after status 200 and a nonempty MF-assigned KSeF number.
- Retain submission references on terminal errors; the normal send action refuses to erase known KSeF identities.
- Resume verification every 15 seconds while the KSeF page is mounted with a real authenticated session. Use the original submission session and the currently authenticated token in the same environment.
- Verification reads pending invoices separately from the invoice list's 50-row window, oldest checked first, with a batch size of 10.
- Per-invoice errors do not prevent other invoices from being checked. Network/authentication failures remain visible and do not change an invoice to accepted/rejected.
- Fetch confirmation metadata from the original session when available.

## Deployment order

1. Confirm migrations through 168 are applied, including 137 (`ksef_number`).
2. Apply `169_invoice_ksef_reconciliation.sql` in staging, then production before deploying this application version. It adds nullable metadata and an index; it does not submit any documents.
3. The migration recovers old session metadata only from an audit event matching invoice ID, company ID, and submission reference. Rows with missing audit history require manual investigation; the app does not guess their original session.
4. Deploy the application and functions together. No production migration or deployment was performed while preparing this PR.

## Manual staging checks

Use MF test/demo infrastructure, not a production invoice, for these checks:

- Send a standard invoice and verify the initial pending state persists, including original session and environment.
- Observe intermediate status 100/150 without clearing the reference or labeling it rejected.
- Reload/reopen the KSeF page with an authenticated session. Verify a status 200 response plus assigned number changes the invoice to accepted.
- Test a terminal rejection. Check its reference, status code and diagnostic are retained; the ordinary queue action must refuse to erase them.
- Reauthenticate into a new session and verify a previously submitted invoice is queried using its old session reference.
- Select a different environment; verify the poller does not query invoices belonging to another environment.
- Test authentication failure and network failure: show an error and preserve the previous document state.

## Remaining work

This is not an unattended server worker. Verification stops when the page closes or the authentication token expires. Polling is bounded to 10 documents per pass and is sequential.

The original submission is still initiated by the client. A crash/network ambiguity before the submission reference is durably saved is not solved by this patch. Server-owned dispatch, durable outbox, transaction/lease handling and retry reconciliation are required before promising duplicate-safe fully autonomous sending.

Official signed UPO XML retrieval/storage, correction/advance/final XML correctness, partial invoice settlement, and owner-only/MCP/Gmail automation are separate outstanding work. Do not automatically requeue rejected or ambiguous submissions. Existing legacy submissions with no recoverable session metadata need manual reconciliation.

## Automated validation

`node --test tests/unit/ksef-sync.test.mjs`

`npm run typecheck`

`npm run build`

Tests use mocked MF/database dependencies. They do not certify tax treatment, apply migrations or submit documents to MF.

## Primary API reference

https://github.com/CIRFMF/ksef-api/blob/main/faktury/sesje/sesja-sprawdzenie-stanu-i-pobranie-upo.md

https://github.com/CIRFMF/ksef-api/blob/main/open-api.json

## Document arithmetic and tranche repairs

The invoice form, database calculations, legacy total helper, invoice PDF and KSeF XML now share a line-rounding policy: round line net to grosze, round its VAT to grosze, then add integer cents. XML generation rejects non-finite amounts, empty documents and stored totals that disagree with the generated lines. Existing persisted invoice amounts remain authoritative during reads; this patch does not migrate historic money values.

Contract.value is gross. Generating an invoice without estimate rows uses explicit contract.value_net when positive, otherwise converts gross to net using the contract VAT rate. Editing an invoice preserves tranche_id, draft form recovery retains the selection, and changing the contract explicitly clears it. Issuing a draft and saving a paid/issued invoice synchronize the linked tranche and refresh contract queries.

These changes do not complete advance settlement. The final-invoice form still stores only an aggregate advance_total, without source invoice references or VAT-rate deductions. The ZAL/ROZ/correction XML paths still need implementation and official schema/semantic verification. Selecting a tranche still infers document type from its label; this needs explicit payment-versus-completed-work semantics in the next iteration.

The existing tranche status helper still updates a JSON array with a read/modify/write operation. Atomic database reconciliation, multiple invoices for one tranche, corrections, reassignment and reversing payments remain outstanding. No historic contract statuses or invoice values were automatically rewritten.
