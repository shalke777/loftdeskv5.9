-- Migration 110: Add 'missing_costs' notification type
-- Used by the daily scheduled function (check-missing-costs) to notify
-- operators about active projects with no registered costs in the last 3 days.

ALTER TABLE public.operator_notifications
  DROP CONSTRAINT IF EXISTS operator_notifications_type_check;

ALTER TABLE public.operator_notifications
  ADD CONSTRAINT operator_notifications_type_check
  CHECK (type IN ('client_message', 'client_approval_response', 'missing_costs'));
