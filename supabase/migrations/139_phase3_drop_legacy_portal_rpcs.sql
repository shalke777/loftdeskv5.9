-- =============================================================================
-- Migration 139: Phase 3 — Drop legacy portal RPC functions + portal_messages
-- =============================================================================
-- Date: 2026-05-03
--
-- SCOPE CORRECTION vs original Phase 3 plan:
--
--   SAFE TO DROP (no callers anywhere in src/ or netlify/):
--     ✅ portal_get_by_token(text)      — migration 026; queries portal_messages
--     ✅ portal_send_message(text,text,text) — migration 026; inserts portal_messages
--     ✅ portal_decide(text,text)        — migration 026; inserts portal_messages
--     ✅ portal_messages table           — 0 rows, all 3 consumer functions dropped above
--
--   DO NOT TOUCH (live callers in src/):
--     🔒 delete_portal_message(uuid)    — migration 063; soft-deletes project_messages
--        Callers: client-portal.api.ts + threads.api.ts
--        NOTE: misleading name — operates on project_messages, NOT portal_messages
--     🔒 client_send_message(uuid,uuid,text,text) — migration 062; inserts project_messages
--        LIVE — client portal messaging backbone
--
--   NOT A REAL FUNCTION (never existed):
--     ✗  portal_get_conversation        — appeared only in migration 138 comment; does not exist
--
-- =============================================================================
-- VERIFICATION SQL (run BEFORE applying):
-- =============================================================================
/*
  -- 1. Confirm no live callers for functions being dropped
  SELECT proname, pronargs
  FROM pg_proc
  WHERE proname IN ('portal_get_by_token','portal_send_message','portal_decide')
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  -- Expected: 3 rows (just confirms they exist; runtime calls = unknown due to track_functions=none)

  -- 2. Confirm delete_portal_message exists and is NOT in this migration
  SELECT proname FROM pg_proc
  WHERE proname = 'delete_portal_message'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  -- Expected: 1 row (KEEP)

  -- 3. Confirm portal_messages row count
  SELECT count(*) FROM public.portal_messages;
  -- Expected: 0

  -- 4. No frontend calls portal_send_message or portal_get_by_token via RPC
  -- (verified by static grep: zero matches in src/ and netlify/)
*/
-- =============================================================================

BEGIN;

-- ─── STEP 1: Revoke grants before dropping ────────────────────────────────────

REVOKE ALL ON FUNCTION public.portal_get_by_token(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_send_message(text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_decide(text, text) FROM anon, authenticated;

-- ─── STEP 2: Drop legacy portal RPC functions ─────────────────────────────────

DROP FUNCTION IF EXISTS public.portal_get_by_token(text) CASCADE;
DROP FUNCTION IF EXISTS public.portal_send_message(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.portal_decide(text, text) CASCADE;

-- ─── STEP 3: Drop portal_messages table ──────────────────────────────────────
-- Safe: 0 rows confirmed, all 3 consumer RPCs dropped above, no live frontend callers.
-- CASCADE removes RLS policies and any remaining FKs.

DROP TABLE IF EXISTS public.portal_messages CASCADE;

-- ─── STEP 4: Annotate client_decisions for Phase 4 (separate migration) ──────
-- client_decisions has trigger trg_client_decision_to_memory (migration 114).
-- Keeping for now. Phase 4 scope: drop trigger fn, then table.
-- (IF EXISTS guard — table may not exist in all environments)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_decisions'
  ) THEN
    EXECUTE $q$
      COMMENT ON TABLE public.client_decisions IS
        'DEPRECATED_2026_AUDIT — Phase 4 target. '
        'Has trigger trg_client_decision_to_memory (migration 114). '
        'Drop trigger + fn_client_decision_to_memory first, then table.';
    $q$;
  END IF;
END;
$$;

COMMIT;

-- =============================================================================
-- ROLLBACK PLAN (if anything breaks after deploy):
-- =============================================================================
-- Restore from migration 026 — copy/paste the 3 CREATE OR REPLACE FUNCTION blocks:
--   portal_get_by_token(text)
--   portal_send_message(text, text, text)
--   portal_decide(text, text)
-- Then restore portal_messages:
--   CREATE TABLE public.portal_messages (
--     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--     token_id   uuid REFERENCES public.client_tokens(id) ON DELETE CASCADE,
--     sender     text NOT NULL CHECK (sender IN ('client','company')),
--     content    text NOT NULL,
--     read       boolean NOT NULL DEFAULT false,
--     created_at timestamptz NOT NULL DEFAULT now()
--   );
-- NOTE: data is gone (was 0 rows) — structural restore only
-- =============================================================================
