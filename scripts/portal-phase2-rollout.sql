-- =============================================================================
-- Portal Phase 2 Rollout — operacyjny skrypt diagnostyczny
-- Uruchom w Supabase SQL Editor (service role) przed i po każdym batchu.
-- =============================================================================
-- KOLEJNOŚĆ UŻYCIA:
--   [STEP 0]  Weryfikacja wdrożenia migracji 049
--   [STEP 1]  Ranking firm do migracji
--   [STEP 2]  Aktywność tokenów (ostatnie 30 dni) — priorytet Fazy 3
--   [STEP 3]  Szczegółowy widok per firma
--   [STEP 4]  Lista no_email do ręcznego działania
--   [STEP 5]  Lista skipped z klasyfikacją
--   [STEP 6]  Kontrola idempotencji — duplikaty
--   [STEP 7]  Reset skipped → pending (po klasyfikacji, nie hurtowo)
--   [STEP 8]  Kryterium wejścia do Fazy 3
-- =============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 0: Weryfikacja migracji 049 — uruchom PRZED cokolwiek innego
-- ════════════════════════════════════════════════════════════════════════════
-- Oczekiwane wyniki:
--   migrated_at      → FOUND
--   migration_status → FOUND
--   idx_ppt_migration_status → FOUND
--   v_portal_migration_status → FOUND

SELECT 'migrated_at' AS element,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'project_portal_tokens'
      AND column_name  = 'migrated_at'
  ) THEN 'FOUND ✓' ELSE 'MISSING ✗ — uruchom 049_portal_phase2.sql' END AS status
UNION ALL
SELECT 'migration_status',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'project_portal_tokens'
      AND column_name  = 'migration_status'
  ) THEN 'FOUND ✓' ELSE 'MISSING ✗ — uruchom 049_portal_phase2.sql' END
UNION ALL
SELECT 'idx_ppt_migration_status',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname  = 'idx_ppt_migration_status'
  ) THEN 'FOUND ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'v_portal_migration_status',
  CASE WHEN to_regclass('public.v_portal_migration_status') IS NOT NULL
    THEN 'FOUND ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'v_portal_token_activity',
  CASE WHEN to_regclass('public.v_portal_token_activity') IS NOT NULL
    THEN 'FOUND ✓' ELSE 'MISSING ✗' END;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1: Ranking firm do migracji
-- Posortowane: najpierw firmy z największą liczbą ready
-- ════════════════════════════════════════════════════════════════════════════
-- UŻYJ: przed uruchomieniem batchy — ustal kolejność firm

SELECT
  ppt.company_id,
  c.name                                                           AS company_name,
  COUNT(*) FILTER (WHERE v.action = 'ready')                       AS ready,
  COUNT(*) FILTER (WHERE v.action = 'done')                        AS done,
  COUNT(*) FILTER (WHERE v.action = 'no_email')                    AS no_email,
  COUNT(*) FILTER (WHERE v.action = 'skipped')                     AS skipped,
  COUNT(*) FILTER (WHERE v.action = 'expired_token')               AS expired_token,
  COUNT(*)                                                         AS total_tokens,
  CASE
    WHEN COUNT(*) FILTER (WHERE v.action = 'ready') > 0
      THEN 'WYMAGA BATCHA'
    WHEN COUNT(*) FILTER (WHERE v.action = 'no_email') > 0
      THEN 'WYMAGA RĘCZNEGO ZAPROSZENIA'
    ELSE 'OK'
  END AS status_firmy
FROM public.v_portal_migration_status v
JOIN public.project_portal_tokens ppt ON ppt.id = v.id
LEFT JOIN public.companies c ON c.id = ppt.company_id
GROUP BY ppt.company_id, c.name
ORDER BY ready DESC, no_email DESC, company_name;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2: Aktywność tokenów — ostatnie 30 dni (kryterium Fazy 3)
-- ════════════════════════════════════════════════════════════════════════════
-- Firmy z aktywnością tokenową w ostatnich 30 dniach BLOKUJĄ wejście do Fazy 3.
-- Te firmy powinny mieć najwyższy priorytet migracji.

