-- Migration 122: Fix expense_invoices cost_type and source_type constraints
-- =============================================================================
-- Migration 034 added cost_type and source_type with overly strict constraints
-- that no longer match the v4 expense model:
--   cost_type:   NOT NULL DEFAULT 'internal_cost' CHECK (IN ('internal_cost',…))
--   source_type: NOT NULL DEFAULT 'manual'        CHECK (IN ('camera','gallery','pdf','manual'))
--
-- Migration 038 tried to re-add them as plain text but IF NOT EXISTS made it a no-op.
--
-- This migration:
--   1. Drops the old CHECK constraint on cost_type and makes it nullable
--   2. Drops the old NOT NULL on cost_type
--   3. Expands source_type CHECK to include 'room_photo'
-- =============================================================================

BEGIN;

-- ── 1. Drop old CHECK constraint on cost_type (name varies — drop all candidates) ──
ALTER TABLE public.expense_invoices
  DROP CONSTRAINT IF EXISTS expense_invoices_cost_type_check;

-- Also handle if PostgreSQL auto-named it differently
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.expense_invoices'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%cost_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.expense_invoices DROP CONSTRAINT IF EXISTS %I', c);
  END LOOP;
END;
$$;

-- ── 2. Make cost_type nullable (drop NOT NULL) ───────────────────────────────
ALTER TABLE public.expense_invoices
  ALTER COLUMN cost_type DROP NOT NULL;

-- ── 3. Nullify the DEFAULT so existing NULL-defaulted rows stay clean ─────────
ALTER TABLE public.expense_invoices
  ALTER COLUMN cost_type SET DEFAULT NULL;

-- ── 4. Expand source_type CHECK to include 'room_photo' ─────────────────────
-- First drop the existing CHECK constraint on source_type
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.expense_invoices'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%source_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.expense_invoices DROP CONSTRAINT IF EXISTS %I', c);
  END LOOP;
END;
$$;

-- Add the updated CHECK
ALTER TABLE public.expense_invoices
  ADD CONSTRAINT expense_invoices_source_type_check
  CHECK (source_type IN ('camera','gallery','pdf','manual','room_photo'));

COMMIT;

NOTIFY pgrst, 'reload schema';
