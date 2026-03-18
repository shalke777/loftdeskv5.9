-- =============================================================================
-- 052_backfill_client_auth_user_id.sql
--
-- ARCHIVED — DO NOT APPLY ON FRESH DEPLOYMENT.
--
-- This migration was written to backfill auth_user_id on legacy client_accounts
-- rows that existed before migration 042 introduced the trigger-based linking.
-- The database is empty at initial deployment (no historical data). This
-- migration is a no-op on a fresh schema and is retained only for reference.
--
-- To confirm this is safe to skip on your instance:
--   SELECT count(*) FROM client_accounts WHERE auth_user_id IS NULL;
-- Expected result: 0 (no rows exist, or all rows already have auth_user_id set
-- because client-identify.ts now always writes auth_user_id via generateLink).
--
-- Original purpose (kept for historical context):
-- Backfill auth_user_id on client_accounts rows that were created before
-- the client authenticated (invite was sent but OTP not yet used), or where
-- the link was set after auth but a race condition left auth_user_id NULL.
--
-- SAFE TO APPLY: only updates rows WHERE auth_user_id IS NULL AND a matching
-- auth.users row already exists (by email, case-insensitive).
--
-- Diagnostic (run in Supabase Studio first):
--   SELECT count(*) FROM client_accounts WHERE auth_user_id IS NULL;
--   SELECT ca.email FROM client_accounts ca
--     LEFT JOIN auth.users u ON lower(u.email) = lower(ca.email)
--     WHERE ca.auth_user_id IS NULL AND u.id IS NOT NULL;
-- =============================================================================

BEGIN;

UPDATE client_accounts ca
SET
  auth_user_id = u.id,
  updated_at   = now()
FROM auth.users u
WHERE ca.auth_user_id IS NULL
  AND lower(u.email) = lower(ca.email);

-- Verify: should return 0 after migration succeeds for all linkable rows
-- SELECT count(*) FROM client_accounts ca
--   LEFT JOIN auth.users u ON lower(u.email) = lower(ca.email)
--   WHERE ca.auth_user_id IS NULL AND u.id IS NOT NULL;

COMMIT;
