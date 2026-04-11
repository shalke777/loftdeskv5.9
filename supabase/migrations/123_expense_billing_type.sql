-- Migration 123: Add billing_type to expense_invoices
-- =============================================================================
-- Distinguishes between:
--   'included'   — koszt wliczony w wycenę (part of contracted scope)
--   'additional' — koszt dodatkowy poza wycenę (extra, not in estimate)
-- NULL = nie określono (legacy rows / reductions)
-- =============================================================================

BEGIN;

ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS billing_type text
    CHECK (billing_type IN ('included', 'additional'));

COMMIT;

NOTIFY pgrst, 'reload schema';
