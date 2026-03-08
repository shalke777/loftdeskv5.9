/**
 * Tłumaczenie komunikatów błędów Supabase / technicznych na język polski.
 * Ukrywa szczegóły techniczne przed użytkownikiem końcowym.
 */

const ERROR_MAP: Record<string, string> = {
  // ── Auth ──────────────────────────────────────────────────────────────
  'Invalid login credentials': 'Nieprawidłowy e-mail lub hasło.',
  'invalid login credentials': 'Nieprawidłowy e-mail lub hasło.',
  'Invalid email or password': 'Nieprawidłowy e-mail lub hasło.',
  'Email not confirmed': 'E-mail nie został jeszcze potwierdzony. Sprawdź skrzynkę pocztową.',
  'User already registered': 'Konto z tym adresem e-mail już istnieje.',
  'User not found': 'Nie znaleziono użytkownika z tym adresem e-mail.',
  'Email already exists': 'Konto z tym adresem e-mail już istnieje.',
  'Password should be at least 6 characters': 'Hasło powinno mieć co najmniej 6 znaków.',
  'Signup requires a valid password': 'Podaj prawidłowe hasło.',
  'Unable to validate email address: invalid format': 'Nieprawidłowy format adresu e-mail.',
  'A user with this email address has already been registered': 'Konto z tym adresem e-mail już istnieje.',
  'Email link is invalid or has expired': 'Link potwierdzający wygasł lub jest nieprawidłowy. Spróbuj ponownie.',
  'Token has expired or is invalid': 'Link wygasł lub jest nieprawidłowy. Spróbuj ponownie.',
  'Auth session missing!': 'Sesja wygasła. Zaloguj się ponownie.',
  'JWT expired': 'Sesja wygasła. Zaloguj się ponownie.',
  'Invalid Refresh Token: Refresh Token Not Found': 'Sesja wygasła. Zaloguj się ponownie.',
  'New password should be different from the old password.': 'Nowe hasło musi być inne niż poprzednie.',
  'For security purposes, you can only request this once every 60 seconds': 'Ze względów bezpieczeństwa możesz wysłać kolejne żądanie za 60 sekund.',
  'For security purposes, you can only request this after': 'Odczekaj chwilę przed kolejną próbą.',

  // ── Rate limiting ─────────────────────────────────────────────────────
  'Rate limit exceeded': 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.',
  'Too many requests': 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.',

  // ── Network ───────────────────────────────────────────────────────────
  'Failed to fetch': 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
  'NetworkError': 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
  'Load failed': 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',

  // ── Database / RLS ────────────────────────────────────────────────────
  'new row violates row-level security policy': 'Brak uprawnień do wykonania tej operacji.',
  'permission denied': 'Brak uprawnień do wykonania tej operacji.',

  // ── PKCE / OAuth ──────────────────────────────────────────────────────
  'Both auth code and code verifier should be non-empty': 'Link weryfikacyjny jest niekompletny. Spróbuj ponownie.',
}

/**
 * Tłumaczy komunikat błędu na polski.
 * Jeśli komunikat jest rozpoznany — zwraca polskie tłumaczenie.
 * Jeśli nie — zwraca ogólny komunikat (ukrywa szczegóły techniczne).
 */
export function translateError(error: unknown, fallback = 'Wystąpił błąd. Spróbuj ponownie.'): string {
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : ''

  // Exact match
  if (ERROR_MAP[msg]) return ERROR_MAP[msg]

  // Partial match (some Supabase errors include extra context)
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return value
  }

  // Already in Polish (contains Polish-specific characters) — pass through
  if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(msg)) return msg

  // Unknown English error — hide technical details
  return fallback
}
