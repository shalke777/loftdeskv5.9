import { useMemo, useState } from 'react'
import { Copy, ExternalLink, MessageSquare } from 'lucide-react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { Badge } from '@/shared/ui/Badge/Badge'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { useToast } from '@/shared/hooks/useToast'
import { usePortalTokens, useDeactivatePortalToken } from '@/features/portal/hooks/usePortalData'
import { usePortalInbox } from '@/features/portal/hooks/usePortalInbox'
import { useAuth } from '@/features/auth/hooks/useAuth'

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
      // activity — sort by last message date, fallback to expires_at
      list.sort((a, b) => {
        const aDate = lastByToken[a.id]?.created_at ?? a.expires_at ?? ''
        const bDate = lastByToken[b.id]?.created_at ?? b.expires_at ?? ''
        return new Date(bDate).getTime() - new Date(aDate).getTime()
      })
    }
    return list
  }, [tokens, filter, sortBy, unreadByToken, lastByToken])

  if (isLoading) return <Spinner />

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="portal-page">
      <PageHeader
        title={`Portale klientów${totalUnread > 0 ? ` · ${totalUnread} nowych` : ''}`}
        subtitle="Zarządzaj linkami portali, śledź akceptacje i wiadomości od klientów."
      />

      {/* Filter + sort bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: filter === f ? 'var(--color-accent, #3b82f6)' : '#e5e7eb',
                background: filter === f ? 'var(--color-accent, #3b82f6)' : '#fff',
                color: filter === f ? '#fff' : '#374151',
                fontWeight: filter === f ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280' }}>
          Sortuj:&nbsp;
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff', cursor: 'pointer' }}
          >
            <option value="activity">Ostatnia aktywność</option>
            <option value="unread">Nieprzeczytane</option>
            <option value="client">Klient A–Z</option>
            <option value="estimate">Numer kosztorysu</option>
          </select>
        </div>
      </div>

      {displayed.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#9ca3af' }}>
            <MessageSquare size={36} style={{ margin: '0 auto 14px', opacity: 0.35, display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 500, color: '#6b7280' }}>
              {filter === 'active' ? 'Brak aktywnych linków portalu' : 'Brak linków portalu'}
            </p>
            <p style={{ fontSize: 13, marginTop: 6 }}>
              Generuj nowe linki w widoku Wyceny → Portal klienta.
            </p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
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

            return (
              <Card
                key={item.id}
                style={{
                  padding: '12px 16px',
                  borderLeft: `3px solid ${unread > 0 ? '#3b82f6' : '#e5e7eb'}`,
                  opacity: item.active ? 1 : 0.65,
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Unread badge / icon */}
                  <div style={{ paddingTop: 2, flexShrink: 0 }}>
                    {unread > 0 ? (
                      <span style={{
                        background: '#3b82f6',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 12,
                        borderRadius: 20,
                        minWidth: 26,
                        height: 26,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 6px',
                      }}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    ) : (
                      <span style={{
                        width: 26,
                        height: 26,
                        borderRadius: 20,
                        background: '#f3f4f6',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <MessageSquare size={13} color="#9ca3af" />
                      </span>
                    )}
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>
                        {item.client_name}
                      </span>
                      <Badge variant={item.active ? 'success' : 'danger'}>
                        {item.active ? 'aktywny' : 'wyłączony'}
                      </Badge>
                    </div>

                    <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, color: '#6b7280' }}>{item.estimate_number}</span>
                      {item.estimate_name ? (
                        <span style={{ color: '#374151' }}> – {item.estimate_name}</span>
                      ) : null}
                    </div>

                    {last ? (
                      <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, color: last.sender === 'client' ? '#2563eb' : '#9ca3af', flexShrink: 0 }}>
                          {last.sender === 'client' ? '← klient:' : '→ ty:'}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                          {last.content.replace(/\[img:data:image\/[^\]]{0,20}[^\]]*\]/g, '[zdjęcie]')}
                        </span>
                        {lastTimeLabel ? (
                          <span style={{ color: '#9ca3af', flexShrink: 0 }}>· {lastTimeLabel}</span>
                        ) : null}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Brak wiadomości</div>
                    )}

                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      Wygasa: {expiresLabel}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', marginTop: 2, alignItems: 'flex-start' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        await navigator.clipboard?.writeText(fullUrl)
                        toast.info('Skopiowano link portalu')
                      }}
                    >
                      Kopiuj link
                    </Button>
                    <a href={fullUrl} target="_blank" rel="noreferrer">
                      <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
                        Otwórz
                      </Button>
                    </a>
                    {item.active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deactivate.isPending && deactivate.variables === item.id}
                        onClick={() => deactivate.mutate(item.id)}
                      >
                        Dezaktywuj
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
