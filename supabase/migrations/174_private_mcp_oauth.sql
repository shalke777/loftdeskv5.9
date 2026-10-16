-- Native Supabase OAuth server issues tokens. Enable this hook explicitly in
-- Auth settings after registering the private ChatGPT OAuth client.
CREATE TABLE public.private_mcp_clients (
  client_id TEXT PRIMARY KEY CHECK (length(client_id) BETWEEN 1 AND 500),
  display_name TEXT NOT NULL DEFAULT 'ChatGPT',
  resource_url TEXT NOT NULL CHECK (resource_url ~ '^https://[^/?#]+/api/assistant/mcp$'),
  redirect_uris TEXT[] NOT NULL CHECK (cardinality(redirect_uris) > 0),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  allow_write BOOLEAN NOT NULL DEFAULT FALSE,
  token_version INTEGER NOT NULL DEFAULT 1 CHECK (token_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.private_mcp_clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_mcp_clients FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.private_mcp_clients TO service_role;

CREATE OR REPLACE FUNCTION public.private_mcp_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  claims JSONB := event->'claims';
  oauth_client TEXT := COALESCE(NULLIF(event->>'client_id',''), NULLIF(claims->>'client_id',''));
  settings public.private_app_settings;
  client public.private_mcp_clients;
BEGIN
  -- Preserve existing first-party login/refresh behavior.
  IF oauth_client IS NULL THEN RETURN event; END IF;
  SELECT * INTO settings FROM public.private_app_settings WHERE singleton;
  SELECT * INTO client FROM public.private_mcp_clients WHERE client_id=oauth_client AND enabled;
  IF NOT COALESCE(settings.enabled,FALSE) OR client.client_id IS NULL
     OR claims->>'sub' IS DISTINCT FROM settings.owner_user_id::TEXT THEN
    RAISE EXCEPTION 'Private MCP client access denied';
  END IF;
  -- Intentionally not a database role: PostgREST cannot SET ROLE to this
  -- identity. MCP tokens must not inherit the owner's direct REST/RPC powers.
  -- Do not create/grant this role to authenticator.
  claims := claims || jsonb_build_object(
    'aud',client.resource_url,'role','loftdesk_mcp_only','client_id',oauth_client,
    'scope','email','loftdesk_mcp',TRUE,
    'loftdesk_company_id',settings.company_id,
    'loftdesk_mcp_version',client.token_version,
    'loftdesk_mcp_write',client.allow_write
  );
  claims := jsonb_set(claims,'{exp}',to_jsonb(LEAST((claims->>'exp')::BIGINT,extract(epoch FROM now())::BIGINT+900)));
  RETURN jsonb_set(event,'{claims}',claims);
END $$;
REVOKE ALL ON FUNCTION public.private_mcp_access_token_hook(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.private_mcp_access_token_hook(JSONB) TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
