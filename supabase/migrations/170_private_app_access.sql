-- Provision the existing owner's UUID/company before enabling private mode.
CREATE TABLE IF NOT EXISTS public.private_app_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  owner_user_id UUID REFERENCES auth.users(id),
  company_id UUID REFERENCES public.companies(id),
  CHECK (NOT enabled OR (owner_user_id IS NOT NULL AND company_id IS NOT NULL))
);
INSERT INTO public.private_app_settings(singleton) VALUES (TRUE) ON CONFLICT DO NOTHING;
ALTER TABLE public.private_app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_app_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.private_app_access_allowed() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT NOT enabled OR auth.uid() = owner_user_id
  FROM public.private_app_settings WHERE singleton = TRUE
$$;
REVOKE ALL ON FUNCTION public.private_app_access_allowed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_app_access_allowed() TO anon, authenticated;

-- Add a restrictive gate alongside existing tenant policies, preserving their scope.
DO $$
DECLARE target RECORD;
BEGIN
  FOR target IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename <> 'private_app_settings'
    AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=tablename AND c.relrowsecurity)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS private_owner_gate ON public.%I', target.tablename);
    EXECUTE format('CREATE POLICY private_owner_gate ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (public.private_app_access_allowed()) WITH CHECK (public.private_app_access_allowed())', target.tablename);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.reject_private_app_signup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.private_app_settings WHERE singleton AND enabled) THEN
    RAISE EXCEPTION 'Private application: registration is disabled';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reject_private_app_signup ON auth.users;
CREATE TRIGGER reject_private_app_signup BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.reject_private_app_signup();

GRANT ALL ON public.private_app_settings TO service_role;
