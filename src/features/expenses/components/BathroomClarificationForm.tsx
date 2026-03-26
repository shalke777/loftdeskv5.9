// =============================================================================
// BathroomClarificationForm v2 — guided inputs before AI analysis
// =============================================================================
// Extended form: area, height, tile, bathtub/shower, WC type, sinks, linear drain,
// floor heating, plumbing/electrical changes, boiler casing, standard, notes.
// All fields optional, quick to fill, skippable.

import { useState } from 'react'
import type { BathroomClarification } from '@/features/expenses/hooks/useAnalyzeRoomPhoto'
import type { RoomTypeId } from '@/services/ai/room-types'
import { getRoomTypeName } from '@/services/ai/room-types'

interface Props {
  photoCount: number
  roomType?: RoomTypeId
  onSubmit: (data: BathroomClarification) => void
  onSkip: () => void
  disabled?: boolean
}

export function BathroomClarificationForm({ photoCount, roomType, onSubmit, onSkip, disabled }: Props) {
  const [area, setArea]                 = useState('')
  const [height, setHeight]             = useState('')
  const [tileCoverage, setTileCoverage] = useState<'full' | 'partial' | 'none' | ''>('')
  const [hasBathtub, setHasBathtub]     = useState(false)
  const [hasShower, setHasShower]       = useState(false)
  const [hasFloorHeating, setHasFloorHeating] = useState(false)
  const [wcType, setWcType]             = useState<'standing' | 'concealed' | ''>('')
  const [sinkCount, setSinkCount]       = useState<1 | 2 | ''>('')
  const [hasLinearDrain, setHasLinearDrain] = useState(false)
  const [plumbingScope, setPlumbingScope] = useState<'none' | 'limited' | 'full' | ''>('')
  const [electricalScope, setElectricalScope] = useState<'none' | 'limited' | 'full' | ''>('')
  const [hasBoilerCasing, setHasBoilerCasing] = useState(false)
  const [standard, setStandard]         = useState<'budget' | 'standard' | 'premium' | ''>('')
  const [notes, setNotes]               = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: BathroomClarification = {}
    const numArea = parseFloat(area)
    if (!isNaN(numArea) && numArea > 0 && numArea < 200) data.area_m2 = numArea
    const numHeight = parseFloat(height)
    if (!isNaN(numHeight) && numHeight > 0 && numHeight < 10) data.ceiling_height_m = numHeight
    if (tileCoverage) data.tile_coverage = tileCoverage
    if (hasBathtub) data.has_bathtub = true
    if (hasShower) data.has_shower = true
    if (hasFloorHeating) data.has_underfloor_heating = true
    if (wcType) data.wc_type = wcType
    if (sinkCount) data.sink_count = sinkCount
    if (hasLinearDrain) data.has_linear_drain = true
    if (plumbingScope) data.plumbing_scope = plumbingScope
    if (electricalScope) data.electrical_scope = electricalScope
    if (hasBoilerCasing) data.has_boiler_casing = true
    if (standard) data.fixtures_standard = standard
    if (notes.trim()) data.notes = notes.trim().slice(0, 500)
    onSubmit(data)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 14,
    background: 'var(--color-bg-input, #2A2D32)', color: 'var(--color-text-primary, #E5E7EB)',
    border: '1px solid var(--color-border, #3A3D42)', borderRadius: 8,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--color-text-secondary, #A7ABB3)', marginBottom: 4,
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 8,
    cursor: disabled ? 'default' : 'pointer', transition: 'all .15s',
    background: active ? 'var(--color-primary-soft, rgba(59,130,246,.15))' : 'var(--color-bg-input, #2A2D32)',
    color: active ? 'var(--color-primary, #60A5FA)' : 'var(--color-text-secondary, #A7ABB3)',
    border: `1px solid ${active ? 'var(--color-primary, #60A5FA)' : 'var(--color-border, #3A3D42)'}`,
  })

  const roomLabel = roomType ? getRoomTypeName(roomType) : 'łazienki'

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24, maxWidth: 440, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>🔍 Szczegóły {roomLabel}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted, #8A8F98)' }}>
          Opcjonalne — pomaga AI lepiej dopasować zakres prac. {photoCount} {photoCount === 1 ? 'zdjęcie' : 'zdjęć'} gotowe.
        </p>
      </div>

      {/* Row: area + height */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Powierzchnia (m²)</label>
          <input type="number" step="0.1" min="0" max="200" placeholder="np. 5.5"
            value={area} onChange={e => setArea(e.target.value)} style={inputStyle} disabled={disabled} />
        </div>
        <div>
          <label style={labelStyle}>Wysokość (m)</label>
          <input type="number" step="0.1" min="1" max="10" placeholder="np. 2.6"
            value={height} onChange={e => setHeight(e.target.value)} style={inputStyle} disabled={disabled} />
        </div>
      </div>

      {/* Tile coverage */}
      <div>
        <label style={labelStyle}>Płytki na ścianach</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['full', 'Do sufitu'], ['partial', 'Częściowo'], ['none', 'Brak']] as const).map(([val, lbl]) => (
            <button key={val} type="button" disabled={disabled}
              style={chipStyle(tileCoverage === val)}
              onClick={() => setTileCoverage(tileCoverage === val ? '' : val)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Fixtures */}
      <div>
        <label style={labelStyle}>Wyposażenie</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" style={chipStyle(hasBathtub)} disabled={disabled}
            onClick={() => setHasBathtub(!hasBathtub)}>🛁 Wanna</button>
          <button type="button" style={chipStyle(hasShower)} disabled={disabled}
            onClick={() => setHasShower(!hasShower)}>🚿 Prysznic</button>
          <button type="button" style={chipStyle(hasFloorHeating)} disabled={disabled}
            onClick={() => setHasFloorHeating(!hasFloorHeating)}>♨️ Podłogówka</button>
          <button type="button" style={chipStyle(hasLinearDrain)} disabled={disabled}
            onClick={() => setHasLinearDrain(!hasLinearDrain)}>〰️ Odpływ liniowy</button>
        </div>
      </div>

      {/* WC type */}
      <div>
        <label style={labelStyle}>Typ WC</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['standing', 'Stojące (kompakt)'], ['concealed', 'Podtynkowe']] as const).map(([val, lbl]) => (
            <button key={val} type="button" disabled={disabled}
              style={chipStyle(wcType === val)}
              onClick={() => setWcType(wcType === val ? '' : val)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Row: sinks + boiler */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Umywalki</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {([1, 2] as const).map(n => (
              <button key={n} type="button" disabled={disabled}
                style={chipStyle(sinkCount === n)}
                onClick={() => setSinkCount(sinkCount === n ? '' : n)}>
                {n === 1 ? '1 umywalka' : '2 umywalki'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Kocioł / bojler</label>
          <button type="button" style={chipStyle(hasBoilerCasing)} disabled={disabled}
            onClick={() => setHasBoilerCasing(!hasBoilerCasing)}>
            🔥 Zabudowa
          </button>
        </div>
      </div>

      {/* Plumbing + electrical scope */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Przeróbki hydraul.</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {([['none', 'Brak'], ['limited', 'Częściowe'], ['full', 'Całość']] as const).map(([val, lbl]) => (
              <button key={val} type="button" disabled={disabled}
                style={chipStyle(plumbingScope === val)}
                onClick={() => setPlumbingScope(plumbingScope === val ? '' : val)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Przeróbki elektr.</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {([['none', 'Brak'], ['limited', 'Częściowe'], ['full', 'Całość']] as const).map(([val, lbl]) => (
              <button key={val} type="button" disabled={disabled}
                style={chipStyle(electricalScope === val)}
                onClick={() => setElectricalScope(electricalScope === val ? '' : val)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Standard */}
      <div>
        <label style={labelStyle}>Standard wykończenia</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['budget', 'Ekonomiczny'], ['standard', 'Standardowy'], ['premium', 'Premium']] as const).map(([val, lbl]) => (
            <button key={val} type="button" disabled={disabled}
              style={chipStyle(standard === val)}
              onClick={() => setStandard(standard === val ? '' : val)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={labelStyle}>Dodatkowe uwagi (opcjonalne)</label>
        <textarea
          rows={2} maxLength={500} placeholder="np. Pion kanalizacyjny do zabudowy, lustro na całą ścianę…"
          value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} disabled={disabled}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" className="btn btn-ghost" onClick={onSkip} disabled={disabled}
          style={{ flex: 1, fontSize: 14, padding: '12px 16px' }}>
          Pomiń →
        </button>
        <button type="submit" className="btn" disabled={disabled}
          style={{ flex: 2, fontSize: 14, padding: '12px 16px', fontWeight: 600 }}>
          🔍 Analizuj ze szczegółami
        </button>
      </div>
    </form>
  )
}
