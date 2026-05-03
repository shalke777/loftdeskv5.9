-- =============================================================================
-- Migration 138: Phase 2 Ghost Table Cleanup
-- =============================================================================
-- Audit date: 2026-05-03
-- Author: DB audit Phase 2
--
-- CLASSIFICATION RESULTS:
--
-- SAFE_TO_DROP (no code, no RPC functions, no triggers, only CASCADE from projects):
--   ✅ handover_protocols      — feature never built, 0 queries, 0 functions
--   ✅ technical_standards     — feature never built, 0 queries, 0 functions
--   ✅ company_memory_feedback — AI feedback scaffold, never wired to UI, 0 queries
--
-- KEEP — active RPC dependency:
--   🔒 project_portal_sessions — used by delete_project_hard() RPC (migration 060)
--   🔒 conversations           — used by delete_project_hard() step 10 + user constraint
--   🔒 invoice_counters        — user constraint (superseded by doc_counters but kept)
--   🔒 assignment_queue        — unknown trigger consumers, user constraint
--   🔒 export_jobs             — user constraint
--
-- INVESTIGATE (requires function drop first, separate migration):
--   ⚠️  portal_messages        — legacy portal_send_message() RPC still references it
--                                 (migration 026/063). Cannot drop until legacy RPCs dropped.
--   ⚠️  client_decisions       — has trigger trg_client_decision_to_memory (migration 114)
--                                 Wired to project_memory_entries. Needs explicit decision.
--
-- NOT APPLICABLE (already dropped or never exists):
--   ℹ️  project_portal_tokens  — dropped by migration 051
--   ℹ️  client_portal_tokens   — migration 050 missing; verify with SELECT to confirm
--
-- VERIFICATION SQL (run BEFORE applying this migration):
-- =============================================================================
/*
  -- Step 0: Verify tables are empty before dropping
  SELECT 'handover_protocols'      AS t, count(*) FROM public.handover_protocols
  UNION ALL
  SELECT 'technical_standards',       count(*) FROM public.technical_standards
  UNION ALL
  SELECT 'company_memory_feedback',   count(*) FROM public.company_memory_feedback
  UNION ALL
  -- INVESTIGATE candidates (not dropped here):
  SELECT 'portal_messages',           count(*) FROM public.portal_messages
  UNION ALL
  SELECT 'client_decisions',          count(*) FROM public.client_decisions
  UNION ALL
  -- KEEP candidates (confirm constraint):
  SELECT 'project_portal_sessions',   count(*) FROM public.project_portal_sessions
  UNION ALL
  SELECT 'conversations',             count(*) FROM public.conversations
  ORDER BY t;

  -- Step 0b: Verify no live functions reference SAFE_TO_DROP tables
  SELECT proname, prosrc
  FROM pg_proc
  WHERE prosrc ILIKE '%handover_protocols%'
     OR prosrc ILIKE '%technical_standards%'
     OR prosrc ILIKE '%company_memory_feedback%';
  -- Expected: 0 rows

  -- Step 0c: Verify no triggers on SAFE_TO_DROP tables
  SELECT tgname, tgrelid::regclass
  FROM pg_trigger
  WHERE tgrelid::regclass::text IN (
    'handover_protocols', 'technical_standards', 'company_memory_feedback'
  );
  -- Expected: 0 rows
*/
-- =============================================================================

BEGIN;

-- ─── STEP 1: Soft deprecation comments (non-destructive, applied first) ──────
-- Wrapped in DO blocks: safe even if table doesn't exist in production

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='handover_protocols') THEN
    EXECUTE $q$COMMENT ON TABLE public.handover_protocols IS
      'DEPRECATED_2026_AUDIT — feature never shipped, zero code consumers, safe to drop'$q$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='technical_standards') THEN
    EXECUTE $q$COMMENT ON TABLE public.technical_standards IS
      'DEPRECATED_2026_AUDIT — feature never shipped, zero code consumers, safe to drop'$q$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='company_memory_feedback') THEN
    EXECUTE $q$COMMENT ON TABLE public.company_memory_feedback IS
      'DEPRECATED_2026_AUDIT — AI feedback scaffold, never wired to UI, zero code consumers'$q$;
  END IF;
END;
$$;

-- ─── STEP 2: DROP SAFE tables ──────────────────────────────────────────────────
--
-- All three have:
--   - Zero .from() calls in src/ or netlify/
--   - Zero RPC/stored-procedure references (verified via pg_proc scan)
--   - Zero trigger definitions on the table itself
--   - Only dependency: ON DELETE CASCADE FK from projects (auto-resolved on DROP)
--   - CASCADE here removes associated RLS policies, indexes, and FKs cleanly
--

DROP TABLE IF EXISTS public.handover_protocols CASCADE;
DROP TABLE IF EXISTS public.technical_standards CASCADE;
DROP TABLE IF EXISTS public.company_memory_feedback CASCADE;

-- ─── STEP 3: Annotate INVESTIGATE candidates (not dropped, requires separate work) ──

-- portal_messages: cannot drop until legacy RPCs are removed.
-- To clean in a future migration:
--   DROP FUNCTION IF EXISTS public.portal_send_message(text, text, text);
--   DROP FUNCTION IF EXISTS public.delete_portal_message(uuid, text);
--   DROP FUNCTION IF EXISTS public.portal_get_conversation(text);  -- migration 026
--   Then: DROP TABLE IF EXISTS public.portal_messages CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portal_messages'
  ) THEN
    EXECUTE $q$
      COMMENT ON TABLE public.portal_messages IS
        'DEPRECATED_2026_AUDIT — replaced by project_messages/project_threads. '
        'Legacy RPCs (portal_send_message, delete_portal_message) still reference. '
        'Drop in migration 139 after dropping legacy RPC functions.';
    $q$;
  END IF;
END;
$$;

-- client_decisions: has trigger trg_client_decision_to_memory (migration 114).
-- Low-risk if empty but requires trigger drop first. Annotate only.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_decisions'
  ) THEN
    EXECUTE $q$
      COMMENT ON TABLE public.client_decisions IS
        'DEPRECATED_2026_AUDIT — feature never shipped. '
        'Has trigger trg_client_decision_to_memory (migration 114). '
        'Drop trigger fn_client_decision_to_memory first, then table.';
    $q$;
  END IF;
END;
$$;

COMMIT;
