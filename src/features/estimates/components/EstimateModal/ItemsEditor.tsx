
import { useState } from 'react'
import { Button } from '@/shared/ui/Button/Button'
import { Input } from '@/shared/ui/Input/Input'
import { Select } from '@/shared/ui/Select/Select'
import { generateId } from '@/shared/lib/generateId'
import type { EstimateItem } from '@/entities/estimate/model'


export function ItemsEditor({ items, onChange }: { items: EstimateItem[]; onChange: (items: EstimateItem[]) => void }) {
  const [fastName, setFastName] = useState('')
  const [fastDescription, setFastDescription] = useState('')
  const [fastUnit, setFastUnit] = useState('szt')
  const [fastQty, setFastQty] = useState(1)
  const [fastNet, setFastNet] = useState(0)
  const [fastLabor, setFastLabor] = useState(0)
  const [fastVat, setFastVat] = useState(23)
  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<EstimateItem>>({})
  function startEdit(item: EstimateItem) {
    setEditId(item.id)
    setEditValues({ ...item })
  }
  function cancelEdit() {
    setEditId(null)
    setEditValues({})
  }
  function saveEdit() {
    if (!editId) return;
    onChange(items.map((item) => item.id === editId ? { ...item, ...editValues } as EstimateItem : item))
    setEditId(null)
    setEditValues({})
  }

  function patch(id: string, key: keyof EstimateItem, value: string) {
    onChange(items.map((item) => item.id === id ? { ...item, [key]: ['quantity','unit_price','vat_rate','sort_order'].includes(String(key)) ? Number(value) : value } : item))
  }
  function patchDescription(id: string, value: string) {
    onChange(items.map((item) => item.id === id ? { ...item, description: value } : item))
  }
  function addRow() {
    onChange([...items, { id: generateId(), name: 'Nowa pozycja', description: '', unit: 'kpl', quantity: 1, unit_price: 0, vat_rate: 23, sort_order: items.length + 1 }])
  }
  function removeRow(id: string) { onChange(items.filter((item) => item.id !== id).map((item, index) => ({ ...item, sort_order: index + 1 }))) }

  function fastAdd() {
    if (!fastName.trim()) return
    onChange([
      ...items,
      {
        id: generateId(),
        name: fastName,
        description: fastDescription,
        unit: fastUnit,
        quantity: fastQty,
        unit_price: fastNet + fastLabor,
        vat_rate: fastVat,
        sort_order: items.length + 1,
      },
    ])
    setFastName('')
    setFastDescription('')
    setFastUnit('szt')
    setFastQty(1)
    setFastNet(0)
    setFastLabor(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="card" style={{ background: '#f3fdf6', border: '1px solid #b6e6c9', padding: 12, marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 2, minWidth: 160 }}>
            <label style={{ fontSize: 12, color: '#333', marginBottom: 2 }}>Nazwa pozycji <span style={{color:'#ef4444'}}>*</span></label>
            <input
              className="input"
              placeholder="np. Montaż drzwi"
              aria-label="Nazwa pozycji (wymagana)"
              value={fastName}
              onChange={e => setFastName(e.target.value)}
              style={{ fontWeight: 600 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', width: 60 }}>
            <label style={{ fontSize: 12, color: '#333', marginBottom: 2 }}>j.m</label>
            <input
              className="input"
              placeholder="szt, m²"
              aria-label="j.m"
              value={fastUnit}
              onChange={e => setFastUnit(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', width: 120 }}>
            <label style={{ fontSize: 12, color: '#333', marginBottom: 2 }}>Materiał netto / j.m <span style={{color:'#ef4444'}}>*</span></label>
            <input
              className="input"
              placeholder="zł"
              aria-label="Materiał netto / j.m"
              type="number"
              value={String(fastNet)}
              onChange={e => setFastNet(Number(e.target.value))}
              style={{ fontWeight: 600 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', width: 120 }}>
            <label style={{ fontSize: 12, color: '#333', marginBottom: 2 }}>Robocizna netto</label>
            <input
              className="input"
              placeholder="zł"
              aria-label="Robocizna netto"
              type="number"
              value={String(fastLabor)}
              onChange={e => setFastLabor(Number(e.target.value))}
              style={{ fontWeight: 600 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', width: 70 }}>
            <label style={{ fontSize: 12, color: '#333', marginBottom: 2 }}>Ilość <span style={{color:'#ef4444'}}>*</span></label>
            <input
              className="input"
              placeholder="np. 1, 10"
              aria-label="Ilość"
              type="number"
              value={String(fastQty)}
              onChange={e => setFastQty(Number(e.target.value))}
              style={{ fontWeight: 600 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', width: 70 }}>
            <label style={{ fontSize: 12, color: '#333', marginBottom: 2 }}>VAT</label>
            <select
              className="input"
              aria-label="VAT"
              value={String(fastVat)}
              onChange={e => setFastVat(Number(e.target.value))}
              style={{ fontWeight: 600, height: 28, padding: '2px 6px' }}
            >
              <option value="23">23%</option>
              <option value="8">8%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 80 }}>
            <label style={{ fontSize: 12, color: 'transparent', marginBottom: 2 }}>Dodaj</label>
            <button className="btn btn--sm btn--primary" onClick={fastAdd} style={{ height: 38 }}>Dodaj</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <textarea
            className="input"
            placeholder="Opis, szczegóły, uwagi... (opcjonalnie)"
            aria-label="Opis pozycji"
            value={fastDescription}
            onChange={e => setFastDescription(e.target.value)}
            style={{ fontSize: 12, padding: '2px 6px', resize: 'vertical', minHeight: 18, flex: 1 }}
          />
        </div>
        {/* Usunięto tekst informacyjny na życzenie użytkownika */}
      </div>
      <div style={{overflowX:'auto', marginTop: 0}}>
        <table style={{width:'100%', borderCollapse:'separate', borderSpacing:'0 6px', marginTop:0}}>
          <thead>
            <tr style={{background:'none',fontWeight:600,fontSize:14}}>
              <th style={{padding:'4px 8px'}}>Poz.</th>
              <th style={{padding:'4px 8px'}}>j.m.</th>
              <th style={{padding:'4px 8px'}}>Il.</th>
              <th style={{padding:'4px 8px'}}>Netto</th>
              <th style={{padding:'4px 8px'}}>VAT</th>
              <th style={{padding:'4px 8px'}}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              editId === item.id ? (
                <>
                  <tr key={item.id} style={{background:'#f7f8fa', height: '36px', borderRadius: '8px', boxShadow: '0 1px 2px #e5e7eb'}}>
                    <td style={{padding:'7px 8px', minWidth:80, border:'none'}}>
                      <input className="input" value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} style={{width:'100%', height: 28, fontSize: 13, padding: '4px 8px', background:'#fcfcfd', border:'1px solid #e0e0e0', borderRadius: 6, outline:'none', boxShadow:'none'}} />
                    </td>
                    <td style={{padding:'7px 8px', border:'none'}}><input className="input" value={editValues.unit ?? ''} onChange={e => setEditValues(v => ({ ...v, unit: e.target.value }))} style={{width:40, height: 28, fontSize: 13, padding: '4px 8px', background:'#fcfcfd', border:'1px solid #e0e0e0', borderRadius: 6, outline:'none', boxShadow:'none'}} /></td>
                    <td style={{padding:'7px 8px', border:'none'}}><input className="input" type="number" value={String(editValues.quantity ?? '')} onChange={e => setEditValues(v => ({ ...v, quantity: Number(e.target.value) }))} style={{width:48, height: 28, fontSize: 13, padding: '4px 8px', background:'#fcfcfd', border:'1px solid #e0e0e0', borderRadius: 6, outline:'none', boxShadow:'none'}} /></td>
                    <td style={{padding:'7px 8px', border:'none'}}><input className="input" type="number" value={String(editValues.unit_price ?? '')} onChange={e => setEditValues(v => ({ ...v, unit_price: Number(e.target.value) }))} style={{width:80, height: 28, fontSize: 13, padding: '4px 8px', background:'#fcfcfd', border:'1px solid #e0e0e0', borderRadius: 6, outline:'none', boxShadow:'none'}} /></td>
                    <td style={{padding:'7px 8px', border:'none'}}>
                      <Select
                        className="input"
                        value={String(editValues.vat_rate ?? '')}
                        onChange={e => setEditValues(v => ({ ...v, vat_rate: Number(e.target.value) }))}
                        options={[
                          { value: '23', label: '23%' },
                          { value: '8', label: '8%' },
                          { value: '5', label: '5%' },
                          { value: '0', label: '0%' },
                        ]}
                        style={{ width: 54, height: 28, fontSize: 13, padding: '4px 8px', background:'#fcfcfd', border:'1px solid #e0e0e0', borderRadius: 6, outline:'none', boxShadow:'none' }}
                      />
                    </td>
                    <td style={{padding:'7px 8px', border:'none', display:'flex', gap:6, alignItems:'center', background:'none'}}>
                      <button className="btn btn--sm btn--primary" onClick={saveEdit} style={{minWidth:32, height: 28, fontSize: 13, padding: '2px 10px', borderRadius: 6, marginRight: 4}}>Zapisz</button>
                      <button className="btn btn--sm btn--ghost" onClick={cancelEdit} style={{minWidth:32, height: 28, fontSize: 13, padding: '2px 10px', borderRadius: 6}}>Anuluj</button>
                    </td>
                  </tr>
                  <tr key={item.id + '-desc'} style={{background:'none'}}>
                    <td colSpan={6} style={{padding:'2px 18px 8px 18px', fontSize:12, color:'#555', border:'none'}}>
                      <textarea className="input" value={editValues.description ?? ''} onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))} style={{width:'100%',minHeight:18,resize:'vertical',fontSize:12, marginTop:2, padding:'4px 8px', background:'#fcfcfd', border:'1px solid #e0e0e0', borderRadius:6}} placeholder="Opis, szczegóły, uwagi..." />
                    </td>
                  </tr>
                </>
              ) : (
                <>
                  <tr key={item.id} style={{background:'#fdf8f3', height: '36px'}}>
                    <td style={{padding:'7px 8px', minWidth:80, border:'none'}}>{item.name}</td>
                    <td style={{padding:'7px 8px', border:'none'}}>{item.unit}</td>
                    <td style={{padding:'7px 8px', border:'none'}}>{item.quantity}</td>
                    <td style={{padding:'7px 8px', border:'none'}}>{item.unit_price}</td>
                    <td style={{padding:'7px 8px', border:'none'}}>{item.vat_rate}%</td>
                    <td style={{padding:'7px 8px', border:'none'}}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button className="btn btn--sm btn--secondary" onClick={() => startEdit(item)} style={{minWidth:32, height: 26, fontSize: 13, padding: '2px 10px'}}>Edytuj</button>
                        <button className="btn btn--sm btn--secondary" onClick={() => removeRow(item.id)} style={{minWidth:32, height: 26, fontSize: 13, padding: '2px 10px'}}>Usuń</button>
                      </div>
                    </td>
                  </tr>
                  {item.description?.trim() && (
                    <tr key={item.id + '-desc'} style={{background:'none'}}>
                      <td colSpan={6} style={{padding:'2px 18px 8px 18px', fontSize:12, color:'#555', border:'none', background:'#fdf8f3'}}>
                        {item.description}
                      </td>
                    </tr>
                  )}
                </>
              )
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions-row" style={{marginTop:12}}><Button variant="secondary" onClick={addRow}>Dodaj pozycję</Button></div>
    </div>
  )
}
