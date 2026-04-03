-- =============================================================================
-- Migration 099: Persistent AI rate limiting
-- =============================================================================
-- Replaces in-memory per-instance rate limit Maps with a shared DB table.
-- Each row tracks request count per user+endpoint within a sliding window.
--
-- Atomic check-and-increment via RPC function — no race conditions.
-- Old entries auto-expire (query filters by window_start).
-- =============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid NOT NULL,
  endpoint      text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS ai_rate_limits_window_idx
  ON public.ai_rate_limits(window_start);

-- No RLS needed — only accessed via service role from Netlify functions

-- ── Atomic check-and-increment RPC ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id   uuid,
  p_endpoint  text,
  p_max       integer DEFAULT 10,
  p_window_ms integer DEFAULT 600000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now        timestamptz := now();
  v_window_sec numeric     := p_window_ms / 1000.0;
  v_row        RECORD;
  v_limited    boolean;
BEGIN
  -- Upsert: reset if window expired, increment if still active
  INSERT INTO public.ai_rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, v_now)
  ON CONFLICT (user_id, endpoint) DO UPDATE
    SET request_count = CASE
          WHEN ai_rate_limits.window_start + (v_window_sec || ' seconds')::interval < v_now
          THEN 1
          ELSE ai_rate_limits.request_count + 1
        END,
        window_start = CASE
          WHEN ai_rate_limits.window_start + (v_window_sec || ' seconds')::interval < v_now
          THEN v_now
          ELSE ai_rate_limits.window_start
        END
  RETURNING request_count, window_start INTO v_row;

  v_limited := v_row.request_count > p_max;

  RETURN jsonb_build_object(
    'limited', v_limited,
    'count',   v_row.request_count,
    'max',     p_max,
    'resets_at', (v_row.window_start + (v_window_sec || ' seconds')::interval)
  );
END;
$$;

-- ── Cleanup: remove expired entries older than 1 hour ──────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.ai_rate_limits
  WHERE window_start < now() - interval '1 hour';
$$;
