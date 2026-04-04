-- ── 102: Link cost_estimate_items → service_catalog ─────────────────────────
-- Adds optional catalog_item_id to estimate items.
-- If set, the item has a structural link to the canonical service catalog.
-- If NULL, the item is freeform (user-entered or unmatched AI suggestion).

ALTER TABLE public.cost_estimate_items
  ADD COLUMN IF NOT EXISTS catalog_item_id TEXT
    REFERENCES public.service_catalog(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cost_estimate_items.catalog_item_id IS
  'Optional FK to service_catalog. NULL = freeform item. Set by AI matcher or catalog picker.';
