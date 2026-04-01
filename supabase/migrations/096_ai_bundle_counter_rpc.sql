-- =============================================================================
-- 096_ai_bundle_counter_rpc.sql
-- =============================================================================
-- Helper RPC for incrementing denormalized counters on ai_analysis_bundles.
-- Called by the service layer in bundle.service.ts when assets are registered
-- or when extraction status changes.
--
-- Uses security definer with explicit search_path to prevent privilege escalation.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_bundle_counter(
  p_bundle_id uuid,
  p_column    text,
  p_delta     integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate allowed columns to prevent SQL injection via column name
  IF p_column NOT IN ('asset_count', 'extracted_count', 'failed_count') THEN
    RAISE EXCEPTION 'increment_bundle_counter: invalid column "%"', p_column;
  END IF;

  IF p_column = 'asset_count' THEN
    UPDATE public.ai_analysis_bundles
    SET asset_count = asset_count + p_delta
    WHERE id = p_bundle_id;

  ELSIF p_column = 'extracted_count' THEN
    UPDATE public.ai_analysis_bundles
    SET extracted_count = extracted_count + p_delta
    WHERE id = p_bundle_id;

  ELSIF p_column = 'failed_count' THEN
    UPDATE public.ai_analysis_bundles
    SET failed_count = failed_count + p_delta
    WHERE id = p_bundle_id;
  END IF;
END;
$$;

-- Grant execute to service role only (anon/authenticated must not call this directly)
REVOKE EXECUTE ON FUNCTION public.increment_bundle_counter(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_bundle_counter(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_bundle_counter(uuid, text, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_bundle_counter(uuid, text, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
