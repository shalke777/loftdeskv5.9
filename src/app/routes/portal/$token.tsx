// =============================================================================
// FAZA 3 — Portal tokenowy wycofany
// =============================================================================
// Linki tokenowe (/portal/:token) zostały wycofane w ramach migracji Fazy 2/3.
// Wszyscy klienci z emailem zostali przeniesieni na portal oparty o magic link.
// Nowy portal klienta: /client/project/:id (auth-based, Supabase JWT + RLS).
//
// Faza 4 (docelowo): usunięcie PortalProjectPage, portal-validate.ts, portal-revoke.ts,
//   DROP TABLE project_portal_sessions, project_portal_tokens
// =============================================================================

/**
 * Sunset screen dla starych linków portalowych.
 * Wyświetlany dla każdego URL /portal/:token — bez walidacji tokenu ani danych.
 */
export function PortalTokenRoutePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ maxWidth: 440, padding: '40px 32px', background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: '#111827' }}>
          Ten link nie jest już aktywny
        </h2>
        <p style={{ color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}>
          Linki tokenowe portalu zostały wycofane. Dostęp do portalu klienta odbywa się teraz przez zaproszenie emailowe.
        </p>
        <p style={{ color: '#9ca3af', fontSize: 13 }}>
          Poproś firmę o nowe zaproszenie — otrzymasz email z linkiem do logowania.
        </p>
      </div>
    </div>
  )
}

