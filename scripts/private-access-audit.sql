-- Run with an administrator's psql session or the Supabase SQL editor.
-- Read-only inventory, not a privacy certification. No tokens, user data or
-- function bodies are returned. Keep the result within the project team.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';

-- Existing exposed tables without RLS or the private-owner restrictive gate.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid
               AND p.polname='private_owner_gate' AND NOT p.polpermissive) AS owner_gate
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
  AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
       OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))
ORDER BY c.relrowsecurity, c.relname;

-- SECURITY DEFINER RPCs can bypass table policies. Review every exposed entry,
-- including inherited PUBLIC privileges; owner policies alone do not guard it.
SELECT p.oid::regprocedure::text AS function_signature,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       p.proconfig AS function_settings
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND (has_function_privilege('anon',p.oid,'EXECUTE')
       OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
ORDER BY function_signature;

-- Public buckets bypass object SELECT policies for download URLs.
SELECT id AS bucket_id, public AS public_downloads FROM storage.buckets ORDER BY id;
SELECT policyname, permissive, roles, cmd
FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
ORDER BY policyname;

-- REST-exposed views may run with their owner's privileges.
SELECT c.relname AS view_name, c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='v'
  AND (has_table_privilege('anon',c.oid,'SELECT')
       OR has_table_privilege('authenticated',c.oid,'SELECT'))
ORDER BY c.relname;
ROLLBACK;
