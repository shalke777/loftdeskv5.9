
-- v5.1 invitation / storage hardening placeholders

alter table if exists public.company_invitations
  alter column email set not null;

create index if not exists company_invitations_company_status_idx
  on public.company_invitations(company_id, status);
