-- =============================================================================
-- 135 — Add ksef_last_error to invoices
-- =============================================================================
-- Purpose:
--   Persist the last KSeF send/validation error per invoice so the UI can
--   surface a real reason ("brak NIP sprzedawcy", "422 invalid XML", "503
--   gateway timeout") instead of a generic "ksef_error" status.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS ksef_last_error TEXT;

COMMENT ON COLUMN public.invoices.ksef_last_error IS
  'Last error message returned by KSeF or local pre-flight guard. Cleared on successful send.';
