-- Example migration path from v3 user_id isolation to v4 company_id isolation.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  nip text,
  plan text not null default 'free' check (plan in ('free','pro','business','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','manager','worker','accountant')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

-- Backfill sketch:
-- 1) create a company per existing profile/user
-- 2) copy plan/company/nip from profiles
-- 3) add company_id to domain tables
-- 4) populate company_id using user_id -> company_members
