-- =============================================================================
-- 137 — Add ksef_number to invoices (final MF-assigned KSeF invoice number)
-- =============================================================================
-- Background:
--   In KSeF v2 flow we currently store ONE field — `ksef_ref` — populated
--   immediately after `POST /sessions/online/{ref}/invoices` returns HTTP 202.
--   That value is the SESSION-ELEMENT reference (EE-...). It is NOT the final
--   KSeF invoice number — the final number is only assigned by MF AFTER the
--   session is closed and the XML schema validation passes asynchronously.
--
--   Without that distinction we showed users a green "wysłana do KSeF" state
--   for invoices that MF later silently rejected (e.g. schema mismatch),
--   leading to invoices that never appeared in the official KSeF Aplikacja
--   Podatnika even though our DB said they did.
--
-- Fix:
--   Add a separate `ksef_number` column. Populated by the post-close status
--   poll (GET /sessions/{ref}/invoices) only when status.code = 200 (validated
--   and accepted). UI prefers `ksef_number` over `ksef_ref` once available.
-- =============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS ksef_number TEXT;

COMMENT ON COLUMN public.invoices.ksef_number IS
  'Final KSeF invoice number assigned by Ministry of Finance after session-close '
  'and schema validation. NULL until validation passes. Distinct from ksef_ref '
  '(session-element reference, available immediately after HTTP 202).';
