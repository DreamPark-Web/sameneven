'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type CostItem = { id: string; label: string; value: number; split: string }
function fmt(n: number) { return '€\u00a0' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function sum(arr: any[]) { return (arr || []).reduce((a: number, i: any) => a + (i.value || 0), 0) }

export default function Gezamenlijk() {
  const { data, saveData, canEdit } = useInsight()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ label: '', value: '', split: 'ratio' })

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
    return { u1: item.value * r1, u2: item.value * r2 }
  }

  const u1Sh = sum(data.user1?.savings?.shared || [])
  const u2Sh = sum(data.user2?.savings?.shared || [])
  const totU1 = items.reduce((a, i) => a + splitVal(i).u1, 0)
  const totU2 = items.reduce((a, i) => a + splitVal(i).u2, 0)
  const jTr = totU1 + u1Sh, dTr = totU2 + u2Sh

  const editable = canEdit('user1') || canEdit('user2')
  const SPLITS: Record<string, string> = { ratio: 'Naar rato', '5050': '50/50', user1: n1, user2: n2 }

  function addItem() {
    if (!form.label.trim() || !form.value) return
    const item: CostItem = { id: 'sh' + Date.now(), label: form.label.trim(), value: parseFloat(form.value), split: form.split }
    saveData({ ...data, shared: [...items, item] })
    setForm({ label: '', value: '', split: 'ratio' })
    setOpen(false)
  }
  function deleteItem(id: string) { saveData({ ...data, shared: items.filter(i => i.id !== id) }) }
  function editItem(id: string, field: 'label' | 'value' | 'split', val: string) {
    saveData({ ...data, shared: items.map(i => i.id === id ? { ...i, [field]: field === 'value' ? parseFloat(val) || 0 : val } : i) })
  }

  const panel: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }

  return (
    <div style={panel}>
      <div style={{ marginBottom: 12, paddingBottom: 0, borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Maandelijks</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>Gezamenlijke vaste lasten</span>
        </div>
        {editable && (
          <button onClick={() => setOpen(!open)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted2)' }}>
            + Post
          </button>
        )}
      </div>

      {open && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <input style={{ flex: 2, minWidth: 120, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
            placeholder="Omschrijving" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
          <input style={{ width: 100, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
            type="number" placeholder="Bedrag" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
          <select style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
            value={form.split} onChange={e => setForm({ ...form, split: e.target.value })}>
            <option value="ratio">Naar rato</option>
            <option value="5050">50/50</option>
            <option value="user1">{n1}</option>
            <option value="user2">{n2}</option>
          </select>
          <button onClick={addItem} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#0a0a0a' }}>Toevoegen</button>
          <button onClick={() => setOpen(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--muted2)', border: '1px solid var(--border)' }}>Annuleren</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', padding: '6px 8px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', minWidth: 180 }}>Omschrijving</th>
              <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', padding: '6px 8px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Bedrag</th>
              <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', padding: '6px 8px 8px', borderBottom: '1px solid var(--border)' }}>Verdeling</th>
              <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)', padding: '6px 8px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{n1}</th>
              <th style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)', padding: '6px 8px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{n2}</th>
              <th style={{ borderBottom: '1px solid var(--border)' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const { u1, u2 } = splitVal(item)
              return (
                <tr key={item.id}>
                  <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {editable ? (
                      <input defaultValue={item.label} onBlur={e => editItem(item.id, 'label', e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', width: '100%', cursor: 'text', borderBottom: '1px dashed transparent' }}
                      />
                    ) : item.label}
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)', textAlign: 'right' }}>
                    {editable ? (
                      <input type="number" defaultValue={item.value} onBlur={e => editItem(item.id, 'value', e.target.value)}
                        style={{ width: 90, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '4px 6px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                      />
                    ) : fmt(item.value)}
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {editable ? (
                      <select value={item.split} onChange={e => editItem(item.id, 'split', e.target.value)}
                        style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '4px 6px', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                        <option value="ratio">Naar rato</option>
                        <option value="5050">50/50</option>
                        <option value="user1">{n1}</option>
                        <option value="user2">{n2}</option>
                      </select>
                    ) : SPLITS[item.split]}
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)', textAlign: 'right', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmt(u1)}</td>
                  <td style={{ padding: '7px 8px', fontSize: 13, verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)', textAlign: 'right', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmt(u2)}</td>
                  <td style={{ padding: '7px 8px', verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    {editable && <button onClick={() => deleteItem(item.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        {[{ name: n1, tr: jTr, sh: totU1, sav: u1Sh }, { name: n2, tr: dTr, sh: totU2, sav: u2Sh }].map(({ name, tr, sh, sav }) => (
          <div key={name} style={{ background: 'var(--s2)', borderRadius: 6, padding: '13px 15px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>{name}</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 2 }}>Totaal over te maken</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4, color: 'var(--accent)' }}>{fmt(tr)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>Lasten {fmt(sh)} + sparen {fmt(sav)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
