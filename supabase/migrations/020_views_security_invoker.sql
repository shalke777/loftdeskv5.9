-- Migration 020: Set security_invoker = true on all views
-- Without this, views run as owner (postgres) and bypass RLS on underlying tables

alter view user_stats              set (security_invoker = true);
alter view company_bootstrap_status set (security_invoker = true);
alter view company_health_view     set (security_invoker = true);
alter view release_workspace_summary set (security_invoker = true);
alter view workspace_health_overview set (security_invoker = true);
alter view v_release_company_health set (security_invoker = true);
