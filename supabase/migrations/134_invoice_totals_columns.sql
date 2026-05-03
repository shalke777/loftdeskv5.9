-- =============================================================================
-- 134 — Add total_net / total_gross to invoices (fix list query)
-- =============================================================================
-- Root cause:
--   Commit e2a48293 ("perf round-2") changed invoicesApi.list() to use explicit
--   columns including total_net / total_gross — but these columns never existed
--   on `invoices` (only on `cost_estimates`). PostgREST therefore drops/errors
--   on the list, so newly-created invoices never show up in the UI even though
--   the INSERT succeeds and the toast fires.
--
-- Fix:
--   1. Add the two columns (idempotent).
--   2. Trigger keeps them in sync with invoice_items (insert/update/delete).
--   3. One-time backfill from existing invoice_items.
-- =============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS total_net   NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS total_gross NUMERIC(14,2) NOT NULL DEFAULT 0;

-- ── Recalc function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net   NUMERIC(14,2);
  v_gross NUMERIC(14,2);
BEGIN
  SELECT
    COALESCE(SUM(quantity * unit_price), 0)::NUMERIC(14,2),
    COALESCE(SUM(quantity * unit_price * (1 + COALESCE(vat_rate, 23) / 100.0)), 0)::NUMERIC(14,2)
  INTO v_net, v_gross
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id;

  UPDATE public.invoices
     SET total_net   = v_net,
         total_gross = v_gross
   WHERE id = p_invoice_id;
END;
$$;

-- ── Trigger: sync totals on item changes ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invoice_items_totals_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_invoice_totals(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_invoice_totals(NEW.invoice_id);
    IF TG_OP = 'UPDATE' AND OLD.invoice_id <> NEW.invoice_id THEN
      PERFORM public.recalc_invoice_totals(OLD.invoice_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_items_totals ON public.invoice_items;
CREATE TRIGGER trg_invoice_items_totals
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.invoice_items_totals_trigger();

-- ── Backfill existing invoices ───────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.invoices LOOP
    PERFORM public.recalc_invoice_totals(r.id);
  END LOOP;
END $$;
