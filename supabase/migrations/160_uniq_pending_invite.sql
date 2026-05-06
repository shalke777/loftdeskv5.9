-- =============================================================================
-- Migration 160: One pending invite per (email, company)
-- =============================================================================
-- Prevents duplicate `pending` rows in company_invitations for the same
-- (lower(email), company_id) tuple. Historical rows with status in
-- ('accepted','expired','revoked') are unaffected — multi-history per
-- email/company stays intact for audit.
--
-- Why partial + lower(email):
--   • emails are case-insensitive in practice (auth.users normalises)
--   • only 'pending' rows are operationally exclusive; accepted/revoked
--     are immutable history and may legitimately repeat
--
-- Effect on UX:
--   • re-inviting the same email while a pending invite exists fails fast
--     at the DB level instead of silently producing a duplicate row + email
--   • call sites should treat unique_violation (23505) on this index as
--     "already invited" and surface a friendly message
--
-- Idempotent: IF NOT EXISTS guard. Safe to re-run.
-- =============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_invite
  ON public.company_invitations (lower(email), company_id)
  WHERE status = 'pending';

COMMIT;

NOTIFY pgrst, 'reload schema';
