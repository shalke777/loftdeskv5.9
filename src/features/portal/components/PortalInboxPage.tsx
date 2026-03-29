import { useMemo, useState } from 'react'
import { ChevronDown, MessageCircle, Users } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/shared/ui/Button/Button'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { usePortalAccessClients, usePortalProjectSummaries, useRevokePortalAccess } from '@/features/portal/hooks/usePortalData'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { threadsApi } from '@/features/projects/api/threads.api'

type FilterKey = 'active' | 'all' | 'inactive'
type SortKey = 'recent' | 'client' | 'project'

const FILTER_LABELS: Record<FilterKey, string> = {
  active: 'Aktywne',
  all: 'Wszystkie',
  inactive: 'Nieaktywne',
}

const ACTIVE_STATUSES = new Set(['offer', 'active'])

const PROJECT_STATUS_LABEL: Record<string, string> = {
  offer: 'oferta',
  active: 'w trakcie',
  done: 'zakończony',
  cancelled: 'anulowany',
}

export function PortalInboxPage() {
  const { user } = useAuth()
  const companyId = user?.companyId ?? ''
  const { data: clients = [], isLoading } = usePortalAccessClients(companyId)
  const revoke = useRevokePortalAccess(companyId)

  const allProjectIds = useMemo(() => [...new Set(clients.map(c => c.projectId))], [clients])
  const { data: summaries = [] } = usePortalProjectSummaries(allProjectIds)
  const summaryByProject = useMemo(
    () => Object.fromEntries(summaries.map(s => [s.projectId, s])),
    [summaries],
  )

  const navigate = useNavigate()

  const [filter, setFilter] = useState<FilterKey>('active')
  const [sortBy, setSortBy] = useState<SortKey>('recent')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null)
  const [openingChatId, setOpeningChatId] = useState<string | null>(null)

  async function handleOpenMessages(item: { id: string; projectId: string; clientAccountId: string; fullName: string | null; email: string }) {
    setOpeningChatId(item.id)
    try {
      const thread = await threadsApi.getOrCreateClientSharedThread(
        item.projectId,
        item.clientAccountId,
        `Wiadomości z ${item.fullName || item.email}`,
        companyId,
      )
      void navigate({ to: '/chat', search: { threadId: thread.id } })
    } finally {
      setOpeningChatId(null)
    }
  }

  const displayed = useMemo(() => {
    let list = [...clients]
    if (filter === 'active') list = list.filter((c) => ACTIVE_STATUSES.has(c.projectStatus))
    else if (filter === 'inactive') list = list.filter((c) => !ACTIVE_STATUSES.has(c.projectStatus))

    if (sortBy === 'client') {
      list.sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email, 'pl'))
    } else if (sortBy === 'project') {
      list.sort((a, b) => a.projectName.localeCompare(b.projectName, 'pl'))
    } else {
      list.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime())
    }
    return list
  }, [clients, filter, sortBy])

  if (isLoading) return <Spinner />

  return (
    <div className="portal-page">
      <PageHeader
        title="Portale klientów"
        subtitle="Klienci z aktywnym dostępem do portalu projektu. Zarządzaj zaproszeniami w widoku Projekt → Portal klienta."
      />

      {/* Filter + sort bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((f) => (
            <button
              key={f}
              className={`proj-filter-pill${filter === f ? ' proj-filter-pill--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]}
              <span className="proj-filter-pill__count">
                {f === 'active'
                  ? clients.filter((c) => ACTIVE_STATUSES.has(c.projectStatus)).length
                  : f === 'inactive'
                    ? clients.filter((c) => !ACTIVE_STATUSES.has(c.projectStatus)).length
                    : clients.length}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#A7ABB3' }}>
          Sortuj:&nbsp;
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="chat-project-select"
            style={{ width: 'auto' }}
          >
            <option value="recent">Ostatnio dodani</option>
            <option value="client">Klient A–Z</option>
            <option value="project">Projekt A–Z</option>
          </select>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="proj-list" style={{ padding: '40px 20px', textAlign: 'center', color: '#8A8F98' }}>
          <Users size={36} style={{ margin: '0 auto 14px', opacity: 0.35, display: 'block' }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: '#A7ABB3', margin: '0 0 6px' }}>
            {filter === 'active' ? 'Brak klientów z aktywnym dostępem' : 'Brak klientów w portalu'}
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>Zapraszaj klientów w widoku Projekt → Portal klienta.</p>
        </div>
      ) : (
        <div className="proj-list">
          {displayed.map((item) => {
            const isOpen = expandedId === item.id
            const isActive = ACTIVE_STATUSES.has(item.projectStatus)
            const grantedLabel = new Date(item.grantedAt).toLocaleDateString('pl-PL')
            const isConfirming = confirmRevokeId === item.id
            const summary = summaryByProject[item.projectId]
            const hasUnread = (summary?.unreadOperator ?? 0) > 0
            const hasPending = (summary?.pendingApprovals ?? 0) > 0

            return (
              <div key={item.id} className={`proj-row${isOpen ? ' proj-row--open' : ''}`}>
                <div
                  className="proj-row__header"
                  onClick={() => {
                    setExpandedId(isOpen ? null : item.id)
                    if (isOpen) setConfirmRevokeId(null)
                  }}
                >
                  {/* Avatar placeholder */}
                  <div style={{ flexShrink: 0 }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 20,
                      background: 'var(--color-border-light, #3A3D42)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600, color: '#9ca3af',
                    }}>
                      {(item.fullName ?? item.email).charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="proj-row__info">
                    <span className="proj-row__name">{item.fullName ?? item.email}</span>
                    <div className="proj-row__meta">
                      {item.fullName && (
                        <span className="proj-row__client">{item.email}</span>
                      )}
                      <span className="proj-row__number">{item.projectNumber}</span>
                      <span className="proj-row__client">{item.projectName}</span>
                      <span style={{ fontSize: 12, color: '#8A8F98' }}>zaproszony {grantedLabel}</span>
                    </div>
                  </div>

                  {/* Right: login status + communication badges + chevron */}
                  <div className="proj-row__right">
                    <span className={`proj-status ${isActive ? 'proj-status--active' : 'proj-status--cancelled'}`}>
                      {PROJECT_STATUS_LABEL[item.projectStatus] ?? item.projectStatus}
                    </span>
                    {item.hasLoggedIn ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#77BA8A', background: 'rgba(119,186,138,0.10)', borderRadius: 6, padding: '2px 7px' }}>
                        zalogowany
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#D4960A', background: 'rgba(212,150,10,0.10)', borderRadius: 6, padding: '2px 7px' }}>
                        wysłano
                      </span>
                    )}
                    {hasUnread && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#77BA8A', background: 'rgba(119,186,138,0.12)', borderRadius: 6, padding: '2px 7px' }}>
                        <MessageCircle size={11} />
                        {summary!.unreadOperator}
                      </span>
                    )}
                    {hasPending && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#E8A838', background: 'rgba(232,168,56,0.12)', borderRadius: 6, padding: '2px 7px' }}>
                        {summary!.pendingApprovals} do zatw.
                      </span>
                    )}
                    <span
                      className="proj-row__chevron"
                      style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
                    >
                      <ChevronDown size={16} />
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="proj-row__detail">
                    <div style={{ fontSize: 13, color: '#D0D4DA', marginBottom: 14, display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: '#A7ABB3', minWidth: 70 }}>Email:</span>
                        <span>{item.email}</span>
                      </div>
                      {item.phone && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span style={{ color: '#A7ABB3', minWidth: 70 }}>Telefon:</span>
                          <span>{item.phone}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: '#A7ABB3', minWidth: 70 }}>Projekt:</span>
                        <span>{item.projectNumber} — {item.projectName}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: '#A7ABB3', minWidth: 70 }}>Dodano:</span>
                        <span>{grantedLabel}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: '#A7ABB3', minWidth: 70 }}>Status:</span>
                        <span style={{ color: item.hasLoggedIn ? '#77BA8A' : '#D4960A' }}>
                          {item.hasLoggedIn ? 'Klient zalogował się do portalu' : 'Dostęp wysłany — klient jeszcze nie otworzył portalu'}
                        </span>
                      </div>
                    </div>

                    <div className="proj-row__actions" style={{ gap: 8 }}>
                      {item.hasLoggedIn && (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={openingChatId === item.id}
                          disabled={openingChatId === item.id}
                          onClick={(e) => { e.stopPropagation(); void handleOpenMessages(item) }}
                        >
                          Otwórz wiadomości
                        </Button>
                      )}
                      {!isConfirming ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setConfirmRevokeId(item.id) }}
                        >
                          Cofnij dostęp
                        </Button>
                      ) : (
                        <>
                          <span style={{ fontSize: 13, color: '#A7ABB3', alignSelf: 'center' }}>
                            Na pewno cofnąć dostęp?
                          </span>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={revoke.isPending}
                            onClick={(e) => {
                              e.stopPropagation()
                              revoke.mutate(item.id, {
                                onSuccess: () => {
                                  setExpandedId(null)
                                  setConfirmRevokeId(null)
                                },
                              })
                            }}
                          >
                            Tak, cofnij
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setConfirmRevokeId(null) }}
                          >
                            Anuluj
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
