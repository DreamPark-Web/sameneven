'use client'

import { useState, useEffect, useRef } from 'react'
import { useInsight } from '@/lib/insight-context'
import { useToast } from '@/lib/toast-context'
import { fmt, sum } from '@/lib/format'
import { PAGE_COLORS } from '@/lib/pageColors'

type Item = { id: string; label: string; value: number; excludeFromRatio?: boolean; createdAt?: string }

const panel: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22, display: 'flex', flexDirection: 'column' }
const panelHd: React.CSSProperties = { marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
      <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
      <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function PersonPanel({ name, items, onAdd, onDelete, onEdit, onReorder, canEdit }: {
  name: string; items: Item[]
  onAdd: (label: string, value: number, excludeFromRatio: boolean) => void
  onDelete: (id: string) => void
  onEdit: (id: string, label: string, value: number, excludeFromRatio: boolean) => void
  onReorder: (items: Item[]) => void
  canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [excludeFromRatio, setExcludeFromRatio] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAmt, setEditAmt] = useState('')
  const [editExclude, setEditExclude] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [isDark, setIsDark] = useState(false)
  const total = sum(items)
  const colors = PAGE_COLORS.inkomsten
  const c = isDark ? colors.dark : colors.light

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditAmt(String(item.value))
    setEditExclude(item.excludeFromRatio ?? false)
  }

  function saveEdit(item: Item) {
    onEdit(item.id, editLabel.trim() || item.label, parseFloat(editAmt) || item.value, editExclude)
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

  function submit() {
    if (!label.trim() || !value) return
    onAdd(label.trim(), parseFloat(value), excludeFromRatio)
    setLabel('')
    setValue('')
    setExcludeFromRatio(false)
    setOpen(false)
  }

  return (
    <div style={panel}>
      <div style={panelHd}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)' }}>{name}</span>
        </div>
        {canEdit && (
          <button className="btn-add" onClick={() => setOpen(!open)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>
            {open ? '− Post' : '+ Post'}
          </button>
        )}
      </div>

      {open && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
          <input
            autoFocus
            style={{ flex: 1, minWidth: 80, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
            placeholder="Omschrijving" value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') setOpen(false) }}
          />
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
            <input
              style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
              type="number" placeholder="Bedrag" value={value} onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') setOpen(false) }}
            />
          </div>
          <button className="btn-submit" onClick={submit}
            style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>
            Toevoegen
          </button>
          <button className="btn-cancel" onClick={() => setOpen(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>
            Annuleren
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', width: '100%', marginTop: 4 }}>
            <input type="checkbox" checked={excludeFromRatio} onChange={e => setExcludeFromRatio(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: c, cursor: 'pointer', flexShrink: 0 }} />
            Niet meerekenen in aandeelverdeling
            <span title="Gebruik dit voor vergoedingen, toeslagen of andere inkomsten die de 'naar rato'-verdeling niet mogen beïnvloeden. Het bedrag telt wel mee in het totaal inkomen." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', border: '1px solid var(--muted)', fontSize: 10, color: 'var(--muted)', cursor: 'help', flexShrink: 0, userSelect: 'none' }}>i</span>
          </label>
        </div>
      )}

      <div style={{ flex: 1 }}>
        {items.length === 0 && (
          <div style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${c}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, maxWidth: 200 }}>
              Voeg je eerste inkomstenbron toe om je financieel overzicht te starten.
            </div>
            {canEdit && (
              <button className="btn-submit" onClick={() => setOpen(true)}
                style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF', fontFamily: 'var(--font-body)' }}>
                + Inkomst toevoegen
              </button>
            )}
          </div>
        )}
        {items.map((item, idx) => (
          <div key={item.id}>
            {editingId === item.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: `1px solid ${c}`, borderRadius: 8, padding: '10px 12px', marginBottom: 2 }}>
                <input
                  autoFocus
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); else if (e.key === 'Escape') setEditingId(null) }}
                  style={{ flex: 1, minWidth: 80, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}
                />
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                  <input
                    type="number"
                    value={editAmt}
                    onChange={e => setEditAmt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); else if (e.key === 'Escape') setEditingId(null) }}
                    style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
                <button onClick={() => saveEdit(item)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Opslaan</button>
                <button onClick={() => setEditingId(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', width: '100%', marginTop: 4 }}>
                  <input type="checkbox" checked={editExclude} onChange={e => setEditExclude(e.target.checked)} style={{ width: 14, height: 14, accentColor: c, cursor: 'pointer', flexShrink: 0 }} />
                  Niet meerekenen in aandeelverdeling
                  <span title="Gebruik dit voor vergoedingen, toeslagen of andere inkomsten die de 'naar rato'-verdeling niet mogen beïnvloeden." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', border: '1px solid var(--muted)', fontSize: 10, color: 'var(--muted)', cursor: 'help', flexShrink: 0, userSelect: 'none' }}>i</span>
                </label>
              </div>
            ) : (
              <div
                draggable={canEdit}
                onDragStart={() => setDragging(idx)}
                onDragEnd={() => { setDragging(null); setDragOver(null) }}
                onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
                onDragLeave={() => setDragOver(d => d === idx ? null : d)}
                onDrop={() => handleDrop(idx)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', borderTop: dragOver === idx && dragging !== idx ? `2px solid ${c}` : '2px solid transparent', opacity: dragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
              >
                {canEdit && (
                  <span style={{ color: 'var(--muted)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <GripIcon />
                  </span>
                )}
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    {item.label}
                  </span>
                  {item.excludeFromRatio && (
                    <span title="Telt niet mee in aandeelverdeling" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>excl.</span>
                  )}
                </span>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                  <input
                    type="number"
                    key={item.id + '-' + item.value}
                    defaultValue={item.value}
                    disabled
                    style={{ width: 100, background: 'transparent', border: 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
                {canEdit && (
                  <>
                    <button onClick={() => startEdit(item)} style={{ width: 26, height: 26, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}><PencilIcon /></button>
                    <button className="btn-delete" onClick={() => onDelete(item.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 14 }}>
        <div style={{ background: colors.bgCard, border: `1px solid ${colors.bdCard}`, borderRadius: 8, padding: '15px 17px', marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal netto per maand</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: c }}>{fmt(total, 0)}</div>
        </div>
      </div>
    </div>
  )
}

export default function Inkomsten() {
  const { data, saveData, canEdit, isSingleUser } = useInsight()
  const { addToast, removeToast } = useToast()
  const [pendingDeletionIds, setPendingDeletionIds] = useState<Set<string>>(new Set())
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [isDarkMain, setIsDarkMain] = useState(false)
  const colors = PAGE_COLORS.inkomsten
  const c = isDarkMain ? colors.dark : colors.light
  useEffect(() => {
    const check = () => setIsDarkMain(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const u1: Item[] = data.user1?.income || []
  const u2: Item[] = data.user2?.income || []
  const u1Filtered = u1.filter(i => !pendingDeletionIds.has(i.id))
  const u2Filtered = u2.filter(i => !pendingDeletionIds.has(i.id))
  const t1 = sum(u1Filtered), t2 = sum(u2Filtered), total = t1 + t2
  const r1eligible = sum(u1Filtered.filter(i => !i.excludeFromRatio))
  const r2eligible = sum(u2Filtered.filter(i => !i.excludeFromRatio))
  const rTotal = r1eligible + r2eligible
  const r1 = rTotal ? (r1eligible / rTotal * 100).toFixed(1) + '%' : '—'
  const r2 = rTotal ? (r2eligible / rTotal * 100).toFixed(1) + '%' : '—'

  function addIncome(slot: 'user1' | 'user2', label: string, value: number, excludeFromRatio: boolean) {
    const item: Item = { id: slot + Date.now(), label, value, createdAt: new Date().toISOString(), ...(excludeFromRatio ? { excludeFromRatio: true } : {}) }
    const updated = { ...data }
    updated[slot] = { ...updated[slot], income: [...(updated[slot]?.income || []), item] }
    updated.inkomstenTs = new Date().toISOString()
    saveData(updated)
    const newTotal = sum([...(data[slot]?.income || []), item])
    addToast({ message: `${label} toegevoegd — totaal inkomen is nu ${fmt(newTotal, 0)}`, variant: 'success' })
  }
  function deleteIncome(slot: 'user1' | 'user2', id: string) {
    const item = (data[slot]?.income || []).find((i: Item) => i.id === id)
    if (!item) return
    setPendingDeletionIds(prev => new Set(prev).add(id))
    let toastId: string
    const undo = () => {
      clearTimeout(pendingTimers.current.get(id))
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
      removeToast(toastId)
    }
    toastId = addToast({ message: `${item.label} verwijderd`, variant: 'danger', duration: 5000, action: { label: 'Ongedaan maken', onClick: undo } })
    const timer = setTimeout(() => {
      const updated = { ...data }
      updated[slot] = { ...updated[slot], income: updated[slot].income.filter((i: Item) => i.id !== id) }
      updated.inkomstenTs = new Date().toISOString()
      saveData(updated)
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 5000)
    pendingTimers.current.set(id, timer)
  }
  function editIncome(slot: 'user1' | 'user2', id: string, label: string, value: number, excludeFromRatio: boolean) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], income: updated[slot].income.map((i: Item) => i.id === id ? { ...i, label, value, ...(excludeFromRatio ? { excludeFromRatio: true } : { excludeFromRatio: false }) } : i) }
    updated.inkomstenTs = new Date().toISOString()
    saveData(updated)
  }
  function reorderIncome(slot: 'user1' | 'user2', newItems: Item[]) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], income: newItems }
    updated.inkomstenTs = new Date().toISOString()
    saveData(updated)
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)', marginBottom: 20 }}>Inkomsten</div>
      <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <PersonPanel name={n1} items={u1Filtered} onAdd={(l, v, excl) => addIncome('user1', l, v, excl)} onDelete={id => deleteIncome('user1', id)} onEdit={(id, l, v, excl) => editIncome('user1', id, l, v, excl)} onReorder={items => reorderIncome('user1', items)} canEdit={canEdit('user1')} />
        {!isSingleUser && <PersonPanel name={n2} items={u2Filtered} onAdd={(l, v, excl) => addIncome('user2', l, v, excl)} onDelete={id => deleteIncome('user2', id)} onEdit={(id, l, v, excl) => editIncome('user2', id, l, v, excl)} onReorder={items => reorderIncome('user2', items)} canEdit={canEdit('user2')} />}
      </div>
      {!isSingleUser && <div style={panel}>
        <div style={panelHd}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Gecombineerd inkomen</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
          {[
            { label: 'Totaal gezamenlijk', val: fmt(total, 0), sub: 'per maand', color: c },
            { label: `Aandeel ${n1}`, val: r1, color: c },
            { label: `Aandeel ${n2}`, val: r2, color: c },
          ].map((s, i) => (
            <div key={i} style={{ background: colors.bgCard, border: `1px solid ${colors.bdCard}`, borderRadius: 8, padding: '15px 17px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: i === 0 ? 28 : 19, fontWeight: 700, lineHeight: 1, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', color: s.color }}>{s.val}</div>
              {s.sub && <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>}
    </div>
  )
}
