-- Only for a foundation installation that has NEVER been activated.
-- Leaves new tables/data intact; restores the old application's access behavior.
-- Not an incident-response rollback after granting ChatGPT access.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.private_app_settings s WHERE enabled OR COALESCE((to_jsonb(s)->>'mcp_enabled')::boolean,false))
    OR EXISTS(SELECT 1 FROM public.private_mcp_clients WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.automation_jobs)
    OR EXISTS(SELECT 1 FROM public.operator_notifications WHERE type='automation') THEN
  RAISE EXCEPTION 'Foundation was activated or used; revoke OAuth grants and review rollback manually';
 END IF;
END $$;
DROP TRIGGER IF EXISTS reject_private_app_signup ON auth.users;
DROP TRIGGER IF EXISTS notify_private_automation ON public.automation_jobs;
DO $$
DECLARE target RECORD;
BEGIN
 FOR target IN SELECT schemaname,tablename FROM pg_policies
  WHERE schemaname='public' AND policyname='private_owner_gate'
 LOOP
  EXECUTE format('DROP POLICY private_owner_gate ON %I.%I',target.schemaname,target.tablename);
 END LOOP;
END $$;
ALTER TABLE public.operator_notifications DROP CONSTRAINT operator_notifications_type_check;
ALTER TABLE public.operator_notifications ADD CONSTRAINT operator_notifications_type_check
 CHECK(type IN ('client_message','client_approval_response','missing_costs','payment_reminder'));
COMMIT;
