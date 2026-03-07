-- 015_production_audit_and_indexes.sql
-- Final hardening pack for LoftDesk v5.2

create index if not exists idx_company_members_company_user on company_members(company_id, user_id);
create index if not exists idx_company_invitations_company_email on company_invitations(company_id, email);
create index if not exists idx_audit_logs_company_created_at on audit_logs(company_id, created_at desc);

comment on table audit_logs is 'LoftDesk v5.2 final production audit log table';
