-- =============================================================================
-- verify-client-docs-065.sql
-- Weryfikacja widoczności dokumentów klienta w portalu LoftDesk
-- Uruchom w: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 1 — Czy migracja 065 jest wdrożona?
-- Sprawdzamy, czy polityki client SELECT istnieją na obu tabelach.
-- Oczekiwany wynik: 2 wiersze (pd_client_select + ppd_client_select)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename  IN ('project_documents', 'project_photo_docs')
  AND policyname IN ('pd_client_select', 'ppd_client_select')
ORDER BY tablename;

-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 2 — Wszystkie aktualne polityki na obu tabelach (pełny obraz)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename  IN ('project_documents', 'project_photo_docs')
ORDER BY tablename, policyname;

-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 3 — Czy funkcja my_client_project_ids() istnieje?
-- Oczekiwany wynik: 1 wiersz z routine_name = 'my_client_project_ids'
-- ─────────────────────────────────────────────────────────────────────────────
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('my_client_project_ids', 'my_app_role', 'resolve_my_client_account');

-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 4 — Czy są projekty z przypisanym klientem?
-- Pokazuje projekt + klient + czy ma dokumenty i photo_docs
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  p.id          AS project_id,
  p.name        AS project_name,
  p.company_id,
  ca.email      AS client_email,
  ca.auth_user_id,
  (SELECT COUNT(*) FROM project_documents pd WHERE pd.project_id = p.id AND pd.archived_at IS NULL) AS doc_count,
  (SELECT COUNT(*) FROM project_photo_docs ppd WHERE ppd.project_id = p.id)                         AS photo_count
FROM projects p
JOIN project_client_access pca ON pca.project_id = p.id
JOIN client_accounts ca        ON ca.id = pca.client_account_id
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 5 — Klienci bez auth_user_id (blokuje resolveSupabaseSession)
-- Każdy wiersz to klient, który nie może się zalogować jako client
-- ─────────────────────────────────────────────────────────────────────────────
SELECT id, email, company_id, created_at
FROM client_accounts
WHERE auth_user_id IS NULL
ORDER BY created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 6 — Czy wyceny, umowy, faktury mają project_id?
-- Klient widzi TYLKO dokumenty z project_id IN (my_client_project_ids()).
-- Jeśli project_id IS NULL, klient nie zobaczy nic.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'cost_estimates' AS tabela,
  COUNT(*) FILTER (WHERE project_id IS NULL)     AS brak_project_id,
  COUNT(*) FILTER (WHERE project_id IS NOT NULL) AS ma_project_id
FROM cost_estimates
UNION ALL
SELECT 'contracts',
  COUNT(*) FILTER (WHERE project_id IS NULL),
  COUNT(*) FILTER (WHERE project_id IS NOT NULL)
FROM contracts
UNION ALL
SELECT 'invoices',
  COUNT(*) FILTER (WHERE project_id IS NULL),
  COUNT(*) FILTER (WHERE project_id IS NOT NULL)
FROM invoices;

-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 7 — Symulacja widoku klienta (zastąp 'CLIENT-AUTH-UUID' prawdziwym UUID)
-- Uruchom dla konkretnego klienta by sprawdzić co widzi:
-- ZAKOMENTOWANE — odkomentuj + podaj właściwe UUID
-- ─────────────────────────────────────────────────────────────────────────────
/*
-- Zastąp '<CLIENT-AUTH-UUID>' przez UUID z auth.users dla tego klienta:
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<CLIENT-AUTH-UUID>","role":"authenticated"}';

SELECT 'projects' AS tabela, COUNT(*) AS widoczne FROM projects;
SELECT 'cost_estimates' AS tabela, COUNT(*) AS widoczne FROM cost_estimates;
SELECT 'contracts' AS tabela, COUNT(*) AS widoczne FROM contracts;
SELECT 'invoices' AS tabela, COUNT(*) AS widoczne FROM invoices;
SELECT 'project_documents' AS tabela, COUNT(*) AS widoczne FROM project_documents;
SELECT 'project_photo_docs' AS tabela, COUNT(*) AS widoczne FROM project_photo_docs;

RESET ROLE;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- NAPRAWA — Jeśli migracja 065 NIE istnieje (KROK 1 zwrócił 0 wierszy),
-- uruchom poniższy SQL by wdrożyć polityki ręcznie:
-- ─────────────────────────────────────────────────────────────────────────────
/*
-- project_documents — client SELECT
DROP POLICY IF EXISTS "pd_client_select" ON public.project_documents;
CREATE POLICY "pd_client_select" ON public.project_documents
  FOR SELECT
  USING (
    archived_at IS NULL
    AND project_id IN (SELECT public.my_client_project_ids())
  );

-- project_photo_docs — client SELECT
DROP POLICY IF EXISTS "ppd_client_select" ON public.project_photo_docs;
CREATE POLICY "ppd_client_select" ON public.project_photo_docs
  FOR SELECT
  USING (
    project_id IS NOT NULL
    AND project_id IN (SELECT public.my_client_project_ids())
  );
*/
