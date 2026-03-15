-- =============================================================================
-- Migration 045: Fix client session resolver — backfill auth_user_id + RPC
-- LoftDesk v6.0 bugfix
-- =============================================================================
-- Root cause: client_accounts.auth_user_id may be NULL when:
--   a) Old invites used admin.generateLink() before the sync trigger (migr. 042)
--      was applied to production — the trigger had no prior INSERT to act on.
--   b) An existing Supabase auth user already existed (from a previous invite),
--      so the AFTER INSERT trigger never fired for that row again.
--
-- Consequence: RLS policy "ca_client_select_own" evaluates
--   auth_user_id = auth.uid()  →  NULL = <uuid>  →  FALSE
-- The row is invisible to the browser-side resolver (resolveSupabaseSession).
-- The resolver then falls through to bootstrap_my_company and returns
-- role:'owner' instead of role:'client'.  The client sees LegalAcceptanceGate
-- and business-only queries fire → 400 errors.
--
-- Fix:
--   1. One-time backfill: link existing NULL auth_user_ids by matching email.
--   2. SECURITY DEFINER function resolve_my_client_account() that the frontend
--      resolver calls instead of a direct table query. The function bypasses RLS
--      and finds accounts even when auth_user_id IS NULL.
--
-- Idempotent: safe to run multiple times.
-- Must be applied MANUALLY via Supabase SQL Editor on production.
-- =============================================================================

-- ── 1. Backfill: link existing unlinked client_accounts to their auth users ──
-- Matches by email (case-insensitive). Skips rows where auth_user_id is already
-- set to avoid overwriting intentional links.

UPDATE public.client_accounts ca
SET    auth_user_id = au.id,
       updated_at   = now()
FROM   auth.users au
WHERE  lower(au.email) = lower(ca.email)
  AND  ca.auth_user_id IS NULL;

-- ── 2. SECURITY DEFINER resolver — used by frontend at session startup ────────
-- resolveSupabaseSession() (src/shared/lib/backend.ts) calls this RPC instead
-- of querying client_accounts directly. The SECURITY DEFINER attribute allows
-- the function to read client_accounts regardless of auth_user_id being NULL.
--
-- Returns at most one row. Checks two paths:
--   Fast path: auth_user_id = auth.uid()  (normal case after any invite)
--   Fallback:  join auth.users by email   (residual NULL rows post-backfill)

CREATE OR REPLACE FUNCTION public.resolve_my_client_account()
RETURNS TABLE(
  id         uuid,
  company_id uuid,
  email      text,
  full_name  text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Fast path: auth_user_id already set (most cases after client-identify patch)
  SELECT id, company_id, email, full_name
  FROM public.client_accounts
  WHERE auth_user_id = auth.uid()

  UNION ALL

  -- Fallback: auth_user_id IS NULL but email matches the logged-in user
  -- (handles rows that existed before both the 042 trigger and the 045 backfill)
  SELECT ca.id, ca.company_id, ca.email, ca.full_name
  FROM public.client_accounts ca
  JOIN auth.users au ON lower(au.email) = lower(ca.email)
  WHERE au.id = auth.uid()
    AND ca.auth_user_id IS NULL

  LIMIT 1
$$;
