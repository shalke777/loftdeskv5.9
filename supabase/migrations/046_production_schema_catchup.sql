-- =============================================================================
-- Migration 046: Production schema catch-up
-- LoftDesk v6.0 — apply in Supabase SQL Editor when 036 and/or 045 are missing
-- =============================================================================
-- Idempotent. Safe to run multiple times, even if 036 / 045 were already applied.
--
-- Fixes two PGRST errors seen in production:
--   PGRST202  Could not find function public.resolve_my_client_account
--             → 045 was not applied; fixed below in section 2
--   42703     column companies.subscription_status does not exist
--             → 036 was not applied; fixed below in section 1
-- =============================================================================

-- ── 1. Billing subscription columns (from migration 036) ─────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id               text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id           text,
  ADD COLUMN IF NOT EXISTS subscription_status              text NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN (
      'none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'
    )),
  ADD COLUMN IF NOT EXISTS subscription_current_period_end  timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at                    timestamptz,
  ADD COLUMN IF NOT EXISTS billing_email                    text,
  ADD COLUMN IF NOT EXISTS plan_source                      text NOT NULL DEFAULT 'manual'
    CHECK (plan_source IN ('manual', 'stripe', 'admin'));

CREATE INDEX IF NOT EXISTS companies_stripe_customer_id_idx
  ON public.companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._start_company_trial()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subscription_status = 'none' AND NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at       := now() + INTERVAL '14 days';
    NEW.subscription_status := 'trialing';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_start_trial ON public.companies;
CREATE TRIGGER trg_company_start_trial
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public._start_company_trial();

-- Backfill existing free-plan companies (no-op if already done by 036)
UPDATE public.companies
SET
  subscription_status = 'trialing',
  trial_ends_at       = created_at + INTERVAL '14 days'
WHERE
  subscription_status = 'none'
  AND plan            = 'free'
  AND stripe_customer_id IS NULL;

-- ── 2. Client session resolver function (from migration 045) ────────────────

UPDATE public.client_accounts ca
SET    auth_user_id = au.id,
       updated_at   = now()
FROM   auth.users au
WHERE  lower(au.email) = lower(ca.email)
  AND  ca.auth_user_id IS NULL;

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
  SELECT id, company_id, email, full_name
  FROM public.client_accounts
  WHERE auth_user_id = auth.uid()

  UNION ALL

  SELECT ca.id, ca.company_id, ca.email, ca.full_name
  FROM public.client_accounts ca
  JOIN auth.users au ON lower(au.email) = lower(ca.email)
  WHERE au.id = auth.uid()
    AND ca.auth_user_id IS NULL

  LIMIT 1
$$;

-- ── 3. Notify PostgREST to reload schema cache ────────────────────────────────
-- Run this AFTER the statements above to clear PGRST202 immediately.
NOTIFY pgrst, 'reload schema';
