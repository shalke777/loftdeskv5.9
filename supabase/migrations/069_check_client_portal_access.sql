-- =============================================================================
-- 069_check_client_portal_access.sql
-- =============================================================================
-- Funkcja dostępna dla anonimowych wywołań (anon key).
-- Zwraca TRUE jeśli podany email ma rekord w client_accounts.
-- Wymagana przez ClientMagicLinkForm do wstępnej weryfikacji przed OTP:
--   - email zaproszony przez operatora → TRUE → wyślij OTP
--   - email niezaproszony → FALSE → pokaż jasny komunikat (bez OTP)
--
-- BEZPIECZEŃSTWO:
--   - Ujawnia tylko, czy email ma dostęp do portalu (boolean, nie dane)
--   - W kontekście B2B (narzędzie dla firm budowlanych) akceptowalny trade-off
--   - Nie ujawnia żadnych danych konta, projektu, ani firmy
--   - SECURITY DEFINER — działa z uprawnieniami twórcy (postgres), omija RLS
--   - search_path ustawiony explicite (OWASP: brak path injection)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_client_portal_access(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.client_accounts
    WHERE email = lower(trim(p_email))
  );
END;
$$;

-- Anon + authenticated mogą wywołać
GRANT EXECUTE ON FUNCTION public.check_client_portal_access(text) TO anon, authenticated;
