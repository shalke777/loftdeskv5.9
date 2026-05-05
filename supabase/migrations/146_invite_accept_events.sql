-- =============================================================================
-- 146 — Invite accept events log (production debugging)
-- =============================================================================
-- Stores structured audit events for invitation acceptance flow.
-- Users INSERT their own events. No SELECT for regular users — debugging
-- is done via service_role in Supabase dashboard.
-- token_hash: first 16 hex chars of SHA-256(token) — enough to correlate
--             events without exposing the full token in DB.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invite_accept_events (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  token_hash   text        NOT NULL,
  event_type   text        NOT NULL CHECK (event_type IN (
                 'ACCEPT_START',
                 'ACCEPT_SUCCESS',
                 'ACCEPT_FAIL',
                 'MEMBERSHIP_VERIFIED',
                 'MEMBERSHIP_MISSING'
               )),
  error_reason text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.invite_accept_events ENABLE ROW LEVEL SECURITY;

-- Users can write their own audit events. Read access is service_role only.
CREATE POLICY invite_accept_events_insert
  ON public.invite_accept_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Index for per-user event lookup (debugging, admin view).
CREATE INDEX IF NOT EXISTS invite_accept_events_user_id_idx
  ON public.invite_accept_events (user_id, created_at DESC);
