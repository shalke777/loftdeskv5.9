-- =============================================================================
-- Migration 117: Allow custom (non-catalog) entries in company_price_list
-- =============================================================================
-- Adds custom_label column and makes catalog_item_id nullable so contractors
-- can store prices for services that aren't in the service_catalog.
-- =============================================================================

-- 1. Make catalog_item_id nullable (keep FK for catalog entries)
ALTER TABLE company_price_list
  ALTER COLUMN catalog_item_id DROP NOT NULL;

-- 2. Add custom_label for non-catalog entries
ALTER TABLE company_price_list
  ADD COLUMN IF NOT EXISTS custom_label TEXT;

-- 3. Add id column for display/delete of custom entries  
ALTER TABLE company_price_list
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- 4. Constraint: at least one of catalog_item_id or custom_label must be set
ALTER TABLE company_price_list
  ADD CONSTRAINT price_list_identity_check
  CHECK (
    catalog_item_id IS NOT NULL OR
    (custom_label IS NOT NULL AND trim(custom_label) != '')
  );

-- 5. Unique index for custom entries (catalog entries already have UNIQUE on company_id,catalog_item_id)
CREATE UNIQUE INDEX IF NOT EXISTS company_price_list_custom_unique
  ON company_price_list (company_id, custom_label)
  WHERE catalog_item_id IS NULL;
