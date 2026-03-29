-- Migration 020: Set security_invoker = true on all views
-- Without this, views run as owner (postgres) and bypass RLS on underlying tables
-- Each ALTER VIEW is guarded: views may not exist on fresh bootstrap.

DO $$
DECLARE v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'user_stats',
    'company_bootstrap_status',
    'company_health_view',
    'release_workspace_summary',
    'workspace_health_overview',
    'v_release_company_health'
  ]
  LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE FORMAT('ALTER VIEW public.%I SET (security_invoker = true)', v);
    END IF;
  END LOOP;
END
$$;
