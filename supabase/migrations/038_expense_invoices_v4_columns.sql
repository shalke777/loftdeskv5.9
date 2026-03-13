-- =============================================================================
-- Migration 038 — expense_invoices v4 columns + HEIC bucket support
-- =============================================================================
-- Adds project-centric expense metadata columns required by projectExpensesApi
-- and ExpenseInvoiceV4. All columns are optional (nullable or default-backed)
-- for backward compatibility with existing rows and expensesApi (v1).

BEGIN;

-- ── New columns on expense_invoices ──────────────────────────────────────────

ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS source_type               text
    CHECK (source_type IN ('camera','gallery','pdf','manual')),
  ADD COLUMN IF NOT EXISTS cost_type                 text,
  -- approval_status tracks whether this expense was sent for client approval
  ADD COLUMN IF NOT EXISTS approval_status           text NOT NULL DEFAULT 'not_sent'
    CHECK (approval_status IN ('not_sent','pending_client','accepted','rejected','questioned')),
  -- OCR / parse metadata
  ADD COLUMN IF NOT EXISTS extraction_confidence     smallint,
  ADD COLUMN IF NOT EXISTS extraction_warnings       text[]   NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS requires_user_confirmation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parser_source             text
    CHECK (parser_source IN ('ai','regex','manual')),
  -- duplicate detection
  ADD COLUMN IF NOT EXISTS possible_duplicate        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of_expense_id   uuid
    REFERENCES public.expense_invoices(id) ON DELETE SET NULL,
  -- extra categorisation fields
  ADD COLUMN IF NOT EXISTS category                  text,
  ADD COLUMN IF NOT EXISTS currency                  text NOT NULL DEFAULT 'PLN',
  ADD COLUMN IF NOT EXISTS sale_date                 date,
  ADD COLUMN IF NOT EXISTS payment_due_date          date;

-- Index for duplicate detection queries
CREATE INDEX IF NOT EXISTS expense_invoices_approval_status_idx
  ON public.expense_invoices (company_id, approval_status);

-- ── Add HEIC / HEIF support to the company-files storage bucket ──────────────
-- iOS camera photos saved as HEIC files need to upload successfully.

UPDATE storage.buckets
SET    allowed_mime_types = array_append(
         array_append(allowed_mime_types, 'image/heic'),
         'image/heif'
       )
WHERE  id = 'company-files'
  AND  NOT ('image/heic' = ANY(allowed_mime_types));

-- ── Backfill approval_status for existing rows that have null (safety guard) ─
-- The column has NOT NULL DEFAULT 'not_sent' so new rows are fine;
-- existing rows set to '' via old code can be cleaned up:
UPDATE public.expense_invoices
SET    approval_status = 'not_sent'
WHERE  approval_status IS NULL OR approval_status = '';

COMMIT;

NOTIFY pgrst, 'reload schema';
