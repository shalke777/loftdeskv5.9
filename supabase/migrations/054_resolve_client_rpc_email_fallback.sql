-- =============================================================================
-- Migration 054: resolve_my_client_account — email fallback + auto-repair
-- =============================================================================
-- Problem który to naprawia:
--   Klient loguje się poprawnie, ale ląduje w panelu WYKONAWCY zamiast własnym.
--
-- Root cause:
--   client_accounts.auth_user_id IS NULL dla tego klienta.
--   Kiedy auth_user_id IS NULL:
--     1. RLS policy "ca_client_select_own" blokuje SELECT z przeglądarki
--        (USING auth_user_id = auth.uid() = NULL = FALSE)
--     2. resolve_my_client_account() zwraca puste
--     3. Direct fallback .eq('auth_user_id', authUser.id) też zwraca puste
--     4. bootstrap_my_company odpala -> role:'owner' -> shell wykonawcy
--
-- Fix:
--   RPC (SECURITY DEFINER) najpierw próbuje po auth_user_id.
--   Jesli brak - fallback po emailu (auth.jwt() ->> 'email') dla wierszy
--   gdzie auth_user_id IS NULL.
--   Przy znalezieniu emailem - auto-naprawia auth_user_id i zwraca rekord.
--   Nastepne wywolanie (po auto-naprawie) trafi na fast path.
-- =============================================================================

DROP FUNCTION IF EXISTS public.resolve_my_client_account();

CREATE OR REPLACE FUNCTION public.resolve_my_client_account()
RETURNS SETOF public.client_accounts
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.client_accounts;
BEGIN
  -- Fast path: po auth_user_id
  SELECT * INTO result
  FROM   public.client_accounts
  WHERE  auth_user_id = auth.uid()
  LIMIT  1;

  IF FOUND THEN
    RETURN NEXT result;
    RETURN;
  END IF;

  -- Fallback: po emailu (dla wierszy z auth_user_id IS NULL)
  -- SECURITY DEFINER pozwala pominac RLS i zobaczyc wiersze z NULL auth_user_id.
  SELECT * INTO result
  FROM   public.client_accounts
  WHERE  lower(email) = lower(auth.jwt() ->> 'email')
    AND  auth_user_id IS NULL
  LIMIT  1;

  IF FOUND THEN
    UPDATE public.client_accounts
    SET    auth_user_id = auth.uid(),
           updated_at   = now()
    WHERE  id = result.id;

    result.auth_user_id := auth.uid();
    RETURN NEXT result;
  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_my_client_account() TO authenticated;
