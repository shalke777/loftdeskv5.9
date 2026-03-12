-- =============================================================================
-- Migration 036: Billing / Stripe subscription state
--
-- Adds Stripe billing columns to the companies table.
-- All columns are nullable or have safe defaults — zero breaking risk.
-- =============================================================================

BEGIN;

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

-- Lookup index used by the Stripe webhook to resolve customer → company
CREATE INDEX IF NOT EXISTS companies_stripe_customer_id_idx
  ON public.companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- =============================================================================
-- Trigger: auto-start a 14-day trial for every newly created company
-- Idempotent — only applies when subscription_status is still 'none'.
-- Can be overridden at any time by the Stripe webhook or an admin.
-- =============================================================================
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

-- =============================================================================
-- Backfill: existing free-plan companies get a trial pointing to the past
-- so they see the "expired trial / upgrade" UX rather than a blank status.
-- Companies already on a paid plan or with a Stripe customer are left alone.
-- =============================================================================
UPDATE public.companies
SET
  subscription_status = 'trialing',
  trial_ends_at       = created_at + INTERVAL '14 days'
WHERE
  subscription_status = 'none'
  AND plan            = 'free'
  AND stripe_customer_id IS NULL;

COMMENT ON COLUMN public.companies.subscription_status IS
  'none=no history | trialing=14d trial | active=paid | past_due=payment failed | canceled=ended | unpaid=charged off';
COMMENT ON COLUMN public.companies.plan_source IS
  'manual=app/admin set | stripe=synced from webhook | admin=sysop override';

COMMIT;
