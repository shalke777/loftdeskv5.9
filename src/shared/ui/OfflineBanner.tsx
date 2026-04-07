/**
 * OfflineBanner — sticky offline indicator + sync status (B1)
 *
 * Shows when navigator.onLine = false.
 * On reconnect: replays queued mutations and shows progress.
 */

import { useEffect, useState, useCallback } from 'react'
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react'
import { getPendingCount, replayQueue } from '@/shared/lib/offlineQueue'
import type { MutationHandlers } from '@/shared/lib/offlineQueue'

// Registry of mutation handlers — registered at feature level
const _handlers: MutationHandlers = {}

export function registerOfflineHandler(type: string, handler: (payload: unknown) => Promise<unknown>) {
  _handlers[type] = handler
}

type SyncState = 'idle' | 'syncing' | 'done' | 'error'

export function OfflineBanner() {
  const [isOnline, setIsOnline]       = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncState, setSyncState]     = useState<SyncState>('idle')
  const [syncResult, setSyncResult]   = useState<{ succeeded: number; failed: number } | null>(null)

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  const handleOnline = useCallback(async () => {
    setIsOnline(true)
    await refreshPendingCount()

    const count = await getPendingCount()
    if (count === 0) {
      setSyncState('idle')
      return
    }

    setSyncState('syncing')
    try {
      const result = await replayQueue(_handlers)
      setSyncResult(result)
      setSyncState('done')
      await refreshPendingCount()
      // Auto-dismiss success banner after 3s
      setTimeout(() => {
        setSyncState('idle')
        setSyncResult(null)
      }, 3000)
    } catch {
      setSyncState('error')
    }
  }, [refreshPendingCount])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
    void refreshPendingCount()
  }, [refreshPendingCount])

  useEffect(() => {
    void refreshPendingCount()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    // Poll pending count every 10s when offline (in case sw.js triggers in background)
    const interval = setInterval(() => {
      if (!navigator.onLine) void refreshPendingCount()
    }, 10_000)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [handleOnline, handleOffline, refreshPendingCount])

  // Syncing banner (brief, shown even when back online)
  if (syncState === 'syncing') {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: 'var(--color-brand, #2563eb)',
        color: '#fff', padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 500,
      }}>
        <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
        Synchronizacja danych offline...
      </div>
    )
  }

  // Success banner
  if (syncState === 'done' && syncResult) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: 'var(--color-success, #16a34a)',
        color: '#fff', padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 500,
      }}>
        <CheckCircle size={14} />
        Zsynchronizowano {syncResult.succeeded} {syncResult.succeeded === 1 ? 'operację' : 'operacje'} z offline
        {syncResult.failed > 0 && <span style={{ opacity: 0.75 }}>· {syncResult.failed} nie powiodło się</span>}
      </div>
    )
  }

  // Offline banner
  if (!isOnline) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        background: '#1a1a1a',
        color: 'rgba(255,255,255,0.9)', padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 500,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <WifiOff size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
        <span>Tryb offline — dane z pamięci</span>
        {pendingCount > 0 && (
          <span style={{
            marginLeft: 'auto',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 99, padding: '2px 8px', fontSize: 11,
          }}>
            {pendingCount} {pendingCount === 1 ? 'operacja czeka' : 'operacje czekają'} na sync
          </span>
        )}
      </div>
    )
  }

  return null
}
