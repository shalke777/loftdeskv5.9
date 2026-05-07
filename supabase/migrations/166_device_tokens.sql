-- =============================================================================
-- Migration 166: device_tokens — push notification token registry
-- =============================================================================
-- Stores FCM (Android) / APNs (iOS) push tokens per Supabase user.
-- Used by edge functions to send targeted push notifications.
--
-- Token rotation: a single device may produce a new token (FCM refresh).
-- We upsert on `token` (unique) so the same device never has duplicate rows;
-- the user_id is updated if the device now belongs to a different account.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage only their own device tokens.
DROP POLICY IF EXISTS device_tokens_self_select ON public.device_tokens;
CREATE POLICY device_tokens_self_select ON public.device_tokens
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_self_insert ON public.device_tokens;
CREATE POLICY device_tokens_self_insert ON public.device_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_self_update ON public.device_tokens;
CREATE POLICY device_tokens_self_update ON public.device_tokens
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS device_tokens_self_delete ON public.device_tokens;
CREATE POLICY device_tokens_self_delete ON public.device_tokens
  FOR DELETE USING (user_id = auth.uid());

COMMIT;

NOTIFY pgrst, 'reload schema';
