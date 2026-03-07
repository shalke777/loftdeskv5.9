create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','admin','manager','worker','accountant')),
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

alter table if exists public.company_invitations enable row level security;

drop policy if exists "company_invitations_select" on public.company_invitations;
create policy "company_invitations_select" on public.company_invitations
for select using (company_id = my_company_id());

drop policy if exists "company_invitations_insert" on public.company_invitations;
create policy "company_invitations_insert" on public.company_invitations
for insert with check (company_id = my_company_id() and my_role() in ('owner','admin'));

drop policy if exists "company_invitations_update" on public.company_invitations;
create policy "company_invitations_update" on public.company_invitations
for update using (company_id = my_company_id())
with check (company_id = my_company_id() and my_role() in ('owner','admin'));

-- Example bucket policy notes for storage.objects (apply manually if needed):
-- create policy "company files read" on storage.objects for select using (bucket_id = 'company-files' and (storage.foldername(name))[1] = my_company_id()::text);
-- create policy "company files write" on storage.objects for insert with check (bucket_id = 'company-files' and (storage.foldername(name))[1] = my_company_id()::text and my_role() in ('owner','admin','manager'));
