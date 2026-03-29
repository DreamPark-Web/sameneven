'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type Item = { id: string; label: string; value: number }
function fmt(n: number) { return '€\u00a0' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function sum(arr: Item[]) { return (arr || []).reduce((a, i) => a + i.value, 0) }

function PersonPanel({ name, items, onAdd, onDelete, onEdit, canEdit, colorLabel }: {
  name: string; items: Item[]; onAdd: (l: string, v: number) => void
  onDelete: (id: string) => void; onEdit: (id: string, l: string, v: number) => void
  canEdit: boolean; colorLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const total = sum(items)

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }}>
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>{name}</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Prive vaste lasten</span>
        </div>
        {canEdit && (
          <button onClick={() => setOpen(!open)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted2)' }}>+ Post</button>
        )}
      </div>
      {open && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <input style={{ flex: 1, minWidth: 80, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
            placeholder="Omschrijving" value={label} onChange={e => setLabel(e.target.value)} />
          <input style={{ width: 100, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
            type="number" placeholder="Bedrag" value={value} onChange={e => setValue(e.target.value)} />
          <button onClick={() => { if (!label.trim() || !value) return; onAdd(label.trim(), parseFloat(value)); setLabel(''); setValue(''); setOpen(false) }}
            style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#0a0a0a' }}>Toevoegen</button>
          <button onClick={() => setOpen(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--muted2)', border: '1px solid var(--border)' }}>Annuleren</button>
        </div>
      )}
      <div>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
            <span style={{ flex: 1, fontSize: 13 }}>{item.label}</span>
            <input type="number" defaultValue={item.value} onBlur={e => onEdit(item.id, item.label, parseFloat(e.target.value) || 0)} disabled={!canEdit}
              style={{ width: 100, background: canEdit ? 'var(--s2)' : 'transparent', border: canEdit ? '1px solid var(--border)' : 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
            {canEdit && <button onClick={() => onDelete(item.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Totaal</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ background: 'var(--s2)', borderRadius: 6, padding: '13px 15px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>Totaal prive {name}</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4, color: 'var(--accent)' }}>{fmt(total)}</div>
        </div>
      </div>
    </div>
  )
}

export default function Prive() {
  const { data, saveData, canEdit } = useInsight()
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  function addItem(slot: 'user1' | 'user2', label: string, value: number) {
    const item = { id: slot + Date.now(), label, value }
    const updated = { ...data }
    updated[slot] = { ...updated[slot], private: [...(updated[slot]?.private || []), item] }
    saveData(updated)
  }
  function deleteItem(slot: 'user1' | 'user2', id: string) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], private: updated[slot].private.filter((i: Item) => i.id !== id) }
    saveData(updated)
  }
  function editItem(slot: 'user1' | 'user2', id: string, label: string, value: number) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], private: updated[slot].private.map((i: Item) => i.id === id ? { ...i, label, value } : i) }
    saveData(updated)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <PersonPanel name={n1} items={data.user1?.private || []} onAdd={(l, v) => addItem('user1', l, v)} onDelete={id => deleteItem('user1', id)} onEdit={(id, l, v) => editItem('user1', id, l, v)} canEdit={canEdit('user1')} colorLabel={n1} />
      <PersonPanel name={n2} items={data.user2?.private || []} onAdd={(l, v) => addItem('user2', l, v)} onDelete={id => deleteItem('user2', id)} onEdit={(id, l, v) => editItem('user2', id, l, v)} canEdit={canEdit('user2')} colorLabel={n2} />
    </div>
  )
}
