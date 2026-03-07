import { useState } from 'react'
import { PageHeader } from '@/shared/ui/PageHeader/PageHeader'
import { Spinner } from '@/shared/ui/Spinner/Spinner'
import { Card } from '@/shared/ui/Card/Card'
import { usePortalApprovalDecision, usePortalData, usePortalDecision, usePortalIdentity, usePortalProtocolDecision, usePortalStandardAccept } from '@/features/portal/hooks/usePortalData'
import { PortalChat } from '@/features/portal/components/PortalChat'
import { PortalHeader } from '@/features/portal/components/PortalHeader'
import { PortalEstimate } from '@/features/portal/components/PortalEstimate'
import { PortalExpired } from '@/features/portal/components/PortalExpired'
import { PortalNamePrompt } from '@/features/portal/components/PortalNamePrompt'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/shared/ui/Button/Button'

function readTokenFromPath() {
  if (typeof window === 'undefined') return 'demo-token'
  const last = window.location.pathname.split('/').filter(Boolean).pop()
  return last || 'demo-token'
}

export function PortalPage({ token }: { token?: string }) {
  const [modalImg, setModalImg] = useState<string | null>(null)
  const { user } = useAuth()
  const resolvedToken = token || readTokenFromPath()
  const { data, isLoading, error } = usePortalData(resolvedToken)
  const decision = usePortalDecision(resolvedToken)
  const identity = usePortalIdentity(resolvedToken)
  const approvalDecision = usePortalApprovalDecision(resolvedToken)
  const protocolDecision = usePortalProtocolDecision(resolvedToken)
  const standardAccept = usePortalStandardAccept(resolvedToken)

  if (isLoading) return <Spinner />
  if (error || !data) {
    return (
      <div className="portal-page">
        <Card>
          <h3>Link portalu jest nieaktywny</h3>
          <p>Ten link nie został znaleziony, wygasł albo został wyłączony przez firmę.</p>
        </Card>
      </div>
    )
  }

  if (data.expired || !data.active) return <PortalExpired />

  return (
    <div className="portal-page">
      {user && (
        <div style={{ marginBottom: 18 }}>
          <Button variant="ghost" onClick={() => window.location.assign('/dashboard')}>
            ← Powrót do aplikacji
          </Button>
        </div>
      )}
      <PageHeader title="Portal klienta" subtitle="W tym miejscu klient widzi konkretny kosztorys, może go zaakceptować i zostawić komentarz do wyceny." />
      <PortalHeader
        estimateNumber={data.estimateNumber}
        estimateName={data.estimateName}
        customerName={data.customerName}
        contractorName={data.contractorName}
        contractorEmail={data.contractorEmail}
        expiresAt={data.expiresAt}
        expired={data.expired}
        estimateStatus={data.estimateStatus}
      />
      {/* Usunięto kwadrat 'Podpis rozmowy' na życzenie klienta */}
      <PortalEstimate
        totalGross={data.totalGross}
        estimateStatus={data.estimateStatus}
        onAccept={() => decision.mutate('accepted')}
        onReject={() => decision.mutate('rejected')}
        disabled={decision.isPending}
        estimateNumber={data.estimateNumber}
        estimateName={data.estimateName}
        items={data.items}
        notes={data.notes}
        validUntil={data.validUntil}
      />
      {data.approvals.length ? <Card><h3>Decyzje do akceptacji</h3><div style={{ display: 'grid', gap: 12, marginTop: 12 }}>{data.approvals.map((item) => <div key={item.id} className="list-row" style={{ alignItems: 'flex-start' }}><div><strong>{item.title}</strong><div className="field__label" style={{ marginTop: 6 }}>{item.description}</div><div className="field__label" style={{ marginTop: 6 }}>Typ: {item.type} · Status: {item.status}</div></div><div className="actions-row" style={{ marginTop: 0 }}><button className="btn btn--secondary btn--sm" onClick={() => approvalDecision.mutate({ id: item.id, decision: 'accepted' })}>Akceptuj</button><button className="btn btn--ghost btn--sm" onClick={() => approvalDecision.mutate({ id: item.id, decision: 'revision_requested', comment: 'Proszę o korektę / doprecyzowanie.' })}>Poproś o korektę</button></div></div>)}</div></Card> : null}
      {data.protocols.length ? <Card><h3>Protokoły odbioru</h3><div style={{ display: 'grid', gap: 12, marginTop: 12 }}>{data.protocols.map((item) => <div key={item.id} className="list-row" style={{ alignItems: 'flex-start' }}><div><strong>{item.title}</strong><div className="field__label" style={{ marginTop: 6 }}>{item.summary}</div><div className="field__label" style={{ marginTop: 6 }}>Status: {item.status}</div></div><div className="actions-row" style={{ marginTop: 0 }}><button className="btn btn--secondary btn--sm" onClick={() => protocolDecision.mutate({ id: item.id, decision: 'accepted' })}>Akceptuj odbiór</button><button className="btn btn--ghost btn--sm" onClick={() => protocolDecision.mutate({ id: item.id, decision: 'rejected' })}>Zgłoś uwagi</button></div></div>)}</div></Card> : null}
      {/* Regulaminy i standardy usunięte na życzenie klienta */}
      <Card>
        <h3>Historia wiadomości</h3>
        <p className="field__label">Komentarze są zapisane do tego konkretnego kosztorysu.</p>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {data.messages.map((message) => {
            // Wyszukaj i wyodrębnij załącznik obrazka
            const imgMatch = message.text.match(/\[img:(data:image\/(?:png|jpeg|jpg|gif);base64,[^\]]+)\]/)
            const text = message.text.replace(/\[img:(data:image\/(?:png|jpeg|jpg|gif);base64,[^\]]+)\]/, '').trim()
            return (
              <div key={message.id} className="portal-message">
                <strong>{message.author === 'company' ? 'Firma' : data.customerName}:</strong> {text}
                {imgMatch && (
                  <div style={{ margin: '8px 0 0 0' }}>
                    <img
                      src={imgMatch[1]}
                      alt="Załączone zdjęcie"
                      style={{ maxWidth: 180, maxHeight: 120, borderRadius: 6, border: '1px solid #e0e0e0', background: '#fafbfc', marginTop: 4, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                      onClick={() => setModalImg(imgMatch[1])}
                      title="Kliknij, aby powiększyć"
                    />
                  </div>
                )}
                <div className="field__label" style={{ marginTop: 6 }}>{new Date(message.created_at).toLocaleString('pl-PL')}</div>
              </div>
            )
          })}
          {/* Modal powiększenia zdjęcia */}
          {modalImg && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.7)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'zoom-out',
              }}
              onClick={() => setModalImg(null)}
            >
              <img
                src={modalImg}
                alt="Powiększone zdjęcie"
                style={{
                  maxWidth: '90vw',
                  maxHeight: '90vh',
                  borderRadius: 12,
                  boxShadow: '0 4px 32px #0008',
                  background: '#fff',
                  border: '2px solid #fff',
                  cursor: 'zoom-out',
                }}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </Card>
      <Card>
        <h3>Napisz wiadomość</h3>
        <PortalChat token={resolvedToken} />
      </Card>
    </div>
  )
}
