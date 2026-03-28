// =============================================================================
// ApprovalEventList.tsx — immutable audit trail for a signature request
// =============================================================================

import { useSignatureEvents } from '@/features/signatures/hooks/useSignatureRequests'

interface Props {
  signatureRequestId: string
}

const EVENT_LABELS: Record<string, string> = {
  created:              'Wniosek utworzony',
  participant_notified: 'Uczestnik powiadomiony',
  viewed:               'Dokument wyświetlony',
  otp_sent:             'Kod OTP wysłany',
  otp_verified:         'Kod OTP zweryfikowany',
  approved:             'Zaakceptowano',
  rejected:             'Odrzucono',
  questioned:           'Zadano pytanie',
  signing_initiated:    'Podpisywanie uruchomione',
  signed:               'Podpisano',
  provider_callback:    'Odpowiedź dostawcy',
  completed:            'Wniosek zakończony',
  cancelled:            'Wniosek anulowany',
  expired:              'Wniosek wygasł',
}

const ACTOR_LABEL: Record<string, string> = {
  operator: 'Wykonawca',
  client:   'Klient',
  system:   'System',
  provider: 'Dostawca',
}

export function ApprovalEventList({ signatureRequestId }: Props) {
  const { data: events, isLoading } = useSignatureEvents(signatureRequestId)

  if (isLoading) return <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Ładowanie historii…</p>
  if (!events?.length) return null

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        Historia zdarzeń
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {events.map(ev => (
          <li key={ev.id} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {new Date(ev.created_at).toLocaleString('pl-PL', {
                day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <span style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }}>
              {ACTOR_LABEL[ev.actor_type] ?? ev.actor_type}
            </span>
            <span>{EVENT_LABELS[ev.event_type] ?? ev.event_type}</span>
            {ev.document_hash && (
              <span style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 10 }}>
                {ev.document_hash.slice(0, 8)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
