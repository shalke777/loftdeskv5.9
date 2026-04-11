-- =============================================================================
-- Migration 120: Add original_items to invoices for correction (korekta) support
--
-- Factury korygujące need to store the original items (before correction) so that
-- the PDF template can show a before/after comparison table without fetching the
-- original invoice again.
-- =============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS original_items jsonb;

COMMENT ON COLUMN public.invoices.original_items IS
  'For correction invoices (invoice_type=correction): stores the original invoice items '
  'before correction, as JSONB array. NULL for all other invoice types.';