SELECT
  v.company_id,
  c.name                      AS company_name,
  v.token_id,
  v.project_id,
  v.total_sessions,
  v.last_session_at,
  EXTRACT(DAY FROM now() - v.last_session_at)::int AS dni_od_ostatniej_sesji,
  CASE
    WHEN v.last_session_at > now() - INTERVAL '7 days'  THEN 'AKTYWNY — < 7 dni'
    WHEN v.last_session_at > now() - INTERVAL '30 days' THEN 'AKTYWNY — < 30 dni'
    ELSE 'NIEAKTYWNY — > 30 dni'
  END AS aktywnosc
FROM public.v_portal_token_activity v
LEFT JOIN public.companies c ON c.id = v.company_id
WHERE v.last_session_at IS NOT NULL
ORDER BY v.last_session_at DESC;

-- Podsumowanie: które firmy mają aktywne tokeny
SELECT
  company_id,
  COUNT(*) FILTER (WHERE last_session_at > now() - INTERVAL '30 days') AS tokeny_aktywne_30d,
  COUNT(*) FILTER (WHERE last_session_at > now() - INTERVAL '7 days')  AS tokeny_aktywne_7d,
  MAX(last_session_at)                                                  AS ostatnia_sesja
FROM public.v_portal_token_activity
WHERE last_session_at IS NOT NULL
GROUP BY company_id
ORDER BY tokeny_aktywne_30d DESC;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 3: Szczegółowy widok dla konkretnej firmy
-- ════════════════════════════════════════════════════════════════════════════
-- UŻYJ: zastąp NULL poniżej faktycznym UUID firmy.
--
--   Przykład:
--   SELECT company_id, name FROM public.companies ORDER BY name;
--   -- skopiuj UUID, wklej jako drugi argument NULLIF poniżej:
--   NULLIF('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', '???')::uuid
--
-- Dopóki zostawisz NULL — zapytanie wykona się bez błędu zwracając 0 wierszy.

SELECT
  v.id                    AS token_id,
  v.project_id,
  v.client_email,
  v.client_name,
  v.migration_status,
  v.action,
  v.migrated_at,
  v.active,
  v.expires_at,
  v.client_account_id IS NOT NULL AS ma_konto,
  v.total_sessions,
  v.last_seen_at
FROM public.v_portal_migration_status v
WHERE v.company_id = (
  -- ➜ ZASTĄP NULL PONIŻEJ UUID-em firmy, np.:
  --   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid
  NULL::uuid
)
ORDER BY
  CASE v.action
    WHEN 'ready'         THEN 1
    WHEN 'skipped'       THEN 2
    WHEN 'no_email'      THEN 3
    WHEN 'done'          THEN 4
    WHEN 'expired_token' THEN 5
    ELSE 6
  END,
  v.last_seen_at DESC NULLS LAST;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 4: Lista no_email — do ręcznego działania
-- ════════════════════════════════════════════════════════════════════════════
-- Eksport: ta lista jest checklistą dla operatora.
-- Każdy rekord wymaga ręcznego zaproszenia przez ProjectPortalCTA.

SELECT
  c.name                            AS firma,
  ppt.company_id,
  ppt.project_id,
  p.name                            AS projekt,
  ppt.id                            AS token_id,
  ppt.client_name,
  ppt.active,
  ppt.created_at                    AS token_utworzony,
  ppt.expires_at                    AS token_wygasa,
  ppt.migration_status,
  'WYMAGANE RĘCZNE ZAPROSZENIE'     AS akcja,
  'ProjectPortalCTA → Zaproś klienta (podaj email)' AS instrukcja
FROM public.project_portal_tokens ppt
LEFT JOIN public.companies c ON c.id = ppt.company_id
LEFT JOIN public.projects   p ON p.id = ppt.project_id
WHERE ppt.client_email IS NULL
  AND ppt.active = true
  AND (ppt.expires_at IS NULL OR ppt.expires_at > now())
  AND (ppt.revoked_at IS NULL)
ORDER BY c.name, p.name;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 5: Lista skipped z klasyfikacją
-- ════════════════════════════════════════════════════════════════════════════
-- Klasyfikacja per rekord — wypełnij kolumnę 'klasyfikacja' ręcznie.

