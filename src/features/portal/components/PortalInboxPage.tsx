import { useMemo, useState } from 'react'
import { ChevronDown, Copy, ExternalLink, MessageSquare } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useToast } from '@/shared/hooks/useToast'
import { usePortalTokens, useDeactivatePortalToken } from '@/features/portal/hooks/usePortalData'
import { usePortalInbox } from '@/features/portal/hooks/usePortalInbox'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { getAppOrigin } from '@/shared/lib/native'

type FilterKey = 'active' | 'all' | 'inactive'
type SortKey = 'activity' | 'unread' | 'client' | 'estimate'

const FILTER_LABELS: Record<FilterKey, string> = {
  active: 'Aktywne',
  all: 'Wszystkie',
  inactive: 'Nieaktywne',
}

export function PortalInboxPage() {
  const { user } = useAuth()
  const companyId = user?.companyId ?? ''
  const toast = useToast()
  const { data: tokens = [], isLoading } = usePortalTokens(companyId)
  const { unreadByToken, lastByToken } = usePortalInbox(companyId)
  const deactivate = useDeactivatePortalToken(companyId)

  const [filter, setFilter] = useState<FilterKey>('active')
  const [sortBy, setSortBy] = useState<SortKey>('activity')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const totalUnread = useMemo(
    () => Object.values(unreadByToken).reduce((s, v) => s + v, 0),
    [unreadByToken],
  )

  const displayed = useMemo(() => {
    let list = [...tokens]
    if (filter === 'active') list = list.filter((t) => t.active)
    else if (filter === 'inactive') list = list.filter((t) => !t.active)

    if (sortBy === 'unread') {
      list.sort((a, b) => (unreadByToken[b.id] ?? 0) - (unreadByToken[a.id] ?? 0))
    } else if (sortBy === 'client') {
      list.sort((a, b) => a.client_name.localeCompare(b.client_name, 'pl'))
    } else if (sortBy === 'estimate') {
      list.sort((a, b) => a.estimate_number.localeCompare(b.estimate_number))
    } else {
      list.sort((a, b) => {
        const aDate = lastByToken[a.id]?.created_at ?? a.expires_at ?? ''
        const bDate = lastByToken[b.id]?.created_at ?? b.expires_at ?? ''
        return new Date(bDate).getTime() - new Date(aDate).getTime()
      })
    }
    return list
  }, [tokens, filter, sortBy, unreadByToken, lastByToken])

  if (isLoading) return <Spinner />

  const origin = getAppOrigin()

  return (
    <div className="portal-page">
      <PageHeader
        title={`Portale klientów${totalUnread > 0 ? ` · ${totalUnread} nowych` : ''}`}
        subtitle="Zarządzaj linkami portali, śledź akceptacje i wiadomości od klientów."
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
                  ? tokens.filter((t) => t.active).length
                  : f === 'inactive'
                    ? tokens.filter((t) => !t.active).length
                    : tokens.length}
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
            <option value="activity">Ostatnia aktywność</option>
            <option value="unread">Nieprzeczytane</option>
            <option value="client">Klient A–Z</option>
            <option value="estimate">Numer kosztorysu</option>
          </select>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="proj-list" style={{ padding: '40px 20px', textAlign: 'center', color: '#8A8F98' }}>
          <MessageSquare size={36} style={{ margin: '0 auto 14px', opacity: 0.35, display: 'block' }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: '#A7ABB3', margin: '0 0 6px' }}>
            {filter === 'active' ? 'Brak aktywnych linków portalu' : 'Brak linków portalu'}
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>Generuj nowe linki w widoku Wyceny → Portal klienta.</p>
        </div>
      ) : (
        <div className="proj-list">
          {displayed.map((item) => {
            const fullUrl = `${origin}${item.url}`
            const unread = unreadByToken[item.id] ?? 0
            const last = lastByToken[item.id]
            const expiresLabel = item.expires_at
              ? new Date(item.expires_at).toLocaleDateString('pl-PL')
              : '—'
            const lastTimeLabel = last?.created_at
              ? new Date(last.created_at).toLocaleString('pl-PL', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null
            const isOpen = expandedId === item.id

            return (
              <div key={item.id} className={`proj-row${isOpen ? ' proj-row--open' : ''}`}>
                <div
                  className="proj-row__header"
                  onClick={() => setExpandedId(isOpen ? null : item.id)}
                >
                  {/* Unread badge */}
                  <div style={{ flexShrink: 0 }}>
                    {unread > 0 ? (
                      <span style={{
                        background: 'var(--color-brand)',
                        color: '#fff', fontWeight: 700, fontSize: 11,
                        borderRadius: 20, minWidth: 22, height: 22,
                        display: 'inline-flex', alignItems: 'center',
                        justifyContent: 'center', padding: '0 5px',
                      }}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    ) : (
                      <span style={{
                        width: 22, height: 22, borderRadius: 20,
                        background: 'var(--color-border-light, #3A3D42)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <MessageSquare size={12} color="#9ca3af" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="proj-row__info">
                    <span className="proj-row__name">{item.client_name}</span>
                    <div className="proj-row__meta">
                      <span className="proj-row__number">{item.estimate_number}</span>
                      {item.estimate_name ? (
                        <span className="proj-row__client">{item.estimate_name}</span>
                      ) : null}
                      {last && (
                        <span style={{ fontSize: 12, color: '#8A8F98' }}>
                          {last.sender === 'client' ? '← ' : '→ '}
                          <span style={{
                            maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle',
                          }}>
                            {last.content.replace(/\[img:data:image\/[^\]]{0,20}[^\]]*\]/g, '[zdjęcie]')}
                          </span>
                          {lastTimeLabel ? ` · ${lastTimeLabel}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: status + chevron */}
                  <div className="proj-row__right">
                    <span className={`proj-status ${item.active ? 'proj-status--active' : 'proj-status--cancelled'}`}>
                      {item.active ? 'aktywny' : 'wyłączony'}
                    </span>
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
                        <span style={{ color: '#A7ABB3', minWidth: 70 }}>Link:</span>
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--color-brand)', wordBreak: 'break-all', flex: 1 }}
                        >
                          {fullUrl}
                        </a>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: '#A7ABB3', minWidth: 70 }}>Wygasa:</span>
                        <span>{expiresLabel}</span>
                      </div>
                      {!last && (
                        <div style={{ color: '#8A8F98', fontSize: 12 }}>Brak wiadomości w tym portalu.</div>
                      )}
                    </div>
                    <div className="proj-row__actions" style={{ gap: 8 }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Copy size={13} />}
                        onClick={async (e) => {
                          e.stopPropagation()
                          await navigator.clipboard?.writeText(fullUrl)
                          toast.info('Skopiowano link portalu')
                        }}
                      >
                        Kopiuj link
                      </Button>
                      <a href={fullUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}>
                          Otwórz
                        </Button>
                      </a>
                      {item.active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deactivate.isPending && deactivate.variables === item.id}
                          onClick={(e) => { e.stopPropagation(); deactivate.mutate(item.id) }}
                        >
                          Dezaktywuj
                        </Button>
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
