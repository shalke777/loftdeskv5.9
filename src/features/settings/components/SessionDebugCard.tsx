import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { Card } from '@/shared/ui/Card/Card'

interface SessionInfo {
  userId: string | null
  email: string | null
  companyId: string | null
  companyName: string | null
  role: string | null
  isClient: boolean
  supabaseUrl: string
  isNative: boolean
}

/** Diagnostic card — shows raw session context so owner can detect ghost company sync issues. */
export function SessionDebugCard() {
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const { data: { user } } = await supabase.auth.getUser()
      const { data: ctx } = await supabase.rpc('get_session_context')
      const isNative = !!(window as any).Capacitor?.isNative
      setInfo({
        userId: user?.id ?? null,
        email: user?.email ?? null,
        companyId: ctx?.company_id ?? null,
        companyName: ctx?.company_name ?? null,
        role: ctx?.membership_role ?? null,
        isClient: ctx?.is_client ?? false,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '?',
        isNative,
      })
    }
    load()
  }, [])

  if (!info) return null

  const rows = [
    { label: 'User ID', value: info.userId },
    { label: 'Email', value: info.email },
    { label: 'Company ID', value: info.companyId },
    { label: 'Company Name', value: info.companyName },
    { label: 'Role', value: info.role },
    { label: 'Is Client', value: String(info.isClient) },
    { label: 'Supabase URL', value: info.supabaseUrl },
    { label: 'Native runtime', value: String(info.isNative) },
  ]

  function handleCopy() {
    const text = rows.map(r => `${r.label}: ${r.value ?? '—'}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Card>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            🔍 Diagnostyka sesji
          </h3>
          <button
            onClick={handleCopy}
            style={{
              fontSize: '0.75rem',
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-soft)',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
            }}
          >
            {copied ? '✓ Skopiowano' : 'Kopiuj'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 8, fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-text-secondary)', minWidth: 120 }}>{label}:</span>
              <span style={{ color: 'var(--color-text-primary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {value ?? '—'}
              </span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>
          Porównaj Company ID na telefonie i komputerze. Jeśli się różnią — to ghost company, zgłoś do supportu.
        </p>
      </div>
    </Card>
  )
}
