'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type Item = { id: string; label: string; value: number }
function fmt(n: number, d = 2) { return '€\u00a0' + n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function sum(arr: Item[]) { return (arr || []).reduce((a, i) => a + i.value, 0) }

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
      <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
      <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
    </svg>
  )
}

function PersonPanel({ name, items, onAdd, onDelete, onEdit, onReorder, canEdit }: {
  name: string; items: Item[]
  onAdd: (label: string, value: number) => void
  onDelete: (id: string) => void
  onEdit: (id: string, label: string, value: number) => void
  onReorder: (items: Item[]) => void
  canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const total = sum(items)

  function commitLabel(item: Item) {
    const trimmed = editVal.trim()
    if (trimmed && trimmed !== item.label) onEdit(item.id, trimmed, item.value)
    setEditingId(null)
  }

  function handleDrop(toIdx: number) {
    if (dragging === null || dragging === toIdx) return
    const next = [...items]
    const [moved] = next.splice(dragging, 1)
    next.splice(toIdx, 0, moved)
    onReorder(next)
    setDragging(null)
    setDragOver(null)
  }

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
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable={canEdit}
            onDragStart={() => setDragging(idx)}
            onDragEnd={() => { setDragging(null); setDragOver(null) }}
            onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
            onDragLeave={() => setDragOver(d => d === idx ? null : d)}
            onDrop={() => handleDrop(idx)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', borderTop: dragOver === idx && dragging !== idx ? '2px solid var(--accent)' : '2px solid transparent', opacity: dragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
          >
            {canEdit && (
              <span style={{ color: 'var(--muted)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <GripIcon />
              </span>
            )}
            {editingId === item.id ? (
              <input
                autoFocus
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={() => commitLabel(item)}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') setEditingId(null) }}
                style={{ flex: 1, fontSize: 13, background: 'var(--s2)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--text)', padding: '3px 7px', outline: 'none', fontFamily: 'var(--font-body)' }}
              />
            ) : (
              <span
                onClick={() => { if (!canEdit) return; setEditingId(item.id); setEditVal(item.label) }}
                title={canEdit ? 'Klik om te bewerken' : undefined}
                style={{ flex: 1, fontSize: 13, cursor: canEdit ? 'text' : 'default', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {item.label}
              </span>
            )}
            <input
              type="number"
              defaultValue={item.value}
              onBlur={e => onEdit(item.id, editingId === item.id ? editVal.trim() || item.label : item.label, parseFloat(e.target.value) || 0)}
              disabled={!canEdit}
              style={{ width: 100, background: canEdit ? 'var(--s2)' : 'transparent', border: canEdit ? '1px solid var(--border)' : 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            />
            {canEdit && (
              <button onClick={() => onDelete(item.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
            )}
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
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: 'var(--accent)' }}>{fmt(total, 0)}</div>
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
  function reorderItem(slot: 'user1' | 'user2', newItems: Item[]) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], private: newItems }
    saveData(updated)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
      <PersonPanel name={n1} items={data.user1?.private || []} onAdd={(l, v) => addItem('user1', l, v)} onDelete={id => deleteItem('user1', id)} onEdit={(id, l, v) => editItem('user1', id, l, v)} onReorder={items => reorderItem('user1', items)} canEdit={canEdit('user1')} />
      <PersonPanel name={n2} items={data.user2?.private || []} onAdd={(l, v) => addItem('user2', l, v)} onDelete={id => deleteItem('user2', id)} onEdit={(id, l, v) => editItem('user2', id, l, v)} onReorder={items => reorderItem('user2', items)} canEdit={canEdit('user2')} />
    </div>
  )
}
