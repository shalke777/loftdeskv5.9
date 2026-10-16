-- Supabase default privileges can grant explicit EXECUTE to anon/authenticated.
-- Revoking PUBLIC alone does not remove these independent role grants.
REVOKE ALL ON FUNCTION public.private_enqueue_job(UUID,TEXT,TEXT,JSONB),public.private_claim_job(UUID),public.private_execute_db_job(UUID,UUID),public.notify_private_automation(),public.reject_private_app_signup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.private_enqueue_job(UUID,TEXT,TEXT,JSONB),public.private_claim_job(UUID),public.private_execute_db_job(UUID,UUID) TO service_role;