SELECT
  c.name                                   AS firma,
  ppt.id                                   AS token_id,
  ppt.project_id,
  p.name                                   AS projekt,
  ppt.client_email,
  ppt.migrated_at,
  ppt.migration_status,
  ppt.active,
  ppt.expires_at,
  -- Operator powinien ocenić każdy rekord:
  -- A = chwilowy błąd techniczny (np. OTP rate limit) — można retry
  -- B = zły rekord (brak auth, email nieprawidłowy) — ręczna interwencja
  -- C = token wygasł / unieważniony — nie retry
  CASE
    WHEN NOT ppt.active OR ppt.revoked_at IS NOT NULL
      OR (ppt.expires_at IS NOT NULL AND ppt.expires_at < now())
      THEN 'C — token nieaktywny/wygasł — nie retry'
    WHEN ppt.client_email IS NULL
      THEN 'B — brak emaila — ręczna interwencja'
    ELSE 'A — potencjalny retry (sprawdź logi Netlify)'
  END AS klasyfikacja
FROM public.project_portal_tokens ppt
LEFT JOIN public.companies c ON c.id = ppt.company_id
LEFT JOIN public.projects   p ON p.id = ppt.project_id
WHERE ppt.migration_status = 'skipped'
ORDER BY c.name, klasyfikacja;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 6: Kontrola idempotencji — czysty stan duplikatów
-- ════════════════════════════════════════════════════════════════════════════
-- Uruchom PO każdym batchu. Oczekiwane wyniki: 0 duplikatów.

-- 6a. Duplikaty client_accounts per (company_id, email)
SELECT
  company_id,
  email,
  COUNT(*) AS liczba_rekordow
FROM public.client_accounts
GROUP BY company_id, email
HAVING COUNT(*) > 1
ORDER BY liczba_rekordow DESC;
-- Oczekiwane: 0 wierszy

-- 6b. Duplikaty project_client_access per (project_id, client_account_id)
SELECT
  project_id,
  client_account_id,
  COUNT(*) AS liczba_rekordow
FROM public.project_client_access
GROUP BY project_id, client_account_id
HAVING COUNT(*) > 1
ORDER BY liczba_rekordow DESC;
-- Oczekiwane: 0 wierszy

-- 6c. Tokeny zmigrowane bez migrated_at (anomalia śledzenia)
SELECT id, company_id, project_id, migration_status, migrated_at
FROM public.project_portal_tokens
WHERE migration_status = 'migrated'
  AND migrated_at IS NULL;
-- Oczekiwane: 0 wierszy

-- 6d. Tokeny pending bez emaila (powinny mieć 'no_email' po backfillu)
SELECT id, company_id, project_id, client_email, migration_status
FROM public.project_portal_tokens
WHERE migration_status = 'pending'
  AND client_email IS NULL;
-- Oczekiwane: 0 wierszy (backfill 049 powinien był to naprawić)

-- 6e. Klienci bez auth_user_id po migracji (RLS będzie blokować ich login)
SELECT
  ca.id,
  ca.company_id,
  ca.email,
  ca.created_at,
  EXISTS(
    SELECT 1 FROM public.project_portal_tokens ppt
    WHERE ppt.client_account_id = ca.id
      AND ppt.migration_status = 'migrated'
  ) AS token_zmigrowany
FROM public.client_accounts ca
WHERE ca.auth_user_id IS NULL
ORDER BY ca.created_at DESC;
-- Oczekiwane: 0 wierszy zmigrowanych bez auth_user_id
-- Jeśli są — batch mógł nie wywołać admin.generateLink() poprawnie


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 7: Reset skipped → pending (tylko dla klasy A, po klasyfikacji)
-- ════════════════════════════════════════════════════════════════════════════
-- NIE uruchamiaj hurtowo. Najpierw uruchom STEP 5 i sklasyfikuj rekordy.
-- Dann wykonaj reset wyłącznie dla konkretnych token_id klasy A.
--
-- Szablon — zastąp UUID-y faktycznymi wartościami:

/*
UPDATE public.project_portal_tokens
   SET migration_status = 'pending'
 WHERE id IN (
   '<TOKEN_UUID_1>',
   '<TOKEN_UUID_2>'
   -- dodaj kolejne UUID-y klasy A
 )
   AND migration_status = 'skipped'
   AND active = true
   AND (revoked_at IS NULL)
   AND (expires_at IS NULL OR expires_at > now());

-- Sprawdź ile rekordów zostało przywróconych:
SELECT id, company_id, client_email, migration_status FROM public.project_portal_tokens
WHERE id IN ('<TOKEN_UUID_1>', '<TOKEN_UUID_2>');
*/


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 8: Kryterium wejścia do Fazy 3
-- ════════════════════════════════════════════════════════════════════════════
-- OBA warunki muszą być TRUE jednocześnie przez min. 30 dni.

