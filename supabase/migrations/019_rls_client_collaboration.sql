-- Migration 019: Enable RLS on v5.8 client collaboration tables (017)
-- These tables were created without RLS — security gap

-- ─── client_decisions ───
alter table client_decisions enable row level security;

create policy cd_select on client_decisions for select
  using (company_id = public.my_company_id());
create policy cd_insert on client_decisions for insert
  with check (company_id = public.my_company_id());
create policy cd_update on client_decisions for update
  using (company_id = public.my_company_id());
create policy cd_delete on client_decisions for delete
  using (company_id = public.my_company_id());

-- ─── handover_protocols ───
alter table handover_protocols enable row level security;

create policy hp_select on handover_protocols for select
  using (company_id = public.my_company_id());
create policy hp_insert on handover_protocols for insert
  with check (company_id = public.my_company_id());
create policy hp_update on handover_protocols for update
  using (company_id = public.my_company_id());
create policy hp_delete on handover_protocols for delete
  using (company_id = public.my_company_id());

-- ─── project_photo_docs ───
alter table project_photo_docs enable row level security;

create policy ppd_select on project_photo_docs for select
  using (company_id = public.my_company_id());
create policy ppd_insert on project_photo_docs for insert
  with check (company_id = public.my_company_id());
create policy ppd_update on project_photo_docs for update
  using (company_id = public.my_company_id());
create policy ppd_delete on project_photo_docs for delete
  using (company_id = public.my_company_id());

-- ─── technical_standards ───
alter table technical_standards enable row level security;

create policy ts_select on technical_standards for select
  using (company_id = public.my_company_id());
create policy ts_insert on technical_standards for insert
  with check (company_id = public.my_company_id());
create policy ts_update on technical_standards for update
  using (company_id = public.my_company_id());
create policy ts_delete on technical_standards for delete
  using (company_id = public.my_company_id());
