create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
