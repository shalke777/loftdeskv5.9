-- Add configurable penalty fields to contracts table
alter table contracts
  add column if not exists penalty_per_day_pct numeric(5,2),
  add column if not exists max_penalty_pct numeric(5,2);
