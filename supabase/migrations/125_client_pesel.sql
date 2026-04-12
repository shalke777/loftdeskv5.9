-- ── clients: pesel ──────────────────────────────────────────────────────────
-- Adds PESEL field for individual clients (natural persons).
-- Nullable: only applies to private individuals, not companies.
alter table clients add column if not exists pesel text;
