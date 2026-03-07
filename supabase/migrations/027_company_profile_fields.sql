-- =============================================================================
-- Migration 027: Company / contractor profile fields
-- Adds NIP, address, city, postal_code, IBAN to both companies (multi-tenant)
-- and profiles (single-tenant) so documents auto-fill contractor details.
-- Also fixes companies table missing ksef_env / ksef_nip / ksef_token columns.
-- =============================================================================

BEGIN;

-- ─── companies (multi-tenant mode) ───────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS ksef_env    text DEFAULT 'test' CHECK (ksef_env IN ('test','prod')),
  ADD COLUMN IF NOT EXISTS ksef_nip    text,
  ADD COLUMN IF NOT EXISTS ksef_token  text,
  ADD COLUMN IF NOT EXISTS address     text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city        text,
  ADD COLUMN IF NOT EXISTS iban        text,
  ADD COLUMN IF NOT EXISTS phone       text,
  ADD COLUMN IF NOT EXISTS email       text,
  ADD COLUMN IF NOT EXISTS website     text;

-- ─── profiles (single-tenant / legacy mode) ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nip         text,
  ADD COLUMN IF NOT EXISTS address     text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city        text,
  ADD COLUMN IF NOT EXISTS iban        text,
  ADD COLUMN IF NOT EXISTS phone       text,
  ADD COLUMN IF NOT EXISTS website     text;

COMMIT;
