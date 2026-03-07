import React, { useState } from 'react'
import { Card } from '@/shared/ui/Card/Card'
import { Button } from '@/shared/ui/Button/Button'
import { formatCurrency } from '@/shared/lib/formatters'

export function PortalEstimate({
  totalGross,
  estimateStatus,
  onAccept,
  onReject,
  disabled,
  estimateNumber,
  estimateName,
  items,
  notes,
  validUntil,
}: {
  totalGross: number
  estimateStatus: 'draft' | 'sent' | 'accepted' | 'rejected'
  onAccept: () => void
  onReject: () => void
  disabled?: boolean
  estimateNumber?: string
  estimateName?: string
  items?: Array<{ id: string; name: string; description?: string; unit: string; quantity: number; unit_price: number; vat_rate: number }>
  notes?: string
  validUntil?: string | null
}) {
  const canDecide = estimateStatus !== 'accepted' && estimateStatus !== 'rejected'


  return (
    <Card>
      <h3>Decyzja klienta</h3>
      <p>Wartość brutto: {formatCurrency(totalGross)}</p>
      <p className="field__label">Status portalu: {estimateStatus}</p>
      <div className="actions-row" style={{ marginTop: 12 }}>
        <Button onClick={onAccept} disabled={disabled || !canDecide}>Akceptuję kosztorys</Button>
        <Button variant="danger" onClick={onReject} disabled={disabled || !canDecide}>Odrzucam</Button>
      </div>
      <hr style={{ margin: '18px 0' }} />
      <div>
        <strong>Numer wyceny:</strong> {estimateNumber}<br />
        <strong>Nazwa wyceny:</strong> {estimateName}<br />
        {validUntil && <><strong>Ważny do:</strong> {validUntil}<br /></>}
        {notes && <><strong>Notatki:</strong> {notes}<br /></>}
      </div>
      <div style={{ marginTop: 18 }}>
        <strong>Pozycje wyceny:</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {items?.map((item) => (
            <div key={item.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', boxShadow: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 15, fontWeight: 500, color: '#222' }}>
                <span style={{ flex: 2 }}>{item.name}</span>
                <span style={{ flex: 1, color: '#666', fontWeight: 400 }}>j.m.: {item.unit}</span>
                <span style={{ flex: 1, color: '#666', fontWeight: 400 }}>Ilość: {item.quantity}</span>
                <span style={{ flex: 1, color: '#666', fontWeight: 400 }}>Netto: {formatCurrency(item.quantity * item.unit_price)}</span>
                <span style={{ flex: 1, color: '#666', fontWeight: 400 }}>VAT: {formatCurrency(item.quantity * item.unit_price * (item.vat_rate / 100))}</span>
              </div>
              {item.description?.trim() && (
                <div style={{ fontSize: 13, color: '#7b869a', marginTop: 4, marginLeft: 2 }}>{item.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
