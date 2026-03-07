create table if not exists public.client_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  user_id uuid references auth.users(id) on delete cascade,
  cost_estimate_id uuid references public.cost_estimates(id) on delete cascade,
  client_name text,
  token text unique not null,
  active boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_messages (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references public.client_tokens(id) on delete cascade,
  sender text not null check (sender in ('client','company')),
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
