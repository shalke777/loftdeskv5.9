-- Fix: migration 001 creates companies WITHOUT owner_user_id,
-- migration 005 uses CREATE TABLE IF NOT EXISTS (no-op since table exists),
-- so owner_user_id was never added. Migration 006's bootstrap_my_company()
-- tries INSERT INTO companies(owner_user_id,...) → error 42703.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill: set owner_user_id from existing company_members with role='owner'
UPDATE public.companies c
SET owner_user_id = cm.user_id
FROM public.company_members cm
WHERE cm.company_id = c.id
  AND cm.role = 'owner'
  AND c.owner_user_id IS NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_companies_owner_user_id
  ON public.companies(owner_user_id);

-- Recreate bootstrap_my_company() so it's consistent with the schema
CREATE OR REPLACE FUNCTION public.bootstrap_my_company(company_name text DEFAULT NULL, company_nip text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_profile record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.company_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.companies (owner_user_id, name, nip, plan)
  VALUES (
    v_user_id,
    coalesce(nullif(company_name, ''), nullif(v_profile.company, ''), nullif(v_profile.full_name, ''), 'LoftDesk Workspace'),
    coalesce(nullif(company_nip, ''), nullif(v_profile.nip, '')),
    coalesce(v_profile.plan, 'free')
  )
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (v_company_id, v_user_id, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  UPDATE public.clients SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;
  UPDATE public.projects SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;
  UPDATE public.cost_estimates SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;
  UPDATE public.invoices SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;
  UPDATE public.contracts SET company_id = v_company_id WHERE user_id = v_user_id AND company_id IS NULL;

  RETURN v_company_id;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
