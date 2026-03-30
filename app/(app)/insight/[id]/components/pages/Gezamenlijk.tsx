'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type CostItem = { id: string; label: string; value: number; split: string; p1?: number; p2?: number }
function fmt(n: number, d = 2) { return '€\u00a0' + n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function sum(arr: any[]) { return (arr || []).reduce((a: number, i: any) => a + (i.value || 0), 0) }

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
      <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
      <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
    </svg>
  )
}

export default function Gezamenlijk() {
  const { data, saveData, canEdit, isSingleUser } = useInsight()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ label: '', value: '', split: 'ratio', p1: '50', p2: '50' })
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const items: CostItem[] = data.shared || []

  const u1Inc = sum(data.user1?.income || [])
  const u2Inc = sum(data.user2?.income || [])
  const totalInc = u1Inc + u2Inc
  const r1 = totalInc ? u1Inc / totalInc : 0.5
  const r2 = 1 - r1

  function splitVal(item: CostItem) {
    if (item.split === '5050') return { u1: item.value / 2, u2: item.value / 2 }
    if (item.split === 'user1') return { u1: item.value, u2: 0 }
    if (item.split === 'user2') return { u1: 0, u2: item.value }
    if (item.split === 'percent') {
      const pct1 = item.p1 ?? 50
      const pct2 = item.p2 ?? 50
      return { u1: item.value * pct1 / 100, u2: item.value * pct2 / 100 }
    }
    return { u1: item.value * r1, u2: item.value * r2 }
  }

  const u1Sh = sum(data.user1?.savings?.shared || [])
  const u2Sh = sum(data.user2?.savings?.shared || [])
  const totU1 = items.reduce((a, i) => a + splitVal(i).u1, 0)
  const totU2 = items.reduce((a, i) => a + splitVal(i).u2, 0)
  const jTr = totU1 + u1Sh, dTr = totU2 + u2Sh

  const editable = canEdit('user1') || canEdit('user2')
  const SPLITS: Record<string, string> = { ratio: 'Naar rato', '5050': '50/50', user1: n1, user2: n2, percent: 'Percentage' }

  function addItem() {
    if (!form.label.trim() || !form.value) return
    const item: CostItem = {
      id: 'sh' + Date.now(),
      label: form.label.trim(),
      value: parseFloat(form.value),
      split: form.split,
      ...(form.split === 'percent' ? { p1: parseFloat(form.p1) || 50, p2: parseFloat(form.p2) || 50 } : {}),
    }
    saveData({ ...data, shared: [...items, item] })
    setForm({ label: '', value: '', split: 'ratio', p1: '50', p2: '50' })
    setOpen(false)
  }

  function deleteItem(id: string) { saveData({ ...data, shared: items.filter(i => i.id !== id) }) }

  function editItem(id: string, field: 'label' | 'value' | 'split', val: string) {
    saveData({ ...data, shared: items.map(i => i.id === id ? { ...i, [field]: field === 'value' ? parseFloat(val) || 0 : val } : i) })
  }

  function editPercent(id: string, field: 'p1' | 'p2', val: string) {
    const raw = Math.max(0, Math.min(100, parseFloat(val) || 0))
    const item = items.find(i => i.id === id)
    if (!item) return
    const other = field === 'p1' ? (item.p2 ?? 50) : (item.p1 ?? 50)
    const clamped = raw + other > 100 ? 100 - other : raw
    saveData({ ...data, shared: items.map(i => i.id === id ? { ...i, [field]: clamped } : i) })
  }

  function reorderItems(newItems: CostItem[]) {
    saveData({ ...data, shared: newItems })
  }
  function handleDrop(toIdx: number) {
    if (dragging === null || dragging === toIdx) return
    const next = [...items]
    const [moved] = next.splice(dragging, 1)
    next.splice(toIdx, 0, moved)
    reorderItems(next)
    setDragging(null)
    setDragOver(null)
  }

  const panel: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
  const inputBase: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }
  const selectBase: React.CSSProperties = { ...inputBase, cursor: 'pointer', padding: '6px 8px' }
  const pctInput: React.CSSProperties = { ...inputBase, width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

  return (
    <div style={panel}>
      <div style={{ marginBottom: 12, paddingBottom: 0, borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Gezamenlijke vaste lasten</span>
        </div>
        {editable && (
          <button className="btn-add" onClick={() => setOpen(!open)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(var(--accent-rgb), 0.4)', background: 'var(--s2)', color: 'var(--accent)' }}>
            + Post
          </button>
        )}
      </div>

      {open && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <input autoFocus style={{ flex: 2, minWidth: 120, ...inputBase, background: 'var(--s3)', textAlign: 'left' }}
            placeholder="Omschrijving" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
          <input style={{ width: 100, ...inputBase, background: 'var(--s3)', textAlign: 'right' }}
            type="number" placeholder="Bedrag" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
          <select style={{ ...selectBase, background: 'var(--s3)', fontSize: 12 }}
            value={form.split} onChange={e => setForm({ ...form, split: e.target.value })}>
            <option value="ratio">Naar rato</option>
            <option value="5050">50/50</option>
            <option value="percent">Percentage</option>
            <option value="user1">{n1}</option>
            <option value="user2">{n2}</option>
          </select>
          {form.split === 'percent' && (
            <>
              <input type="number" min={0} max={100} style={{ ...pctInput, background: 'var(--s3)' }}
                placeholder={n1} value={form.p1}
                onChange={e => {
                  const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                  const p2 = v + parseFloat(form.p2) > 100 ? String(100 - v) : form.p2
                  setForm({ ...form, p1: String(v), p2 })
                }} />
              <input type="number" min={0} max={100} style={{ ...pctInput, background: 'var(--s3)' }}
                placeholder={n2} value={form.p2}
                onChange={e => {
                  const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                  const p1 = v + parseFloat(form.p1) > 100 ? String(100 - v) : form.p1
                  setForm({ ...form, p2: String(v), p1 })
                }} />
            </>
          )}
          <button onClick={addItem} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)' }}>Toevoegen</button>
          <button onClick={() => setOpen(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {editable && <th style={{ width: 20, padding: '6px 4px 8px' }}></th>}
              <th style={{ padding: '6px 8px 8px', minWidth: 180 }}></th>
              <th style={{ padding: '6px 8px 8px' }}></th>
              {!isSingleUser && <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', padding: '6px 8px 8px', textAlign: 'left' }}>Verdeling</th>}
              {!isSingleUser && <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)', padding: '6px 8px 8px', textAlign: 'right' }}>{n1}</th>}
              {!isSingleUser && <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)', padding: '6px 8px 8px', textAlign: 'right' }}>{n2}</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const { u1, u2 } = splitVal(item)
              return (
                <tr
                  key={item.id}
                  draggable={editable}
                  onDragStart={() => setDragging(idx)}
                  onDragEnd={() => { setDragging(null); setDragOver(null) }}
                  onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
                  onDragLeave={() => setDragOver(d => d === idx ? null : d)}
                  onDrop={() => handleDrop(idx)}
                  style={{ borderTop: dragOver === idx && dragging !== idx ? '2px solid var(--accent)' : '2px solid transparent', opacity: dragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
                >
                  {editable && (
                    <td style={{ padding: '7px 4px', verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'grab', color: 'var(--muted)' }}>
                      <GripIcon />
                    </td>
                  )}
                  <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {editable ? (
                      <input defaultValue={item.label} onBlur={e => editItem(item.id, 'label', e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', width: '100%', cursor: 'text' }}
                      />
                    ) : item.label}
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)', textAlign: 'right' }}>
                    {editable ? (
                      <input type="number" defaultValue={item.value} onBlur={e => editItem(item.id, 'value', e.target.value)}
                        style={{ width: 100, ...inputBase, background: 'var(--s2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                      />
                    ) : fmt(item.value)}
                  </td>
                  {!isSingleUser && (
                    <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      {editable ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select value={item.split} onChange={e => editItem(item.id, 'split', e.target.value)}
                            style={{ ...selectBase, background: 'var(--s3)', fontSize: 12 }}>
                            <option value="ratio">Naar rato</option>
                            <option value="5050">50/50</option>
                            <option value="percent">Percentage</option>
                            <option value="user1">{n1}</option>
                            <option value="user2">{n2}</option>
                          </select>
                          {item.split === 'percent' && (
                            <>
                              <input
                                key={item.id + '-p1-' + (item.p1 ?? 50)}
                                type="number" min={0} max={100}
                                defaultValue={item.p1 ?? 50}
                                onBlur={e => editPercent(item.id, 'p1', e.target.value)}
                                style={{ ...pctInput, background: 'var(--s2)' }}
                                title={n1 + ' %'}
                              />
                              <input
                                key={item.id + '-p2-' + (item.p2 ?? 50)}
                                type="number" min={0} max={100}
                                defaultValue={item.p2 ?? 50}
                                onBlur={e => editPercent(item.id, 'p2', e.target.value)}
                                style={{ ...pctInput, background: 'var(--s2)' }}
                                title={n2 + ' %'}
                              />
                            </>
                          )}
                        </div>
                      ) : SPLITS[item.split] || item.split}
                    </td>
                  )}
                  {!isSingleUser && <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)', textAlign: 'right', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(u1)}</td>}
                  {!isSingleUser && <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)', textAlign: 'right', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(u2)}</td>}
                  <td style={{ padding: '7px 8px', verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {editable && <button onClick={() => deleteItem(item.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', alignItems: 'stretch' }}>
        {isSingleUser ? (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--card-border)', borderTop: '1px solid var(--accent)', borderRadius: 8, padding: '15px 17px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal gezamenlijke lasten</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: 'var(--accent)' }}>{fmt(totU1 + totU2, 0)}</div>
          </div>
        ) : (
          [{ name: n1, tr: jTr, sh: totU1, sav: u1Sh }, { name: n2, tr: dTr, sh: totU2, sav: u2Sh }].map(({ name, tr, sh, sav }) => (
            <div key={name} style={{ background: 'var(--s2)', border: '1px solid var(--card-border)', borderTop: '1px solid var(--accent)', borderRadius: 8, padding: '15px 17px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>{name}</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(245,245,245,0.45)', marginTop: 2 }}>Totaal over te maken</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: 'var(--accent)' }}>{fmt(tr, 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>Lasten <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(sh, 0)}</span> + sparen <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(sav, 0)}</span></div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
