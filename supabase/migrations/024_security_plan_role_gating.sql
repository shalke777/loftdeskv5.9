-- =============================================================================
-- Migration 024: Security — block self-promotion to admin plan / role
-- =============================================================================
-- Problems solved:
-- 1. Any authenticated user could UPDATE companies.plan to 'admin' via API → full access
-- 2. Any company member could UPDATE company_members.role to 'owner' → privilege escalation
-- 3. No restriction on who within a company can change the plan
-- =============================================================================

BEGIN;

-- ─── 1. Trigger: block setting plan='admin' via non-superuser ───────────────
-- Only a Postgres superuser (direct SQL) can assign admin plan.
-- The API (authenticated role) cannot bypass this.
CREATE OR REPLACE FUNCTION prevent_admin_plan_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.plan = 'admin' AND (OLD.plan IS DISTINCT FROM 'admin') THEN
    -- Allow only if called by postgres superuser (e.g. migrations, SQL Editor)
    -- current_setting('role') in API context = 'authenticated', in SQL Editor = '' or 'postgres'
    IF current_setting('request.jwt.claims', true) IS NOT NULL
       AND current_setting('request.jwt.claims', true) != '' THEN
      RAISE EXCEPTION 'Plan admin can only be assigned by system administrator'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_plan ON companies;
CREATE TRIGGER trg_prevent_admin_plan
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION prevent_admin_plan_escalation();

-- ─── 2. Trigger: block role escalation in company_members ───────────────────
-- Only an owner of the SAME company can promote someone.
-- Nobody can promote themselves to owner via API.
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Skip if role didn't change
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  -- Allow superuser / migration context
  IF current_setting('request.jwt.claims', true) IS NULL
     OR current_setting('request.jwt.claims', true) = '' THEN
    RETURN NEW;
  END IF;

  -- Get caller's role in the same company
  SELECT role INTO caller_role
  FROM company_members
  WHERE company_id = NEW.company_id
    AND user_id = auth.uid();

  -- Only owner can change roles
  IF caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only company owner can change member roles'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Nobody can promote someone (including themselves) to owner via API
  IF NEW.role = 'owner' THEN
    RAISE EXCEPTION 'Owner role can only be assigned by system administrator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON company_members;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON company_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();

-- ─── 3. Companies UPDATE policy: only owner can update company settings ─────
-- Drop any old permissive UPDATE policies first
DO $$
DECLARE _pol record;
BEGIN
  FOR _pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'companies' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON companies', _pol.policyname);
  END LOOP;
END $$;

CREATE POLICY companies_update_owner_only ON companies
  FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

COMMIT;
