-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 116: company_price_list
-- Company-level default prices for service catalog items.
-- Allows pre-filling unit_price when adding from catalog.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_price_list (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  catalog_item_id  TEXT NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  unit_price       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS company_price_list_company_idx ON company_price_list(company_id);

ALTER TABLE company_price_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_price_list: company members can read"
  ON company_price_list FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "company_price_list: company members can upsert"
  ON company_price_list FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "company_price_list: company members can update"
  ON company_price_list FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "company_price_list: company members can delete"
  ON company_price_list FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );
