import { useQueryClient, useIsFetching } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

export function GlobalRefreshButton() {
  const queryClient = useQueryClient()
  const isFetching  = useIsFetching()

  function handleRefresh() {
    void queryClient.invalidateQueries()
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isFetching > 0}
      title="Odśwież dane"
      aria-label="Odśwież dane"
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           44,
        height:          44,
        borderRadius:    8,
        border:          'none',
        background:      'transparent',
        cursor:          isFetching > 0 ? 'default' : 'pointer',
        color:           'var(--color-text-secondary)',
        opacity:         isFetching > 0 ? 0.5 : 1,
        transition:      'background 0.15s, color 0.15s, opacity 0.15s',
        flexShrink:      0,
      }}
      onMouseEnter={e => {
        if (isFetching > 0) return
        e.currentTarget.style.background = 'var(--color-surface-soft, rgba(0,0,0,0.06))'
        e.currentTarget.style.color = 'var(--color-text-primary)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--color-text-secondary)'
      }}
    >
      <RefreshCw
        size={17}
        style={{
          animation:       isFetching > 0 ? 'loftdesk-spin 0.8s linear infinite' : 'none',
        }}
      />
      <style>{`
        @keyframes loftdesk-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}