SELECT
  'Kryterium 1: brak ready'  AS kryterium,
  (SELECT COUNT(*) FROM public.v_portal_migration_status WHERE action = 'ready') AS liczba,
  CASE WHEN (SELECT COUNT(*) FROM public.v_portal_migration_status WHERE action = 'ready') = 0
    THEN 'SPEŁNIONE ✓' ELSE 'NIESPEŁNIONE ✗ — uruchom batch dla firm z ready > 0' END AS status
UNION ALL
SELECT
  'Kryterium 2: brak sesji < 30 dni',
  (SELECT COUNT(*) FROM public.v_portal_token_activity WHERE last_session_at > now() - INTERVAL '30 days'),
  CASE WHEN (SELECT COUNT(*) FROM public.v_portal_token_activity WHERE last_session_at > now() - INTERVAL '30 days') = 0
    THEN 'SPEŁNIONE ✓' ELSE 'NIESPEŁNIONE ✗ — okno obserwacyjne nie minęło' END;

-- Pełna ocena gotowości Fazy 3:
SELECT
  CASE
    WHEN
      (SELECT COUNT(*) FROM public.v_portal_migration_status WHERE action = 'ready') = 0
      AND
      (SELECT COUNT(*) FROM public.v_portal_token_activity WHERE last_session_at > now() - INTERVAL '30 days') = 0
    THEN 'FAZA 3 MOŻLIWA ✓ — wykonaj cleanup legacy po zatwierdzeniu'
    ELSE 'FAZA 3 ZABLOKOWANA — sprawdź kryteria powyżej'
  END AS rekomendacja;


-- ════════════════════════════════════════════════════════════════════════════
-- MONITORING: Per-firma status po rolloutcie
-- ════════════════════════════════════════════════════════════════════════════

SELECT
  c.id                                                              AS company_id,
  c.name                                                            AS company_name,
  COUNT(*) FILTER (WHERE v.action = 'ready')                        AS ready,
  COUNT(*) FILTER (WHERE v.action = 'done')                         AS done,
  COUNT(*) FILTER (WHERE v.action = 'no_email')                     AS no_email,
  COUNT(*) FILTER (WHERE v.action = 'skipped')                      AS skipped,
  (SELECT MAX(ta.last_session_at)
     FROM public.v_portal_token_activity ta
    WHERE ta.company_id = c.id)                                     AS ostatnia_sesja_tokenowa,
  CASE
    WHEN COUNT(*) FILTER (WHERE v.action = 'ready') = 0
     AND COUNT(*) FILTER (WHERE v.action = 'skipped') = 0
     AND (
           SELECT MAX(ta.last_session_at)
             FROM public.v_portal_token_activity ta
            WHERE ta.company_id = c.id
         ) < now() - INTERVAL '30 days'
      OR (
           SELECT MAX(ta.last_session_at)
             FROM public.v_portal_token_activity ta
            WHERE ta.company_id = c.id
         ) IS NULL
      THEN 'ready_for_phase_3_window ✓'
    WHEN COUNT(*) FILTER (WHERE v.action = 'ready') = 0
     AND COUNT(*) FILTER (WHERE v.action = 'skipped') = 0
      THEN 'migration_complete_waiting_window ⏳'
    WHEN COUNT(*) FILTER (WHERE v.action = 'skipped') > 0
      THEN 'needs_manual_cleanup ⚠'
    WHEN COUNT(*) FILTER (WHERE v.action = 'ready') > 0
      THEN 'WYMAGA BATCHA 🔄'
    ELSE 'OK'
  END AS per_firma_status
FROM public.companies c
LEFT JOIN public.v_portal_migration_status v ON v.company_id = c.id
GROUP BY c.id, c.name
HAVING COUNT(v.id) > 0   -- tylko firmy z jakimikolwiek tokenami
ORDER BY
  CASE
    WHEN COUNT(*) FILTER (WHERE v.action = 'ready') > 0 THEN 1
    WHEN COUNT(*) FILTER (WHERE v.action = 'skipped') > 0 THEN 2
    WHEN COUNT(*) FILTER (WHERE v.action = 'no_email') > 0 THEN 3
    ELSE 4
  END,
  c.name;
