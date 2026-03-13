-- =============================================================================
-- Portal Diagnostic — uruchom w Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================================
-- Sprawdza: tabele, RPC, RLS, env (pośrednio przez połączenie)
-- =============================================================================

-- ─── 1. TABELE ──────────────────────────────────────────────────────────────
-- Dla każdej tabeli: TRUE = istnieje, NULL = BRAK (wymaga uruchomienia migracji)

SELECT
  'project_portal_tokens'    AS wymagana_tabela,
  to_regclass('public.project_portal_tokens')    IS NOT NULL AS istnieje
UNION ALL SELECT
  'project_portal_sessions',
  to_regclass('public.project_portal_sessions')  IS NOT NULL
UNION ALL SELECT
  'project_threads',
  to_regclass('public.project_threads')           IS NOT NULL
UNION ALL SELECT
  'project_messages',
  to_regclass('public.project_messages')          IS NOT NULL
UNION ALL SELECT
  'project_timeline_events',
  to_regclass('public.project_timeline_events')   IS NOT NULL
UNION ALL SELECT
  'cost_approvals',
  to_regclass('public.cost_approvals')            IS NOT NULL
ORDER BY wymagana_tabela;


-- ─── 2. RPC / SECURITY DEFINER FUNCTIONS (z migr. 034 i 035) ─────────────────
-- Wymagane dla działania portalu klienta

SELECT
  proname            AS funkcja,
  prosecdef          AS security_definer,
  pronargs           AS liczba_argumentow
FROM pg_proc
JOIN pg_namespace ns ON ns.oid = pronamespace
WHERE ns.nspname = 'public'
  AND proname IN (
    '_portal_validate_session',
    'portal_get_project',
    'portal_get_timeline',
    'portal_get_messages',
    'portal_send_message',
    'portal_get_approvals',
    'portal_respond_approval',
    'portal_mark_messages_read',
    'portal_session_project_id',
    'portal_session_has_scope',
    'create_timeline_event',
    'increment_thread_unread'
  )
ORDER BY proname;


-- ─── 3. RLS POLICIES na kluczowych tabelach portalu ─────────────────────────
-- Wszystkie powinny istnieć; brak = dane niewidoczne przez anon session

SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'project_portal_tokens',
    'project_portal_sessions',
    'project_threads',
    'project_messages',
    'cost_approvals'
  )
ORDER BY tablename, policyname;


-- ─── 4. KOLUMNA deleted_at w projects (wymaga migr. 034 KROK 0) ─────────────

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'projects'
  AND column_name  = 'deleted_at';

-- Jeśli pusty wynik → ALTER TABLE projects ADD COLUMN deleted_at timestamptz;


-- ─── 5. PRÓBNY ZAPIS — czy service_role może wstawiać sesje ─────────────────
-- Uruchom jako service_role (SQL Editor Supabase działa jako postgres / service_role)

INSERT INTO public.project_portal_sessions
  (portal_token_id, project_id, company_id, expires_at)
SELECT
  t.id,
  t.project_id,
  t.company_id,
  now() + interval '1 second'    -- wygaśnie za sekundę — nie zostawi śmieci
FROM public.project_portal_tokens t
LIMIT 1
RETURNING id, expires_at;

-- Jeśli błąd FK / RLS / brak tabeli → widoczny tutaj


-- ─── 6. LISTA AKTYWNYCH TOKENÓW (kontrola czy w ogóle jakis istnieje) ────────

SELECT
  id,
  company_id,
  project_id,
  active,
  expires_at,
  revoked_at,
  LEFT(token_hash, 8) || '…' AS token_hash_prefix,  -- NIE pokazuj pełnego hasha!
  created_at
FROM public.project_portal_tokens
WHERE active = true
  AND revoked_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
