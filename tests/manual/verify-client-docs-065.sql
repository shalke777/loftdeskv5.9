-- =============================================================================
-- verify-client-docs-065.sql
-- Weryfikacja widoczności dokumentów klienta w portalu LoftDesk
-- Uruchom w: Supabase Dashboard → SQL Editor
--
-- UWAGA: uruchamiaj każdy KROK osobno (zaznacz + Run).
-- Uruchomienie całości naraz może zakończyć się błędem 42P01 jeśli
-- tabele z migracji 017/018 nie zostały jeszcze wdrożone.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 0 — Które kluczowe tabele ISTNIEJĄ w bazie?
-- Uruchom to PIERWSZE. Jeśli projekt_documents lub project_photo_docs
-- nie ma na liście → uruchom sekcję NAPRAWA-018 niżej przed kolejnymi krokami.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'projects',
    'project_documents',
    'project_photo_docs',
    'project_client_access',
    'client_accounts'
  )
ORDER BY table_name;

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
-- (bezpieczna wersja — nie wymaga istnienia project_documents)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  p.id          AS project_id,
  p.name        AS project_name,
  p.company_id,
  ca.email      AS client_email,
  ca.auth_user_id
FROM projects p
JOIN project_client_access pca ON pca.project_id = p.id
JOIN client_accounts ca        ON ca.id = pca.client_account_id
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- KROK 4b — Liczba dokumentów per projekt (uruchom TYLKO jeśli KROK 0
-- potwierdził, że project_documents i project_photo_docs istnieją)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  p.id          AS project_id,
  p.name        AS project_name,
  ca.email      AS client_email,
  (SELECT COUNT(*) FROM project_documents pd  WHERE pd.project_id = p.id AND pd.archived_at IS NULL) AS doc_count,
  (SELECT COUNT(*) FROM project_photo_docs ppd WHERE ppd.project_id = p.id)                          AS photo_count
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
-- NAPRAWA-018 — Jeśli project_documents NIE ISTNIEJE (KROK 0 nie pokazał jej),
-- uruchom poniższy blok w całości, a POTEM wróć do kroków 1-4b.
-- (Odpowiada migracji 018_project_bundles.sql)
-- ─────────────────────────────────────────────────────────────────────────────
/*
-- Rozszerzenie projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS investment_address  text,
  ADD COLUMN IF NOT EXISTS completeness_score  smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completeness_flags  jsonb    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived_at         timestamptz;

-- Rozszerzenie cost_estimates
ALTER TABLE cost_estimates
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cost_estimates_project_id_idx ON cost_estimates(project_id);

-- Tabela project_documents
CREATE TABLE IF NOT EXISTS project_documents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES companies(id)  ON DELETE CASCADE,
  project_id           uuid NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  doc_type             text NOT NULL CHECK (
                         doc_type IN ('estimate','contract','invoice','attachment','note','protocol','other')
                       ),
  doc_id               uuid NOT NULL,
  assignment_status    text NOT NULL DEFAULT 'confirmed'
                         CHECK (assignment_status IN ('confirmed','pending','rejected')),
  linked_automatically boolean NOT NULL DEFAULT false,
  linked_manually      boolean NOT NULL DEFAULT false,
  source_doc_type      text,
  source_doc_id        uuid,
  archived_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, project_id, doc_type, doc_id)
);

CREATE INDEX IF NOT EXISTS proj_docs_project_idx ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS proj_docs_doc_idx     ON project_documents(doc_type, doc_id);
CREATE INDEX IF NOT EXISTS proj_docs_active_idx  ON project_documents(company_id, project_id)
  WHERE archived_at IS NULL;

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_select" ON project_documents;
CREATE POLICY "pd_select" ON project_documents FOR SELECT
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pd_insert" ON project_documents;
CREATE POLICY "pd_insert" ON project_documents FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pd_update" ON project_documents;
CREATE POLICY "pd_update" ON project_documents FOR UPDATE
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pd_delete" ON project_documents;
CREATE POLICY "pd_delete" ON project_documents FOR DELETE
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- NAPRAWA-065 — Jeśli migracja 065 NIE istnieje (KROK 1 zwrócił 0 wierszy),
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
