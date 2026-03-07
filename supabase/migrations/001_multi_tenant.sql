create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nip text,
  plan text not null default 'free' check (plan in ('free','pro','business','admin')),
  created_at timestamptz not null default now()
);

create table if not exists company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'worker' check (role in ('owner','admin','manager','worker','accountant')),
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);

alter table if exists clients add column if not exists company_id uuid;
alter table if exists cost_estimates add column if not exists company_id uuid;
alter table if exists invoices add column if not exists company_id uuid;
alter table if exists contracts add column if not exists company_id uuid;
alter table if exists projects add column if not exists company_id uuid;

create or replace function my_company_id()
returns uuid language sql stable as $$
  select company_id from company_members where user_id = auth.uid() limit 1
$$;

create or replace function my_role()
returns text language sql stable as $$
  select role from company_members where user_id = auth.uid() limit 1
$$;
