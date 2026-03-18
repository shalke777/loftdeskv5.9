-- =============================================================================
-- 052_backfill_client_auth_user_id.sql
--
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
