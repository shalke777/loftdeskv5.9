-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 050: Portal Phase 4 — finalne usunięcie legacy token-portal (DB)
-- ─────────────────────────────────────────────────────────────────────────────
-- Co usuwa:
--   • Widoki diagnostyczne: v_portal_token_activity, v_portal_migration_status
--   • RPC (SECURITY DEFINER) z migration 035: _portal_validate_session,
--     portal_get_project, portal_get_timeline, portal_get_approvals,
--     portal_respond_approval, portal_get_messages, portal_send_message,
--     portal_mark_messages_read
--   • Tabele: project_portal_sessions, portal_messages, client_tokens
--
-- Co POZOSTAJE (aktywnie używane przez canonical invite flow — ProjectPortalCTA):
--   • public.project_portal_tokens   → usunąć w Phase 5 po refaktorze invite flow
--   • portal-token-create.ts         → usunąć w Phase 5
--   • portal-revoke.ts               → usunąć w Phase 5
--
-- Przedwarunki spełnione przez Fazy 3–4 (kod aplikacji):
--   • PortalProjectPage + wszystkie komponenty portalu sessionowego — usunięte
--   • netlify/functions/portal-validate.ts — usunięty (brak nowych sesji)
--   • usePortalNotifications.ts — zastąpiony stubem (brak zapytań do portal_messages)
--   • client-identify.ts — usunięty fallback na client_tokens
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Widoki (muszą być usunięte przed tabelami, od których zależą) ──────────

DROP VIEW IF EXISTS public.v_portal_token_activity;
DROP VIEW IF EXISTS public.v_portal_migration_status;

-- ── 2. RPC z migration 035 (używają project_portal_sessions.id jako p_session_id)

DROP FUNCTION IF EXISTS public._portal_validate_session(uuid, text);
DROP FUNCTION IF EXISTS public.portal_get_project(uuid);
DROP FUNCTION IF EXISTS public.portal_get_timeline(uuid, int);
DROP FUNCTION IF EXISTS public.portal_get_approvals(uuid);
DROP FUNCTION IF EXISTS public.portal_respond_approval(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.portal_get_messages(uuid, int);
DROP FUNCTION IF EXISTS public.portal_send_message(uuid, text, text);
DROP FUNCTION IF EXISTS public.portal_mark_messages_read(uuid);

-- ── 3. Tabele (CASCADE usuwa też powiązane RLS, indeksy, FK) ─────────────────

-- project_portal_sessions: tworzono wyłącznie przez portal-validate.ts (usunięty)
DROP TABLE IF EXISTS public.project_portal_sessions CASCADE;

-- portal_messages: messaging legacy portalu; usePortalNotifications zastąpiony stubem
DROP TABLE IF EXISTS public.portal_messages CASCADE;

-- client_tokens: legacy v3-era invite; fallback w client-identify.ts usunięty
DROP TABLE IF EXISTS public.client_tokens CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- UWAGA: public.project_portal_tokens NIE jest tutaj usuwana.
-- Tabela jest nadal aktywnie używana przez ProjectPortalCTA (canonical invite flow).
-- Usunięcie planowane w Phase 5, po refaktorze ProjectPortalCTA tak, by
-- bezpośrednio zarządzała project_client_access bez pośrednictwa tokenów URL.
-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;
