-- Migration 129: allow operators to delete their own notifications
-- Fixes: notification delete silently fails (no RLS DELETE policy),
-- causing optimistic UI to rollback and notifications to "come back".

DROP POLICY IF EXISTS on_operator_delete ON public.operator_notifications;
CREATE POLICY on_operator_delete ON public.operator_notifications
  FOR DELETE
  USING (
    company_id = my_company_id()
    AND my_app_role() NOT IN ('client', 'anonymous')
  );
