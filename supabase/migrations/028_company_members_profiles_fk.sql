-- Add foreign key from company_members.user_id → profiles.id
-- This allows PostgREST to resolve the join:
--   company_members → profiles (via user_id)
-- Without this FK, queries using !inner or FK hints on profiles fail with PGRST200.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'company_members_user_id_profiles_fkey'
      AND table_name = 'company_members'
  ) THEN
    ALTER TABLE public.company_members
      ADD CONSTRAINT company_members_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
