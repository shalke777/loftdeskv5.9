// =============================================================================
// ClientShell — lekki shell dla roli 'client' (v6.0)
// =============================================================================
// Zamiast pełnego App Shell z sidebar wykonawcy, klient widzi:
//   - prostą nawigację: Projekty | Chat (nowy redirect) | Profil
//   - nagłówek z imieniem klienta + wyloguj
// Renderowany przez AuthLayout gdy user.role === 'client'
// =============================================================================

import { useEffect } from 'react'
import { FolderKanban, LogOut, MessageSquare, User } from 'lucide-react'
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ClientInstallBanner } from '@/features/client-portal/components/ClientInstallBanner'
import { useClientProjects } from '@/features/client-portal/hooks/useClientPortal'

export function ClientShell() {
  const { user, signOut } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  // Verify pendingProjectId against the RLS-filtered project list.
  // If the project was deleted or access revoked, my_client_project_ids() won't
  // return it \u2014 so it won't appear here and we fall back to dashboard.
  const { data: accessibleProjects } = useClientProjects()
  const verifiedProjectId = accessibleProjects != null
    ? (accessibleProjects.some(p => p.id === user?.pendingProjectId)
        ? user?.pendingProjectId ?? null
        : null)
    : user?.pendingProjectId ?? null  // still loading \u2014 keep value to avoid premature redirect

  useEffect(() => {
    if (!pathname.startsWith('/client/')) {
      // Only redirect to the project if it's still accessible.
      const dest = verifiedProjectId
        ? `/client/project/${verifiedProjectId}`
        : '/client/dashboard'
      void navigate({ to: dest })
    }
  }, [pathname, navigate, verifiedProjectId])

  return (
    <div className="client-shell">
      {/* ── Topbar ── */}
      <header className="client-topbar">
        <div className="client-topbar__brand">
          <span className="client-topbar__mark">LD</span>
          <span className="client-topbar__name">LoftDesk</span>
          <span className="client-topbar__badge">Portal klienta</span>
        </div>
        <div className="client-topbar__right">
          <span className="client-topbar__email">{user?.fullName || user?.email}</span>
          <button
            className="client-topbar__signout"
            onClick={async () => { await signOut(); window.location.assign('/login') }}
            title="Wyloguj"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Treść ── */}
      <main className="client-main">
        <Outlet />
      </main>

      {/* ── Dolna nawigacja ── */}
      <nav className="client-nav">
        <Link
          to="/client/dashboard"
          className={pathname.startsWith('/client/dashboard') ? 'client-nav__link client-nav__link--active' : 'client-nav__link'}
        >
          <FolderKanban size={20} />
          <span>Projekty</span>
        </Link>
        {verifiedProjectId && (
          <Link
            to="/client/project/$id"
            params={{ id: verifiedProjectId }}
            className={/^\/client\/project\//.test(pathname) ? 'client-nav__link client-nav__link--active' : 'client-nav__link'}
          >
            <MessageSquare size={20} />
            <span>Chat</span>
          </Link>
        )}
        <Link
          to="/client/profile"
          className={pathname.startsWith('/client/profile') ? 'client-nav__link client-nav__link--active' : 'client-nav__link'}
        >
          <User size={20} />
          <span>Profil</span>
        </Link>
      </nav>

      <ClientInstallBanner />
    </div>
  )
}
