'use client'

import { useState, useEffect } from 'react'
import { useInsight } from '@/lib/insight-context'
import { fmt, sum } from '@/lib/format'
import { PAGE_COLORS } from '@/lib/pageColors'

type SavItem = { id: string; label: string; value: number }
type Pot = { id: string; label: string; current: number; goal: number; owner: string }

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
      <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
      <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
    </svg>
  )
}

function SavList({ items, can, openSav, setOpenSav, savForm, setSavForm, onAdd, onEditLabel, onEditValue, onDelete, onReorder, listKey }: {
  items: SavItem[]
  can: boolean
  openSav: string | null
  setOpenSav: (key: string | null) => void
  savForm: { label: string; value: string }
  setSavForm: (f: { label: string; value: string }) => void
  onAdd: (label: string, value: number) => void
  onEditLabel: (id: string, label: string) => void
  onEditValue: (id: string, value: number) => void
  onDelete: (id: string) => void
  onReorder: (newItems: SavItem[]) => void
  listKey: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  function commitLabel(item: SavItem) {
    const trimmed = editVal.trim()
    if (trimmed && trimmed !== item.label) onEditLabel(item.id, trimmed)
    setEditingId(null)
  }

  function submitForm() {
    if (!savForm.label.trim() || !savForm.value) return
    onAdd(savForm.label.trim(), parseFloat(savForm.value))
    setSavForm({ label: '', value: '' })
    setOpenSav(null)
  }

  function cancelForm() {
    setSavForm({ label: '', value: '' })
    setOpenSav(null)
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
    <div>
      {items.map((item, idx) => (
        <div
          key={item.id}
          draggable={can}
          onDragStart={() => setDragging(idx)}
          onDragEnd={() => { setDragging(null); setDragOver(null) }}
          onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
          onDragLeave={() => setDragOver(d => d === idx ? null : d)}
          onDrop={() => handleDrop(idx)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', borderTop: dragOver === idx && dragging !== idx ? '2px solid var(--accent)' : '2px solid transparent', opacity: dragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
        >
          {can && (
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
              style={{ flex: 1, fontSize: 13, background: 'var(--s3)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--text)', padding: '3px 7px', outline: 'none', fontFamily: 'var(--font-body)' }}
            />
          ) : (
            <span
              onClick={() => { if (!can) return; setEditingId(item.id); setEditVal(item.label) }}
              title={can ? 'Klik om te bewerken' : undefined}
              style={{ flex: 1, fontSize: 13, cursor: can ? 'text' : 'default', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {item.label}
            </span>
          )}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
            <input type="number" defaultValue={item.value} onBlur={e => onEditValue(item.id, parseFloat(e.target.value) || 0)} disabled={!can}
              style={{ width: 100, background: can ? 'var(--s2)' : 'transparent', border: can ? '1px solid var(--input-border)' : 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            />
          </div>
          {can && <button onClick={() => onDelete(item.id)} style={{ width: 22, height: 22, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>}
        </div>
      ))}
      {can && (
        openSav === listKey && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <input autoFocus style={{ flex: 1, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '5px 7px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
              placeholder="Omschrijving" value={savForm.label} onChange={e => setSavForm({ ...savForm, label: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') submitForm(); else if (e.key === 'Escape') cancelForm() }} />
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 12, pointerEvents: 'none', userSelect: 'none' }}>€</span>
              <input style={{ width: 80, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '5px 7px 5px 20px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                type="number" placeholder="Bedrag" value={savForm.value} onChange={e => setSavForm({ ...savForm, value: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') submitForm(); else if (e.key === 'Escape') cancelForm() }} />
            </div>
            <button className="btn-submit" onClick={submitForm}
              style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)' }}>OK</button>
            <button className="btn-delete" onClick={cancelForm}
              style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 5, cursor: 'pointer', background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)' }}>×</button>
          </div>
        )
      )}
    </div>
  )
}

export default function Sparen() {
  const { data, saveData, canEdit, isSingleUser } = useInsight()
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const editable = canEdit('user1') || canEdit('user2')

  const [potForm, setPotForm] = useState({ label: '', current: '', goal: '', owner: 'gezamenlijk' })
  const [openPotForm, setOpenPotForm] = useState(false)
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  const [openSav, setOpenSav] = useState<string | null>(null)
  const [savForm, setSavForm] = useState({ label: '', value: '' })
  const [editingPotId, setEditingPotId] = useState<string | null>(null)
  const [editPotVal, setEditPotVal] = useState('')
  const [potDragging, setPotDragging] = useState<number | null>(null)
  const [potDragOver, setPotDragOver] = useState<number | null>(null)

  const potten: Pot[] = data.spaarpotjes || []
  const u1sh: SavItem[] = data.user1?.savings?.shared || []
  const u1pr: SavItem[] = data.user1?.savings?.private || []
  const u2sh: SavItem[] = data.user2?.savings?.shared || []
  const u2pr: SavItem[] = data.user2?.savings?.private || []

  function addSavItem(slot: 'user1' | 'user2', type: 'shared' | 'private', label: string, value: number) {
    const item: SavItem = { id: slot + type + Date.now(), label, value }
    const updated = { ...data }
    updated[slot] = { ...updated[slot], savings: { ...updated[slot]?.savings, [type]: [...(updated[slot]?.savings?.[type] || []), item] } }
    saveData(updated)
  }
  function deleteSavItem(slot: 'user1' | 'user2', type: 'shared' | 'private', id: string) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], savings: { ...updated[slot]?.savings, [type]: updated[slot].savings[type].filter((i: SavItem) => i.id !== id) } }
    saveData(updated)
  }
  function editSavItem(slot: 'user1' | 'user2', type: 'shared' | 'private', id: string, value: number) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], savings: { ...updated[slot]?.savings, [type]: updated[slot].savings[type].map((i: SavItem) => i.id === id ? { ...i, value } : i) } }
    saveData(updated)
  }
  function editSavLabel(slot: 'user1' | 'user2', type: 'shared' | 'private', id: string, label: string) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], savings: { ...updated[slot]?.savings, [type]: updated[slot].savings[type].map((i: SavItem) => i.id === id ? { ...i, label } : i) } }
    saveData(updated)
  }
  function reorderSavItems(slot: 'user1' | 'user2', type: 'shared' | 'private', newItems: SavItem[]) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], savings: { ...updated[slot]?.savings, [type]: newItems } }
    saveData(updated)
  }
  function addPot() {
    if (!potForm.label.trim()) return
    const pot: Pot = { id: 'sp' + Date.now(), label: potForm.label.trim(), current: parseFloat(potForm.current) || 0, goal: parseFloat(potForm.goal) || 0, owner: potForm.owner }
    saveData({ ...data, spaarpotjes: [...potten, pot] })
    setPotForm({ label: '', current: '', goal: '', owner: 'gezamenlijk' })
    setOpenPotForm(false)
  }
  function deletePot(id: string) { saveData({ ...data, spaarpotjes: potten.filter(p => p.id !== id) }) }
  function editPot(id: string, field: string, val: string) {
    saveData({ ...data, spaarpotjes: potten.map(p => p.id === id ? { ...p, [field]: field === 'current' || field === 'goal' ? parseFloat(val) || 0 : val } : p) })
  }
  function reorderPotten(newPotten: Pot[]) {
    saveData({ ...data, spaarpotjes: newPotten })
  }
  function handlePotDrop(toIdx: number) {
    if (potDragging === null || potDragging === toIdx) return
    const next = [...potten]
    const [moved] = next.splice(potDragging, 1)
    next.splice(toIdx, 0, moved)
    reorderPotten(next)
    setPotDragging(null)
    setPotDragOver(null)
  }

  const panel: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
  const colors = PAGE_COLORS.sparen
  const c = isDark ? colors.dark : colors.light
  const totalBox: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--card-border)', borderTop: `1px solid ${c}`, borderRadius: 8, padding: '10px 12px' }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)', marginBottom: 20 }}>Sparen</div>
      <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        {[{ name: n1, slot: 'user1' as const, sh: u1sh, pr: u1pr, can: canEdit('user1') }, ...(!isSingleUser ? [{ name: n2, slot: 'user2' as const, sh: u2sh, pr: u2pr, can: canEdit('user2') }] : [])].map(({ name, slot, sh, pr, can }) => (
          <div key={slot} style={panel}>
            <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)' }}>{name}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr', gap: 16, flex: 1, alignItems: 'stretch' }}>
              {!isSingleUser && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 7, borderBottom: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-heading)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Gezamenlijk</span>
                    {can && <button className="btn-add" onClick={() => { setOpenSav(openSav === `${slot}-shared` ? null : `${slot}-shared`); setSavForm({ label: '', value: '' }) }} style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{openSav === `${slot}-shared` ? '− Toevoegen' : '+ Toevoegen'}</button>}
                  </div>
                  <SavList
                    items={sh} can={can} listKey={`${slot}-shared`}
                    openSav={openSav} setOpenSav={setOpenSav}
                    savForm={savForm} setSavForm={setSavForm}
                    onAdd={(label, value) => addSavItem(slot, 'shared', label, value)}
                    onEditLabel={(id, label) => editSavLabel(slot, 'shared', id, label)}
                    onEditValue={(id, value) => editSavItem(slot, 'shared', id, value)}
                    onDelete={id => deleteSavItem(slot, 'shared', id)}
                    onReorder={newItems => reorderSavItems(slot, 'shared', newItems)}
                  />
                </div>
              )}
              <div>
                {!isSingleUser && (
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 7, borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-heading)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Prive</span>
                    {can && <button className="btn-add" onClick={() => { setOpenSav(openSav === `${slot}-private` ? null : `${slot}-private`); setSavForm({ label: '', value: '' }) }} style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{openSav === `${slot}-private` ? '− Toevoegen' : '+ Toevoegen'}</button>}
                  </div>
                )}
                {isSingleUser && can && (
                  <div style={{ marginBottom: 8 }}>
                    <button className="btn-add" onClick={() => { setOpenSav(openSav === `${slot}-private` ? null : `${slot}-private`); setSavForm({ label: '', value: '' }) }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{openSav === `${slot}-private` ? '− Toevoegen' : '+ Toevoegen'}</button>
                  </div>
                )}
                <SavList
                  items={pr} can={can} listKey={`${slot}-private`}
                  openSav={openSav} setOpenSav={setOpenSav}
                  savForm={savForm} setSavForm={setSavForm}
                  onAdd={(label, value) => addSavItem(slot, 'private', label, value)}
                  onEditLabel={(id, label) => editSavLabel(slot, 'private', id, label)}
                  onEditValue={(id, value) => editSavItem(slot, 'private', id, value)}
                  onDelete={id => deleteSavItem(slot, 'private', id)}
                  onReorder={newItems => reorderSavItems(slot, 'private', newItems)}
                />
              </div>
            </div>
            {isSingleUser ? (
              <div style={{ ...totalBox, marginTop: 14 }}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: c, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(sum(sh) + sum(pr), 0)}</div></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Gezamenlijk</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: c, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(sum(sh), 0)}</div></div>
                <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Prive</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: c, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(sum(pr), 0)}</div></div>
                <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: c, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(sum(sh) + sum(pr), 0)}</div></div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={panel}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Spaardoelen</span>
          </div>
          {editable && (
            <button className="btn-add" onClick={() => setOpenPotForm(!openPotForm)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{openPotForm ? '− Spaarpot' : '+ Spaarpot'}</button>
          )}
        </div>
        {potten.map((pot, idx) => {
          const pct = pot.goal > 0 ? Math.min(1, pot.current / pot.goal) : 0
          const ownerLabel = pot.owner === 'user1' ? n1 : pot.owner === 'user2' ? n2 : 'Gezamenlijk'
          return (
            <div
              key={pot.id}
              draggable={editable}
              onDragStart={() => setPotDragging(idx)}
              onDragEnd={() => { setPotDragging(null); setPotDragOver(null) }}
              onDragOver={e => { e.preventDefault(); setPotDragOver(idx) }}
              onDragLeave={() => setPotDragOver(d => d === idx ? null : d)}
              onDrop={() => handlePotDrop(idx)}
              style={{ background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 6, padding: '15px 17px', marginBottom: 8, borderTop: potDragOver === idx && potDragging !== idx ? '2px solid var(--accent)' : '1px solid var(--border)', opacity: potDragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  {editable && (
                    <span style={{ color: 'var(--muted)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <GripIcon />
                    </span>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {editingPotId === pot.id ? (
                      <input
                        autoFocus
                        value={editPotVal}
                        onChange={e => setEditPotVal(e.target.value)}
                        onBlur={() => { const t = editPotVal.trim(); if (t && t !== pot.label) editPot(pot.id, 'label', t); setEditingPotId(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') setEditingPotId(null) }}
                        style={{ fontWeight: 600, fontSize: 13, background: 'var(--s3)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--text)', padding: '2px 6px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div
                          onClick={() => { if (!editable) return; setEditingPotId(pot.id); setEditPotVal(pot.label) }}
                          title={editable ? 'Klik om te bewerken' : undefined}
                          style={{ fontWeight: 600, fontSize: 13, cursor: editable ? 'text' : 'default' }}
                        >{pot.label}</div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 7px', borderRadius: 999, background: colors.bg, fontSize: 8, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c, border: `1px solid ${c}4D` }}>{ownerLabel}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {editable ? (
                    <>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 12, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                        <input type="number" defaultValue={pot.current} onBlur={e => editPot(pot.id, 'current', e.target.value)}
                          style={{ width: 90, background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '5px 8px 5px 21px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
                      </div>
                      <span style={{ color: 'var(--muted)', fontSize: 13 }}>/</span>
                      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(pot.goal, 0)}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(pot.current, 0)}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 13 }}>/</span>
                      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(pot.goal, 0)}</span>
                    </>
                  )}
                  {pot.goal > 0 && <span style={{ fontSize: 12, color: 'rgba(245,245,245,0.45)' }}>({(pct * 100).toFixed(0)}%)</span>}
                  {editable && <button className="btn-delete" onClick={() => deletePot(pot.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, marginLeft: 10 }}>×</button>}
                </div>
              </div>
              {pot.goal > 0 && (
                <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, width: `${(pct * 100).toFixed(2)}%`, background: c, transition: 'width .5s ease' }} />
                </div>
              )}
            </div>
          )
        })}
        {editable && openPotForm && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input style={{ flex: 2, minWidth: 120, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
                  placeholder="Naam spaarpot" value={potForm.label} onChange={e => setPotForm({ ...potForm, label: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') addPot(); else if (e.key === 'Escape') { setPotForm({ label: '', current: '', goal: '', owner: 'gezamenlijk' }); setOpenPotForm(false) } }} />
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                  <input style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                    type="number" placeholder="Huidig" value={potForm.current} onChange={e => setPotForm({ ...potForm, current: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') addPot(); else if (e.key === 'Escape') { setPotForm({ label: '', current: '', goal: '', owner: 'gezamenlijk' }); setOpenPotForm(false) } }} />
                </div>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                  <input style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                    type="number" placeholder="Doel" value={potForm.goal} onChange={e => setPotForm({ ...potForm, goal: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') addPot(); else if (e.key === 'Escape') { setPotForm({ label: '', current: '', goal: '', owner: 'gezamenlijk' }); setOpenPotForm(false) } }} />
                </div>
                {!isSingleUser && (
                  <select style={{ background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                    value={potForm.owner} onChange={e => setPotForm({ ...potForm, owner: e.target.value })}>
                    <option value="gezamenlijk">Gezamenlijk</option>
                    <option value="user1">{n1}</option>
                    <option value="user2">{n2}</option>
                  </select>
                )}
                <button className="btn-submit" onClick={addPot} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)' }}>Toevoegen</button>
                <button className="btn-cancel" onClick={() => { setPotForm({ label: '', current: '', goal: '', owner: 'gezamenlijk' }); setOpenPotForm(false) }} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', bottom: -50, right: -50, pointerEvents: 'none', zIndex: 0 }}>
        <svg width="300" height="300" viewBox="0 0 200 200">
          <polygon points="65,18 135,18 192,62 100,175 8,62" fill={c} opacity="0.06" />
          <polygon points="65,18 135,18 100,62" fill={c} opacity="0.1" />
        </svg>
      </div>
    </div>
  )
}
