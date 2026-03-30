'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type Sub = { id: string; name: string; date: string; amount: number; freq: string; person: string }

function fmt(n: number, d = 2) { return '€\u00a0' + n.toFixed(d).replace('.', ',') }
function subMonthly(s: Sub) {
  const a = s.amount || 0
  if (s.freq === 'kwartaal') return a / 3
  if (s.freq === 'jaarlijks') return a / 12
  return a
}
function daysUntil(dateStr: string) {
  if (!dateStr) return null
  const today = new Date()
  const next = new Date(dateStr)
  while (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.ceil((next.getTime() - today.getTime()) / 86400000)
}

const FREQL: Record<string, string> = { maandelijks: 'p/mnd', kwartaal: 'p/kwt', jaarlijks: 'p/jr' }

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
      <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
      <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
    </svg>
  )
}

function SubList({ items, editable, onDelete, onEdit, onReorder }: {
  items: Sub[]
  editable: boolean
  onDelete: (id: string) => void
  onEdit: (id: string, name: string) => void
  onReorder: (newItems: Sub[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  function commitName(sub: Sub) {
    const trimmed = editVal.trim()
    if (trimmed && trimmed !== sub.name) onEdit(sub.id, trimmed)
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

  if (items.length === 0) return null

  return (
    <>
      {items.map((sub, idx) => {
        const days = daysUntil(sub.date)
        const bc = days === null ? null : days <= 0 ? { bg: 'rgba(224,80,80,.12)', color: 'var(--danger)' } : days <= 14 ? { bg: 'rgba(224,80,80,.12)', color: 'var(--danger)' } : days <= 30 ? { bg: 'rgba(212,160,23,.12)', color: 'var(--warn)' } : { bg: 'rgba(76,175,130,.12)', color: 'var(--ok)' }
        const dateDisplay = sub.date ? new Date(sub.date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
        return (
          <div
            key={sub.id}
            draggable={editable}
            onDragStart={() => setDragging(idx)}
            onDragEnd={() => { setDragging(null); setDragOver(null) }}
            onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
            onDragLeave={() => setDragOver(d => d === idx ? null : d)}
            onDrop={() => handleDrop(idx)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 6, borderTop: dragOver === idx && dragging !== idx ? '2px solid var(--accent)' : undefined, opacity: dragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              {editable && (
                <span style={{ color: 'var(--muted)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <GripIcon />
                </span>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                {editingId === sub.id ? (
                  <input
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={() => commitName(sub)}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') setEditingId(null) }}
                    style={{ fontSize: 13, fontWeight: 600, background: 'var(--s3)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--text)', padding: '2px 6px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }}
                  />
                ) : (
                  <div
                    onClick={() => { if (!editable) return; setEditingId(sub.id); setEditVal(sub.name) }}
                    title={editable ? 'Klik om te bewerken' : undefined}
                    style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', cursor: editable ? 'text' : 'default' }}
                  >{sub.name}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(sub.amount, 2)}</span> {FREQL[sub.freq] || 'p/mnd'} · <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(subMonthly(sub), 2)}</span>/mnd · {dateDisplay}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {bc && days !== null && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 4, whiteSpace: 'nowrap', background: bc.bg, color: bc.color }}>{days <= 0 ? 'Verlopen' : `${days} dgn`}</span>}
              {editable && <button onClick={() => onDelete(sub.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default function Abonnementen() {
  const { data, saveData, canEdit, isSingleUser } = useInsight()
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const editable = canEdit('user1') || canEdit('user2')

  const subs: Sub[] = data.abonnementen || (data as any).subscriptions || []

  const [form, setForm] = useState({ name: '', date: '', amount: '', freq: 'maandelijks', person: isSingleUser ? 'user1' : 'gezamenlijk' })
  const [openForm, setOpenForm] = useState(false)

  function addSub() {
    if (!form.name.trim() || !form.date) return
    const sub: Sub = { id: 'sub' + Date.now(), name: form.name.trim(), date: form.date, amount: parseFloat(form.amount) || 0, freq: form.freq, person: form.person }
    saveData({ ...data, abonnementen: [...subs, sub] })
    setForm({ name: '', date: '', amount: '', freq: 'maandelijks', person: isSingleUser ? 'user1' : 'gezamenlijk' })
    setOpenForm(false)
  }
  function deleteSub(id: string) { saveData({ ...data, abonnementen: subs.filter(s => s.id !== id) }) }
  function editSub(id: string, name: string) {
    saveData({ ...data, abonnementen: subs.map(s => s.id === id ? { ...s, name } : s) })
  }
  function reorderSubs(person: string, newGroupItems: Sub[]) {
    let groupIdx = 0
    const result = subs.map(s => s.person !== person ? s : newGroupItems[groupIdx++])
    saveData({ ...data, abonnementen: result })
  }

  const panel: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
  const eyebrow: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text)' }

  const groups = isSingleUser
    ? [{ key: 'user1', title: n1 }]
    : [{ key: 'gezamenlijk', title: 'Gezamenlijk' }, { key: 'user1', title: n1 }, { key: 'user2', title: n2 }]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        {groups.map(g => {
          const groupItems = subs.filter(s => s.person === g.key)
          return (
            <div key={g.key} style={panel}>
              <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: g.key === 'gezamenlijk' ? '#F5F5F5' : 'var(--accent)', fontFamily: 'var(--font-heading)', display: 'block' }}>{g.title}</span>
                  <span style={{ ...eyebrow }}>Abonnementen</span>
                </div>
                {editable && !openForm && (
                  <button className="btn-add" onClick={() => { setForm({ ...form, person: g.key }); setOpenForm(true) }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(var(--accent-rgb), 0.4)', background: 'var(--s2)', color: 'var(--accent)' }}>+ Toevoegen</button>
                )}
              </div>
              <SubList
                items={groupItems}
                editable={editable}
                onDelete={deleteSub}
                onEdit={editSub}
                onReorder={newItems => reorderSubs(g.key, newItems)}
              />
              {groupItems.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted2)' }}>Geen abonnementen.</div>}
            </div>
          )
        })}
      </div>

      {editable && openForm && (
        <div style={panel}>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <span style={{ ...eyebrow }}>Toevoegen</span>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Nieuw abonnement</div>
          </div>
          <div style={{ background: 'var(--s1)', borderRadius: 8, padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input autoFocus style={{ flex: 2, minWidth: 120, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
                  placeholder="Naam" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input style={{ width: 160, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
                  type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                <input style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                  type="number" step="0.01" placeholder="Bedrag" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                <select style={{ background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                  value={form.freq} onChange={e => setForm({ ...form, freq: e.target.value })}>
                  <option value="maandelijks">Per maand</option>
                  <option value="kwartaal">Per kwartaal</option>
                  <option value="jaarlijks">Per jaar</option>
                </select>
                {!isSingleUser && (
                  <select style={{ background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                    value={form.person} onChange={e => setForm({ ...form, person: e.target.value })}>
                    <option value="gezamenlijk">Gezamenlijk</option>
                    <option value="user1">{n1}</option>
                    <option value="user2">{n2}</option>
                  </select>
                )}
                <button onClick={addSub} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)' }}>Toevoegen</button>
                <button onClick={() => setOpenForm(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
              </div>
            </div>
        </div>
      )}
    </div>
  )
}
