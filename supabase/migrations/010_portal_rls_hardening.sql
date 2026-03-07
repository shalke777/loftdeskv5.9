-- 010_portal_rls_hardening.sql
alter table if exists client_tokens enable row level security;
alter table if exists portal_messages enable row level security;

drop policy if exists client_tokens_select_company on client_tokens;
create policy client_tokens_select_company on client_tokens
  for select using (company_id = my_company_id());

drop policy if exists client_tokens_insert_company on client_tokens;
create policy client_tokens_insert_company on client_tokens
  for insert with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

drop policy if exists client_tokens_update_company on client_tokens;
create policy client_tokens_update_company on client_tokens
  for update using (company_id = my_company_id())
  with check (company_id = my_company_id() and my_role() in ('owner','admin','manager'));

drop policy if exists portal_messages_select_company on portal_messages;
create policy portal_messages_select_company on portal_messages
  for select using (
    exists (
      select 1 from client_tokens t
      where t.id = portal_messages.token_id
        and t.company_id = my_company_id()
    )
  );
