-- 010_portal_rls_hardening.sql
alter table if exists client_portal_tokens enable row level security;
alter table if exists portal_messages enable row level security;

create policy if not exists client_portal_tokens_select_company on client_portal_tokens
  for select using (company_id = my_company_id());

create policy if not exists client_portal_tokens_insert_company on client_portal_tokens
  for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

create policy if not exists client_portal_tokens_update_company on client_portal_tokens
  for update using (company_id = my_company_id())
  with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

create policy if not exists portal_messages_select_company on portal_messages
  for select using (
    exists (
      select 1 from client_portal_tokens t
      where t.id = portal_messages.token_id
        and t.company_id = my_company_id()
    )
  );
