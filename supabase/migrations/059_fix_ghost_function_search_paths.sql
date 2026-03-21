-- =============================================================================
-- Migration 059: Fix search_path on 2 ghost functions not in migration chain
--
-- Production advisor (2026-03-21) after running 058 shows exactly 2 remaining
-- "Function Search Path Mutable" findings:
--
--   public.handle_updated_at()     — trigger function, LANGUAGE plpgsql
--   public.check_plan_limit(uuid, text) — SECURITY DEFINER, LANGUAGE plpgsql
--
-- Both exist in production but were never created in any migration file.
-- They are NOT referenced by any application code (confirmed by codebase search).
-- handle_updated_at is a generic updated_at trigger similar to set_updated_at().
-- check_plan_limit is a legacy single-tenant plan check against public.profiles.
--
-- Fix: ALTER FUNCTION ... SET search_path = public
-- Wrapped in DO/EXCEPTION in case a future cleanup drops them.
-- =============================================================================

BEGIN;

-- Fix 1: handle_updated_at() — generic updated_at trigger
DO $$ BEGIN
  ALTER FUNCTION public.handle_updated_at()
    SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Fix 2: check_plan_limit(uuid, text) — legacy single-tenant plan check
DO $$ BEGIN
  ALTER FUNCTION public.check_plan_limit(uuid, text)
    SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

COMMIT;
