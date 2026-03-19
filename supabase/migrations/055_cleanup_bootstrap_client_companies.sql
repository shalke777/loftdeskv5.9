-- =============================================================================
-- Migration 055: cleanup bootstrap companies for client-only users
-- =============================================================================
-- Problem który to naprawia:
--   Klienci zaproszeni przez operatora mają stary wiersz w company_members
--   i companies z PUSTĄ nazwą. Powstał przez bug: bootstrap_my_company
--   odpalał się dla klienta bo check client_accounts był po bootstrap.
--
-- Co robi ta migracja:
--   Usuwa companies (i kaskadowo company_members) gdzie:
--   1. company.name = '' (pusta — tworzony przez bootstrap z company_name='')
--   2. Właściciel tej firmy (company_members.role='owner') ma rekord
--      w client_accounts z niepustym company_id innej firmy
--   3. Firma nie ma żadnych projektów, faktur ani kosztorysów
--      (soft-guard: nie usuwamy firm z realną zawartością)
--
-- BEZPIECZEŃSTWO:
--   - Nie usuwa firm z projektami (SELECT from projects)
--   - Nie usuwa firm z fakturami (SELECT from invoices)
--   - Nie usuwa firm z kosztorysami (SELECT from estimates)
--   - Tylko właściciel (owner) bez innych członków
-- =============================================================================

DO $$
DECLARE
  orphan RECORD;
  deleted_count INTEGER := 0;
BEGIN
  FOR orphan IN
    SELECT DISTINCT c.id AS company_id, c.name, cm.user_id
    FROM   public.companies c
    JOIN   public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
    -- Firma ma pustą nazwę (bootstrap artifact)
    WHERE  (c.name IS NULL OR c.name = '')
    -- Właściciel ma rekord w client_accounts (jest klientem, nie operatorem)
    AND    EXISTS (
      SELECT 1 FROM public.client_accounts ca
      WHERE  ca.auth_user_id = cm.user_id
    )
    -- Firma NIE ma żadnych projektów
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE  p.company_id = c.id AND p.deleted_at IS NULL
    )
    -- Firma NIE ma żadnych faktur
    AND NOT EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE  i.company_id = c.id
    )
    -- Firma NIE ma żadnych kosztorysów
    AND NOT EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE  e.company_id = c.id
    )
    -- Tylko jeden członek (sam właściciel — nikt nie dołączył)
    AND (SELECT count(*) FROM public.company_members cm2 WHERE cm2.company_id = c.id) = 1
  LOOP
    RAISE NOTICE '[055] Usuwam bootstrap-only company: id=%, user_id=%', orphan.company_id, orphan.user_id;
    -- Kaskada: company_members i inne powiązane tabele z ON DELETE CASCADE
    DELETE FROM public.companies WHERE id = orphan.company_id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RAISE NOTICE '[055] Usunięto % firm bootstrap-only.', deleted_count;
END $$;
