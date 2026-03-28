-- =============================================================================
-- 068_client_items_rls.sql
-- =============================================================================
-- Umożliwia klientom portalu odczyt pozycji wycen i faktur przypisanych
-- do ich projektów. Wymagane do renderowania podglądu PDF (buildEstimatePreview
-- i buildInvoicePreview potrzebują tablicy items z każdego dokumentu).
--
-- Operatorzy nie są dotknięci — ich istniejące polityki pozostają.
-- Klient widzi TYLKO pozycje dokumentów ze swoich projektów.
-- =============================================================================

-- cost_estimate_items: klient może odczytać pozycje wyceny,
-- jeśli wycena należy do jego projektu.
DROP POLICY IF EXISTS "cei_client_select" ON public.cost_estimate_items;
CREATE POLICY "cei_client_select" ON public.cost_estimate_items
  FOR SELECT
  USING (
    my_app_role() = 'client'
    AND cost_estimate_id IN (
      SELECT id FROM public.cost_estimates
      WHERE project_id IN (SELECT my_client_project_ids())
    )
  );

-- invoice_items: klient może odczytać pozycje faktury,
-- jeśli faktura należy do jego projektu.
DROP POLICY IF EXISTS "ii_client_select" ON public.invoice_items;
CREATE POLICY "ii_client_select" ON public.invoice_items
  FOR SELECT
  USING (
    my_app_role() = 'client'
    AND invoice_id IN (
      SELECT id FROM public.invoices
      WHERE project_id IN (SELECT my_client_project_ids())
    )
  );
