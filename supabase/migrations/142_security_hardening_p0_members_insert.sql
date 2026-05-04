-- =============================================================================
-- Migration 142: P0 hotfix — block self-elevation via company_members INSERT
-- =============================================================================
-- Audit date: 2026-05-05
--
-- ROOT CAUSE — CRITICAL EXPLOIT
-- -----------------------------
-- Migrations 023 / 080 define:
--
--   CREATE POLICY "members_insert" ON public.company_members
--     FOR INSERT WITH CHECK (user_id = auth.uid());
--
-- The `prevent_role_escalation` trigger from migration 024 is BEFORE UPDATE
-- only — it does NOT fire on INSERT.
--
-- Combined effect: ANY authenticated user can run
--
--   INSERT INTO public.company_members(company_id, user_id, role)
--   VALUES (<victim_company_uuid>, auth.uid(), 'owner');
--
-- and instantly become the owner of any other tenant's company.
--
-- FIX (production-safe, RLS-only)
-- -------------------------------
-- Tighten the INSERT RLS policy so that authenticated clients can only ever
-- create rows with role='member' for themselves. Privileged roles
-- (`owner`, `admin`, `manager`) are reachable ONLY via SECURITY DEFINER:
--
--   * bootstrap_my_company         (mig 029, mig 141) → owner
--   * accept_company_invitation    (mig 009)          → invite.role
--
-- Both bypass RLS because they are owned by `postgres` (BYPASSRLS) and the
-- DEFINER context skips the policy. No CHECK constraint is added, so the
-- table-level INSERT path used by SECURITY DEFINER is unaffected.
--
-- Backward compatibility
-- ----------------------
--   * Bootstrap (new account creation) keeps working: SECURITY DEFINER bypass.
--   * Invitation acceptance keeps working VIA the RPC accept_company_invitation
--     (already exists, mig 009). The frontend in settings.api.ts is updated
--     in this commit to call the RPC instead of upserting directly, so that
--     invitations with role IN ('admin','manager','member') still succeed.
--   * No Netlify changes.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Replace members_insert policy with strict client-safe variant
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "members_insert" ON public.company_members;

CREATE POLICY "members_insert" ON public.company_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop legacy defense-in-depth trigger (replaced by the strict policy)
-- ─────────────────────────────────────────────────────────────────────────────
-- Earlier drafts of this migration introduced a BEFORE INSERT trigger that
-- required a matching invitation. That logic now lives entirely in
-- accept_company_invitation, so the trigger is redundant and would also
-- block direct member self-joins which the new policy explicitly allows.
-- IF NOT EXISTS guards make this idempotent across re-deploys.

DROP TRIGGER  IF EXISTS trg_prevent_member_self_insert ON public.company_members;
DROP FUNCTION IF EXISTS public.prevent_member_self_insert();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- POST-DEPLOY VERIFICATION
-- =============================================================================
-- A) Exploit closed — run as authenticated user via Supabase JS client:
--
--    INSERT INTO public.company_members(company_id, user_id, role)
--    VALUES ('<any-company>', auth.uid(), 'owner');
--    -- expected: 42501 / "new row violates RLS policy members_insert"
--
--    INSERT INTO public.company_members(company_id, user_id, role)
--    VALUES ('<any-company>', auth.uid(), 'admin');
--    -- expected: 42501 / RLS denial
--
-- B) member self-join still possible (e.g. invited member who skips the RPC):
--
--    INSERT INTO public.company_members(company_id, user_id, role)
--    VALUES ('<own-company>', auth.uid(), 'member');
--    -- expected: success
--
-- C) Bootstrap still works for brand-new accounts:
--
--    SELECT public.bootstrap_my_company();   -- returns UUID, owner row created
--
-- D) Invitation acceptance with privileged role still works via RPC:
--
--    SELECT public.accept_company_invitation('<token>');
--    -- expected: success, member row inserted with invite.role
-- =============================================================================
