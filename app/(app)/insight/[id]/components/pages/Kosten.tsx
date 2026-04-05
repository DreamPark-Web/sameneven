'use client'

import { useState, useEffect, useRef } from 'react'
import { useInsight } from '@/lib/insight-context'
import { fmt, sum } from '@/lib/format'
import { PAGE_COLORS } from '@/lib/pageColors'
import { useToast } from '@/lib/toast-context'
import { buildAutoKosten, AutoKostItem, AutoKostSplits } from '@/lib/schuld-calc'

type CostItem = { id: string; label: string; value: number; split: string; p1?: number; p2?: number }
type Item = { id: string; label: string; value: number }
type Sub = { id: string; name: string; date: string; amount: number; freq: string; person: string; split?: string; p1?: number; p2?: number }
type Schuld = { id: string; naam: string; wie: string; balance: number; payment: number; rate: number; loanType?: string; looptijdMaanden?: number; entryDate?: string; rentePeriodes?: { id: string; startDate: string; endDate?: string; rate: number }[] }

function subMonthly(s: Sub) {
  const a = s.amount || 0
  if (s.freq === 'kwartaal') return a / 3
  if (s.freq === 'jaarlijks') return a / 12
  return a
}
function daysUntil(dateStr: string, freq: string) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(y, m - 1, d)
  while (next <= today) {
    if (freq === 'maandelijks') next.setMonth(next.getMonth() + 1)
    else if (freq === 'kwartaal') next.setMonth(next.getMonth() + 3)
    else next.setFullYear(next.getFullYear() + 1)
  }
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

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

type Colors = typeof PAGE_COLORS.kosten

const SUB_SPLITS: Record<string, string> = { ratio: 'Naar rato', '5050': '50/50', percent: 'Percentage', user1: '→ persoon 1', user2: '→ persoon 2' }

function SubList({ items, editable, c, onDelete, onEdit, onEditAmount, onEditFreq, onReorder, showSplit, n1, n2, r1, onEditSplit }: {
  items: Sub[]
  editable: boolean
  c: string
  onDelete: (id: string) => void
  onEdit: (id: string, name: string) => void
  onEditAmount: (id: string, amount: number) => void
  onEditFreq: (id: string, freq: string) => void
  onReorder: (newItems: Sub[]) => void
  showSplit?: boolean
  n1?: string
  n2?: string
  r1?: number
  onEditSplit?: (id: string, split: string, p1?: number, p2?: number) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmt, setEditAmt] = useState('')
  const [editFreq, setEditFreq] = useState('')
  const [editSplit, setEditSplit] = useState('5050')
  const [editP1, setEditP1] = useState('50')
  const [editP2, setEditP2] = useState('50')
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  function startEdit(sub: Sub) {
    setEditingId(sub.id)
    setEditName(sub.name)
    setEditAmt(String(sub.amount))
    setEditFreq(sub.freq)
    setEditSplit(sub.split || '5050')
    setEditP1(String(sub.p1 ?? 50))
    setEditP2(String(sub.p2 ?? 50))
  }
  function saveEdit(sub: Sub) {
    onEdit(sub.id, editName.trim() || sub.name)
    onEditAmount(sub.id, parseFloat(editAmt) || sub.amount)
    onEditFreq(sub.id, editFreq)
    if (showSplit) onEditSplit?.(sub.id, editSplit, editSplit === 'percent' ? parseFloat(editP1) || 50 : undefined, editSplit === 'percent' ? parseFloat(editP2) || 50 : undefined)
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
    <div style={{ flex: 1 }}>
      {items.map((sub, idx) => (
        <div key={sub.id}>
          {editingId === sub.id ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: `1px solid ${c}`, borderRadius: 8, padding: '10px 12px', marginBottom: 2 }}>
              <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(sub); else if (e.key === 'Escape') setEditingId(null) }}
                style={{ flex: 1, minWidth: 80, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }} />
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                <input type="number" value={editAmt} onChange={e => setEditAmt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(sub); else if (e.key === 'Escape') setEditingId(null) }}
                  style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
              </div>
              <select value={editFreq} onChange={e => setEditFreq(e.target.value)}
                style={{ background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                <option value="maandelijks">Per maand</option>
                <option value="kwartaal">Per kwartaal</option>
                <option value="jaarlijks">Per jaar</option>
              </select>
              {showSplit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <select value={editSplit} onChange={e => setEditSplit(e.target.value)}
                    style={{ background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                    <option value="ratio">Naar rato</option>
                    <option value="5050">50/50</option>
                    <option value="percent">Percentage</option>
                    <option value="user1">{n1}</option>
                    <option value="user2">{n2}</option>
                  </select>
                  {editSplit === 'percent' && (
                    <>
                      <input type="number" min={0} max={100} value={editP1} onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setEditP1(String(v)) }}
                        style={{ width: 58, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }} title={(n1 || '') + ' %'} />
                      <input type="number" min={0} max={100} value={editP2} onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setEditP2(String(v)) }}
                        style={{ width: 58, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }} title={(n2 || '') + ' %'} />
                    </>
                  )}
                </div>
              )}
              <button onClick={() => saveEdit(sub)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Opslaan</button>
              <button onClick={() => setEditingId(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
            </div>
          ) : (
            <div
              draggable={editable}
              onDragStart={() => setDragging(idx)}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
              onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
              onDragLeave={() => setDragOver(d => d === idx ? null : d)}
              onDrop={() => handleDrop(idx)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', borderTop: dragOver === idx && dragging !== idx ? `2px solid ${c}` : '2px solid transparent', opacity: dragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
            >
              {editable && <span style={{ color: 'var(--muted)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}><GripIcon /></span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{sub.name}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1, display: 'block' }}>
                  {FREQL[sub.freq] || 'p/mnd'}{sub.freq !== 'maandelijks' && sub.date ? ` · ${new Date(sub.date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}` : ''}
                </span>
              </div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                <input type="number" key={sub.id + '-' + sub.amount} defaultValue={sub.amount} disabled
                  style={{ width: 100, background: 'transparent', border: 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
              </div>
              {showSplit && (
                <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0, width: 90, textAlign: 'right', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SUB_SPLITS[sub.split || '5050']}</span>
              )}
              {editable && (
                <>
                  <button onClick={() => startEdit(sub)} style={{ width: 26, height: 26, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}><PencilIcon /></button>
                  <button className="btn-delete" onClick={() => onDelete(sub.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PersonPanel({ name, items, onAdd, onDelete, onEdit, onReorder, canEdit, colors, c, isDark }: {
  name: string; items: Item[]
  onAdd: (label: string, value: number) => void
  onDelete: (id: string) => void
  onEdit: (id: string, label: string, value: number) => void
  onReorder: (items: Item[]) => void
  canEdit: boolean
  colors: Colors
  c: string
  isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAmt, setEditAmt] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const total = sum(items)

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditAmt(String(item.value))
  }
  function saveEdit(item: Item) {
    onEdit(item.id, editLabel.trim() || item.label, parseFloat(editAmt) || item.value)
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
    onAdd(label.trim(), parseFloat(value))
    setLabel('')
    setValue('')
    setOpen(false)
  }

  return (
    <div style={{ background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)' }}>{name}</span>
        </div>
        {canEdit && (
          <button className="btn-add" onClick={() => setOpen(!open)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{open ? '− Post' : '+ Post'}</button>
        )}
      </div>
      {open && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
          <input autoFocus style={{ flex: 1, minWidth: 80, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
            placeholder="Omschrijving" value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') setOpen(false) }} />
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
            <input style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
              type="number" placeholder="Bedrag" value={value} onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') setOpen(false) }} />
          </div>
          <button className="btn-submit" onClick={submit} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Toevoegen</button>
          <button className="btn-cancel" onClick={() => setOpen(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
        </div>
      )}
      <div style={{ flex: 1 }}>
        {items.length === 0 && (
          <div style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${c}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, maxWidth: 200 }}>
              Nog geen vaste lasten toegevoegd.
            </div>
            {canEdit && (
              <button className="btn-submit" onClick={() => setOpen(true)}
                style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF', fontFamily: 'var(--font-body)' }}>
                + Kostenpost toevoegen
              </button>
            )}
          </div>
        )}
        {items.map((item, idx) => (
          <div key={item.id}>
            {editingId === item.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: `1px solid ${c}`, borderRadius: 8, padding: '10px 12px', marginBottom: 2 }}>
                <input autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); else if (e.key === 'Escape') setEditingId(null) }}
                  style={{ flex: 1, minWidth: 80, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }} />
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                  <input type="number" value={editAmt} onChange={e => setEditAmt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); else if (e.key === 'Escape') setEditingId(null) }}
                    style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
                </div>
                <button onClick={() => saveEdit(item)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Opslaan</button>
                <button onClick={() => setEditingId(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
              </div>
            ) : (
              <div draggable={canEdit}
                onDragStart={() => setDragging(idx)}
                onDragEnd={() => { setDragging(null); setDragOver(null) }}
                onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
                onDragLeave={() => setDragOver(d => d === idx ? null : d)}
                onDrop={() => handleDrop(idx)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', borderTop: dragOver === idx && dragging !== idx ? `2px solid ${c}` : '2px solid transparent', opacity: dragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
              >
                {canEdit && <span style={{ color: 'var(--muted)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}><GripIcon /></span>}
                <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                  <input type="number" key={item.id + '-' + item.value} defaultValue={item.value} disabled
                    style={{ width: 100, background: 'transparent', border: 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
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
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal prive {name}</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: c }}>{fmt(total, 0)}</div>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { id: 'gezamenlijk', label: 'Gezamenlijk' },
  { id: 'prive', label: 'Privé' },
  { id: 'abonnementen', label: 'Abonnementen' },
]

export default function Kosten() {
  const { data, saveData, canEdit, isSingleUser, household } = useInsight()
  const { addToast, removeToast } = useToast()
  const [pendingDeletionIds, setPendingDeletionIds] = useState<Set<string>>(new Set())
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const colors = PAGE_COLORS.kosten
  const [isDark, setIsDark] = useState(false)
  const c = isDark ? colors.dark : colors.light

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return isSingleUser ? 'prive' : 'gezamenlijk'
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    const valid = isSingleUser ? ['prive', 'abonnementen'] : ['gezamenlijk', 'prive', 'abonnementen']
    return tab && valid.includes(tab) ? tab : (isSingleUser ? 'prive' : 'gezamenlijk')
  })
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  function handleTabChange(tab: string) {
    setActiveTab(tab)
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tab)
    window.history.replaceState(null, '', `?${params.toString()}`)
  }

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  // ─── Auto kosten uit schulden ────────────────────────────────────────────────
  const schulden = (data.schulden as Schuld[] || [])
  const autoKostenSplits = (data.autoKostenSplits as AutoKostSplits | undefined) || {}
  const autoItems: AutoKostItem[] = buildAutoKosten(schulden, autoKostenSplits)

  const [autoEditItemId, setAutoEditItemId] = useState<string | null>(null)
  const [autoEditSplit, setAutoEditSplit] = useState('5050')
  const [autoEditP1, setAutoEditP1] = useState('50')
  const [autoEditP2, setAutoEditP2] = useState('50')

  function startAutoEdit(itemId: string) {
    const cfg = autoKostenSplits[itemId] || { split: '5050' }
    setAutoEditItemId(itemId)
    setAutoEditSplit(cfg.split)
    setAutoEditP1(String(cfg.p1 ?? 50))
    setAutoEditP2(String(cfg.p2 ?? 50))
  }
  function saveAutoSplit() {
    if (!autoEditItemId) return
    const splits: AutoKostSplits = { ...autoKostenSplits, [autoEditItemId]: { split: autoEditSplit, ...(autoEditSplit === 'percent' ? { p1: parseFloat(autoEditP1) || 50, p2: parseFloat(autoEditP2) || 50 } : {}) } }
    saveData({ ...data, autoKostenSplits: splits, kostenTs: new Date().toISOString() })
    setAutoEditItemId(null)
  }

  const hid = household?.id || 'local'
  const [autoPromptDismissed, setAutoPromptDismissed] = useState(() => {
    try { return !!localStorage.getItem(`se_auto_kp_${hid}`) } catch { return false }
  })
  function dismissAutoPrompt(deleteManual: boolean, manualIds: string[]) {
    try { localStorage.setItem(`se_auto_kp_${hid}`, '1') } catch {}
    setAutoPromptDismissed(true)
    if (deleteManual) {
      const newShared = (data.shared as CostItem[] || []).filter(i => !manualIds.includes(i.id))
      saveData({ ...data, shared: newShared, kostenTs: new Date().toISOString() })
    }
  }

  // ─── Gezamenlijk state ──────────────────────────────────────────────────────
  const [gOpen, setGOpen] = useState(false)
  const [gForm, setGForm] = useState({ label: '', value: '', split: 'ratio', p1: '50', p2: '50' })
  const [gDragging, setGDragging] = useState<number | null>(null)
  const [gDragOver, setGDragOver] = useState<number | null>(null)
  const [gEditId, setGEditId] = useState<string | null>(null)
  const [gEditLabel, setGEditLabel] = useState('')
  const [gEditValue, setGEditValue] = useState('')
  const [gEditSplit, setGEditSplit] = useState('ratio')
  const [gEditP1, setGEditP1] = useState('50')
  const [gEditP2, setGEditP2] = useState('50')

  const items: CostItem[] = data.shared || []
  const gItems = items.filter(i => !pendingDeletionIds.has(i.id))
  const u1Inc = sum(data.user1?.income || [])
  const u2Inc = sum(data.user2?.income || [])
  const totalInc = u1Inc + u2Inc
  const r1 = totalInc ? u1Inc / totalInc : 0.5
  const r2 = 1 - r1
  function splitVal(item: CostItem | AutoKostItem) {
    if (item.split === '5050') return { u1: item.value / 2, u2: item.value / 2 }
    if (item.split === 'user1') return { u1: item.value, u2: 0 }
    if (item.split === 'user2') return { u1: 0, u2: item.value }
    if (item.split === 'percent') {
      const pct1 = (item as CostItem).p1 ?? 50
      const pct2 = (item as CostItem).p2 ?? 50
      return { u1: item.value * pct1 / 100, u2: item.value * pct2 / 100 }
    }
    return { u1: item.value * r1, u2: item.value * r2 }
  }
  const u1Sh = sum(data.user1?.savings?.shared || [])
  const u2Sh = sum(data.user2?.savings?.shared || [])
  const totU1Manual = items.reduce((a, i) => a + splitVal(i).u1, 0)
  const totU2Manual = items.reduce((a, i) => a + splitVal(i).u2, 0)
  const totU1Auto = autoItems.reduce((a, i) => a + splitVal(i).u1, 0)
  const totU2Auto = autoItems.reduce((a, i) => a + splitVal(i).u2, 0)
  const totU1 = totU1Manual + totU1Auto
  const totU2 = totU2Manual + totU2Auto
  const jTr = totU1 + u1Sh, dTr = totU2 + u2Sh

  const MORTGAGE_KEYWORDS = ['hypotheek', 'rente', 'afloss', 'mortgage']
  const autoSchuldNamen = [...new Set(autoItems.map(a => a.schuldNaam.toLowerCase()))]
  const similarManualItems = !isSingleUser ? gItems.filter(i => {
    const lower = i.label.toLowerCase()
    return autoSchuldNamen.some(n => lower.includes(n)) || MORTGAGE_KEYWORDS.some(kw => lower.includes(kw))
  }) : []
  const editable = canEdit('user1') || canEdit('user2')
  const SPLITS: Record<string, string> = { ratio: 'Naar rato', '5050': '50/50', user1: n1, user2: n2, percent: 'Percentage' }

  function addItem() {
    if (!gForm.label.trim() || !gForm.value) return
    const item: CostItem = {
      id: 'sh' + Date.now(),
      label: gForm.label.trim(),
      value: parseFloat(gForm.value),
      split: gForm.split,
      ...(gForm.split === 'percent' ? { p1: parseFloat(gForm.p1) || 50, p2: parseFloat(gForm.p2) || 50 } : {}),
    }
    saveData({ ...data, shared: [...items, item], kostenTs: new Date().toISOString() })
    addToast({ message: `${item.label} toegevoegd`, variant: 'success' })
    setGForm({ label: '', value: '', split: 'ratio', p1: '50', p2: '50' })
    setGOpen(false)
  }
  function deleteItem(id: string) {
    const item = items.find(i => i.id === id)
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
      saveData({ ...data, shared: items.filter(i => i.id !== id), kostenTs: new Date().toISOString() })
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 5000)
    pendingTimers.current.set(id, timer)
  }
  function reorderItems(newItems: CostItem[]) { saveData({ ...data, shared: newItems, kostenTs: new Date().toISOString() }) }
  function handleGDrop(toIdx: number) {
    if (gDragging === null || gDragging === toIdx) return
    const next = [...items]
    const [moved] = next.splice(gDragging, 1)
    next.splice(toIdx, 0, moved)
    reorderItems(next)
    setGDragging(null)
    setGDragOver(null)
  }
  function startGEdit(item: CostItem) {
    setGEditId(item.id)
    setGEditLabel(item.label)
    setGEditValue(String(item.value))
    setGEditSplit(item.split || 'ratio')
    setGEditP1(String(item.p1 ?? 50))
    setGEditP2(String(item.p2 ?? 50))
  }
  function saveGEdit(item: CostItem) {
    const newLabel = gEditLabel.trim() || item.label
    const newValue = parseFloat(gEditValue) || item.value
    const updated: CostItem = { ...item, label: newLabel, value: newValue, split: gEditSplit, ...(gEditSplit === 'percent' ? { p1: parseFloat(gEditP1) || 50, p2: parseFloat(gEditP2) || 50 } : {}) }
    saveData({ ...data, shared: items.map(i => i.id === item.id ? updated : i), kostenTs: new Date().toISOString() })
    setGEditId(null)
  }

  // ─── Prive state ────────────────────────────────────────────────────────────
  function addPriveItem(slot: 'user1' | 'user2', label: string, value: number) {
    const item = { id: slot + Date.now(), label, value }
    const updated = { ...data }
    updated[slot] = { ...updated[slot], private: [...(updated[slot]?.private || []), item] }
    saveData({ ...updated, kostenTs: new Date().toISOString() })
    addToast({ message: `${label} toegevoegd`, variant: 'success' })
  }
  function deletePriveItem(slot: 'user1' | 'user2', id: string) {
    const item = (data[slot]?.private || []).find((i: Item) => i.id === id)
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
      updated[slot] = { ...updated[slot], private: updated[slot].private.filter((i: Item) => i.id !== id) }
      saveData({ ...updated, kostenTs: new Date().toISOString() })
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 5000)
    pendingTimers.current.set(id, timer)
  }
  function editPriveItem(slot: 'user1' | 'user2', id: string, label: string, value: number) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], private: updated[slot].private.map((i: Item) => i.id === id ? { ...i, label, value } : i) }
    saveData({ ...updated, kostenTs: new Date().toISOString() })
  }
  function reorderPriveItem(slot: 'user1' | 'user2', newItems: Item[]) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], private: newItems }
    saveData({ ...updated, kostenTs: new Date().toISOString() })
  }

  // ─── Abonnementen state ─────────────────────────────────────────────────────
  const subs: Sub[] = data.abonnementen || []
  const subsFiltered = subs.filter(s => !pendingDeletionIds.has(s.id))
  const [aForm, setAForm] = useState({ name: '', date: '', amount: '', freq: 'maandelijks', person: isSingleUser ? 'user1' : 'gezamenlijk' })
  const [aOpenForm, setAOpenForm] = useState(false)

  function addSub() {
    if (!aForm.name.trim()) return
    if (aForm.freq !== 'maandelijks' && !aForm.date) return
    let date = aForm.date
    if (aForm.freq === 'maandelijks') {
      const now = new Date()
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      date = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
    }
    const sub: Sub & { createdAt: string } = { id: 'sub' + Date.now(), name: aForm.name.trim(), date, amount: parseFloat(aForm.amount) || 0, freq: aForm.freq, person: aForm.person, createdAt: new Date().toISOString() }
    saveData({ ...data, abonnementen: [...subs, sub], kostenTs: new Date().toISOString() })
    setAForm({ name: '', date: '', amount: '', freq: 'maandelijks', person: isSingleUser ? 'user1' : 'gezamenlijk' })
    setAOpenForm(false)
    const totalMonthly = [...subs, sub].reduce((a, s) => a + (s.freq === 'jaarlijks' ? s.amount/12 : s.freq === 'kwartaal' ? s.amount/3 : s.amount), 0)
    addToast({ message: `${sub.name} toegevoegd — totaal abonnementen ${fmt(totalMonthly, 0)}/mnd`, variant: 'success' })
  }
  function deleteSub(id: string) {
    const sub = subs.find(s => s.id === id)
    if (!sub) return
    setPendingDeletionIds(prev => new Set(prev).add(id))
    let toastId: string
    const undo = () => {
      clearTimeout(pendingTimers.current.get(id))
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
      removeToast(toastId)
    }
    toastId = addToast({ message: `${sub.name} verwijderd`, variant: 'danger', duration: 5000, action: { label: 'Ongedaan maken', onClick: undo } })
    const timer = setTimeout(() => {
      saveData({ ...data, abonnementen: subs.filter(s => s.id !== id), kostenTs: new Date().toISOString() })
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 5000)
    pendingTimers.current.set(id, timer)
  }
  function editSub(id: string, name: string) {
    saveData({ ...data, abonnementen: subs.map(s => s.id === id ? { ...s, name } : s), kostenTs: new Date().toISOString() })
  }
  function editSubAmount(id: string, amount: number) {
    saveData({ ...data, abonnementen: subs.map(s => s.id === id ? { ...s, amount } : s), kostenTs: new Date().toISOString() })
  }
  function editSubSplit(id: string, split: string, p1?: number, p2?: number) {
    saveData({ ...data, abonnementen: subs.map(s => s.id === id ? { ...s, split, ...(split === 'percent' ? { p1: p1 ?? 50, p2: p2 ?? 50 } : {}) } : s), kostenTs: new Date().toISOString() })
  }
  function editSubFreq(id: string, freq: string) {
    saveData({ ...data, abonnementen: subs.map(s => s.id === id ? { ...s, freq } : s), kostenTs: new Date().toISOString() })
  }
  function subSplitMonthly(s: Sub): { u1: number; u2: number } {
    const m = subMonthly(s)
    const sp = s.split || '5050'
    if (sp === 'user1') return { u1: m, u2: 0 }
    if (sp === 'user2') return { u1: 0, u2: m }
    if (sp === 'percent') return { u1: m * (s.p1 ?? 50) / 100, u2: m * (s.p2 ?? 50) / 100 }
    if (sp === 'ratio') return { u1: m * r1, u2: m * r2 }
    return { u1: m / 2, u2: m / 2 }
  }
  function reorderSubs(person: string, newGroupItems: Sub[]) {
    let groupIdx = 0
    const result = subs.map(s => s.person !== person ? s : newGroupItems[groupIdx++])
    saveData({ ...data, abonnementen: result, kostenTs: new Date().toISOString() })
  }

  // ─── Shared styles ──────────────────────────────────────────────────────────
  const panel: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
  const inputBase: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }
  const selectBase: React.CSSProperties = { ...inputBase, cursor: 'pointer', padding: '6px 8px' }
  const pctInput: React.CSSProperties = { ...inputBase, width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)', marginBottom: 20 }}>Kosten</div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {TABS.filter(tab => !isSingleUser || tab.id !== 'gezamenlijk').map(tab => {
          const isActive = activeTab === tab.id
          const isHovered = hoveredTab === tab.id
          return (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', transition: 'all .15s', border: isActive ? 'none' : isHovered ? `1px solid ${isDark ? colors.dark : colors.light}4D` : '1px solid var(--border)', background: isActive ? (isDark ? colors.dark : colors.light) : isHovered ? (isDark ? `${colors.dark}26` : `${colors.light}26`) : 'transparent', color: isActive ? '#FFFFFF' : isHovered ? (isDark ? colors.dark : colors.light) : 'var(--muted)' }}
            >{tab.label}</button>
          )
        })}
      </div>

      {activeTab === 'gezamenlijk' && (
        <div style={panel}>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)' }}>Gezamenlijk</span>
            {editable && (
              <button className="btn-add" onClick={() => setGOpen(!gOpen)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>
                {gOpen ? '− Post' : '+ Post'}
              </button>
            )}
          </div>
          {gOpen && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
              <input autoFocus style={{ flex: 2, minWidth: 120, ...inputBase, background: 'var(--s3)', textAlign: 'left' }}
                placeholder="Omschrijving" value={gForm.label} onChange={e => setGForm({ ...gForm, label: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') addItem(); else if (e.key === 'Escape') setGOpen(false) }} />
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                <input style={{ width: 100, ...inputBase, background: 'var(--s3)', textAlign: 'right', padding: '6px 9px 6px 22px' }}
                  type="number" placeholder="Bedrag" value={gForm.value} onChange={e => setGForm({ ...gForm, value: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') addItem(); else if (e.key === 'Escape') setGOpen(false) }} />
              </div>
              <select style={{ ...selectBase, background: 'var(--s3)', fontSize: 12 }} value={gForm.split} onChange={e => setGForm({ ...gForm, split: e.target.value })}>
                <option value="ratio">Naar rato</option>
                <option value="5050">50/50</option>
                <option value="percent">Percentage</option>
                <option value="user1">{n1}</option>
                <option value="user2">{n2}</option>
              </select>
              {gForm.split === 'percent' && (
                <>
                  <input type="number" min={0} max={100} style={{ ...pctInput, background: 'var(--s3)' }} placeholder={n1} value={gForm.p1}
                    onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); const p2 = v + parseFloat(gForm.p2) > 100 ? String(100 - v) : gForm.p2; setGForm({ ...gForm, p1: String(v), p2 }) }}
                    onKeyDown={e => { if (e.key === 'Enter') addItem(); else if (e.key === 'Escape') setGOpen(false) }} />
                  <input type="number" min={0} max={100} style={{ ...pctInput, background: 'var(--s3)' }} placeholder={n2} value={gForm.p2}
                    onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); const p1 = v + parseFloat(gForm.p1) > 100 ? String(100 - v) : gForm.p1; setGForm({ ...gForm, p2: String(v), p1 }) }}
                    onKeyDown={e => { if (e.key === 'Enter') addItem(); else if (e.key === 'Escape') setGOpen(false) }} />
                </>
              )}
              <button className="btn-submit" onClick={addItem} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Toevoegen</button>
              <button className="btn-cancel" onClick={() => setGOpen(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
            </div>
          )}
          <div style={{ flex: 1 }}>
            {autoItems.length > 0 && !isSingleUser && !autoPromptDismissed && similarManualItems.length > 0 && (
              <div style={{ background: `${c}12`, border: `1px solid ${c}40`, borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, marginBottom: 8 }}>
                  We hebben automatische posten toegevoegd vanuit je schulden. Je hebt mogelijk handmatige posten die je kunt verwijderen:{' '}
                  <span style={{ color: c, fontWeight: 600 }}>{similarManualItems.map(i => i.label).join(', ')}</span>. Wil je deze verwijderen?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => dismissAutoPrompt(true, similarManualItems.map(i => i.id))}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>
                    Verwijder handmatige posten
                  </button>
                  <button onClick={() => dismissAutoPrompt(false, [])}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>
                    Behoud beide
                  </button>
                </div>
              </div>
            )}
            {autoItems.length > 0 && !isSingleUser && autoItems.map(item => {
              const isEditing = autoEditItemId === item.id
              if (isEditing) {
                return (
                  <div key={item.id + '-edit'} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: `1px solid ${c}`, borderRadius: 8, padding: '10px 12px', marginBottom: 2 }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.label}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: c, background: `${c}20`, border: `1px solid ${c}40`, borderRadius: 3, padding: '1px 5px' }}>AUTO</span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginTop: 1 }}>Verdeling aanpassen — bedrag wordt automatisch berekend</span>
                    </div>
                    <select value={autoEditSplit} onChange={e => setAutoEditSplit(e.target.value)}
                      style={{ ...selectBase, background: 'var(--s3)', fontSize: 13 }}>
                      <option value="5050">50/50</option>
                      <option value="ratio">Naar rato</option>
                      <option value="user1">{n1}</option>
                      <option value="user2">{n2}</option>
                      <option value="percent">Percentage</option>
                    </select>
                    {autoEditSplit === 'percent' && (
                      <>
                        <input type="number" min={0} max={100} value={autoEditP1} onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setAutoEditP1(String(v)) }}
                          style={{ ...pctInput, background: 'var(--s3)' }} title={n1 + ' %'} />
                        <input type="number" min={0} max={100} value={autoEditP2} onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setAutoEditP2(String(v)) }}
                          style={{ ...pctInput, background: 'var(--s3)' }} title={n2 + ' %'} />
                      </>
                    )}
                    <button onClick={saveAutoSplit} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Opslaan</button>
                    <button onClick={() => setAutoEditItemId(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
                  </div>
                )
              }
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: c, background: `${c}20`, border: `1px solid ${c}40`, borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>AUTO</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginTop: 1 }}>Automatisch berekend vanuit Schulden · updates maandelijks</span>
                  </div>
                  <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                    <input type="number" key={item.id} defaultValue={item.value} disabled
                      style={{ width: 100, background: 'transparent', border: 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0, width: 90, textAlign: 'right', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SPLITS[item.split] || item.split}</span>
                  {editable && (
                    <button onClick={() => startAutoEdit(item.id)} style={{ width: 26, height: 26, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}><PencilIcon /></button>
                  )}
                  <div style={{ width: 26, flexShrink: 0 }} />
                </div>
              )
            })}
            {gItems.length === 0 && autoItems.length === 0 && !gOpen && (
              <div style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${c}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, maxWidth: 220 }}>
                  Nog geen gezamenlijke kosten toegevoegd.
                </div>
                {editable && (
                  <button className="btn-submit" onClick={() => setGOpen(true)}
                    style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF', fontFamily: 'var(--font-body)' }}>
                    + Kostenpost toevoegen
                  </button>
                )}
              </div>
            )}
            {gItems.map((item, idx) => {
              if (gEditId === item.id) {
                return (
                  <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: `1px solid ${c}`, borderRadius: 8, padding: '10px 12px', marginBottom: 2 }}>
                    <input autoFocus value={gEditLabel} onChange={e => setGEditLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveGEdit(item); else if (e.key === 'Escape') setGEditId(null) }}
                      style={{ flex: 1, minWidth: 80, ...inputBase, background: 'var(--s3)' }} />
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                      <input type="number" value={gEditValue} onChange={e => setGEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveGEdit(item); else if (e.key === 'Escape') setGEditId(null) }}
                        style={{ width: 100, ...inputBase, background: 'var(--s3)', textAlign: 'right', padding: '6px 9px 6px 22px', fontVariantNumeric: 'tabular-nums' }} />
                    </div>
                    {!isSingleUser && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <select value={gEditSplit} onChange={e => setGEditSplit(e.target.value)}
                          style={{ ...selectBase, background: 'var(--s3)', fontSize: 13 }}>
                          <option value="ratio">Naar rato</option>
                          <option value="5050">50/50</option>
                          <option value="percent">Percentage</option>
                          <option value="user1">{n1}</option>
                          <option value="user2">{n2}</option>
                        </select>
                        {gEditSplit === 'percent' && (
                          <>
                            <input type="number" min={0} max={100} value={gEditP1} onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setGEditP1(String(v)) }}
                              onKeyDown={e => { if (e.key === 'Enter') saveGEdit(item); else if (e.key === 'Escape') setGEditId(null) }}
                              style={{ ...pctInput, background: 'var(--s3)' }} title={n1 + ' %'} />
                            <input type="number" min={0} max={100} value={gEditP2} onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setGEditP2(String(v)) }}
                              onKeyDown={e => { if (e.key === 'Enter') saveGEdit(item); else if (e.key === 'Escape') setGEditId(null) }}
                              style={{ ...pctInput, background: 'var(--s3)' }} title={n2 + ' %'} />
                          </>
                        )}
                      </div>
                    )}
                    <button onClick={() => saveGEdit(item)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Opslaan</button>
                    <button onClick={() => setGEditId(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
                  </div>
                )
              }
              return (
                <div key={item.id} draggable={editable}
                  onDragStart={() => setGDragging(idx)}
                  onDragEnd={() => { setGDragging(null); setGDragOver(null) }}
                  onDragOver={e => { e.preventDefault(); setGDragOver(idx) }}
                  onDragLeave={() => setGDragOver(d => d === idx ? null : d)}
                  onDrop={() => handleGDrop(idx)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)', borderTop: gDragOver === idx && gDragging !== idx ? `2px solid ${c}` : '2px solid transparent', opacity: gDragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
                >
                  {editable && <span style={{ color: 'var(--muted)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}><GripIcon /></span>}
                  <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                  <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                    <input type="number" key={item.id + '-' + item.value} defaultValue={item.value} disabled
                      style={{ width: 100, background: 'transparent', border: 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
                  </div>
                  {!isSingleUser && <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0, width: 90, textAlign: 'right', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SPLITS[item.split] || item.split}</span>}
                  {editable && (
                    <>
                      <button onClick={() => startGEdit(item)} style={{ width: 26, height: 26, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}><PencilIcon /></button>
                      <button className="btn-delete" onClick={() => deleteItem(item.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', alignItems: 'stretch' }}>
            {isSingleUser ? (
              <div style={{ background: colors.bgCard, border: `1px solid ${colors.bdCard}`, borderRadius: 8, padding: '15px 17px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal gezamenlijke lasten</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: c }}>{fmt(totU1 + totU2, 0)}</div>
              </div>
            ) : (
              [{ name: n1, sh: totU1 }, { name: n2, sh: totU2 }].map(({ name, sh }) => (
                <div key={name} style={{ background: colors.bgCard, border: `1px solid ${colors.bdCard}`, borderRadius: 8, padding: '15px 17px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: c }}>{name}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 2 }}>Aandeel gezamenlijke kosten</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: c }}>{fmt(sh, 0)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'prive' && (
        <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'stretch' }}>
          <PersonPanel name={n1} items={(data.user1?.private || []).filter((i: Item) => !pendingDeletionIds.has(i.id))} onAdd={(l, v) => addPriveItem('user1', l, v)} onDelete={id => deletePriveItem('user1', id)} onEdit={(id, l, v) => editPriveItem('user1', id, l, v)} onReorder={newItems => reorderPriveItem('user1', newItems)} canEdit={canEdit('user1')} colors={colors} c={c} isDark={isDark} />
          {!isSingleUser && <PersonPanel name={n2} items={(data.user2?.private || []).filter((i: Item) => !pendingDeletionIds.has(i.id))} onAdd={(l, v) => addPriveItem('user2', l, v)} onDelete={id => deletePriveItem('user2', id)} onEdit={(id, l, v) => editPriveItem('user2', id, l, v)} onReorder={newItems => reorderPriveItem('user2', newItems)} canEdit={canEdit('user2')} colors={colors} c={c} isDark={isDark} />}
        </div>
      )}

      {activeTab === 'abonnementen' && (() => {
        const aGroups = isSingleUser
          ? [{ key: 'user1', title: n1 }]
          : [{ key: 'gezamenlijk', title: 'Gezamenlijk' }, { key: 'user1', title: n1 }, { key: 'user2', title: n2 }]
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
              {aGroups.map(g => {
                const groupItems = subsFiltered.filter(s => s.person === g.key)
                return (
                  <div key={g.key} style={{ ...panel, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)' }}>{g.title}</span>
                      {editable && (
                        <button className="btn-add" onClick={() => { if (aOpenForm && aForm.person === g.key) { setAOpenForm(false) } else { setAForm({ ...aForm, person: g.key }); setAOpenForm(true) } }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{aOpenForm && aForm.person === g.key ? '− Post' : '+ Post'}</button>
                      )}
                    </div>
                    {aOpenForm && aForm.person === g.key && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                        <input autoFocus style={{ flex: 2, minWidth: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}
                          placeholder="Naam" value={aForm.name} onChange={e => setAForm({ ...aForm, name: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') addSub(); else if (e.key === 'Escape') setAOpenForm(false) }} />
                        {aForm.freq !== 'maandelijks' && (
                          <input style={{ width: 150, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}
                            type="date" value={aForm.date} onChange={e => setAForm({ ...aForm, date: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') addSub(); else if (e.key === 'Escape') setAOpenForm(false) }} />
                        )}
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                          <input style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                            type="number" step="0.01" placeholder="Bedrag" value={aForm.amount} onChange={e => setAForm({ ...aForm, amount: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') addSub(); else if (e.key === 'Escape') setAOpenForm(false) }} />
                        </div>
                        <select style={{ background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                          value={aForm.freq} onChange={e => setAForm({ ...aForm, freq: e.target.value })}>
                          <option value="maandelijks">Per maand</option>
                          <option value="kwartaal">Per kwartaal</option>
                          <option value="jaarlijks">Per jaar</option>
                        </select>
                        <button className="btn-submit" onClick={addSub} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Toevoegen</button>
                        <button className="btn-cancel" onClick={() => setAOpenForm(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
                      </div>
                    )}
                    {groupItems.length === 0 && !aOpenForm && (
                      <div style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${c}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
                          </svg>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, maxWidth: 200 }}>Houd bij welke abonnementen jullie hebben en wanneer ze verlopen.</div>
                        {editable && <button className="btn-submit" onClick={() => { setAForm({ ...aForm, person: g.key }); setAOpenForm(true) }} style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF', fontFamily: 'var(--font-body)' }}>+ Abonnement toevoegen</button>}
                      </div>
                    )}
                    <SubList items={groupItems} editable={editable} c={c} onDelete={deleteSub} onEdit={editSub} onEditAmount={editSubAmount} onEditFreq={editSubFreq} onReorder={newItems => reorderSubs(g.key, newItems)} showSplit={g.key === 'gezamenlijk' && !isSingleUser} n1={n1} n2={n2} r1={r1} onEditSplit={editSubSplit} />
                    <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                      {g.key === 'gezamenlijk' && !isSingleUser ? (() => {
                        const gU1 = groupItems.reduce((a, s) => a + subSplitMonthly(s).u1, 0)
                        const gU2 = groupItems.reduce((a, s) => a + subSplitMonthly(s).u2, 0)
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                            <div style={{ background: colors.bgCard, border: `1px solid ${colors.bdCard}`, borderRadius: 8, padding: '15px 17px' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>{n1}</div>
                              <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: c }}>{fmt(gU1, 0)}</div>
                            </div>
                            <div style={{ background: colors.bgCard, border: `1px solid ${colors.bdCard}`, borderRadius: 8, padding: '15px 17px' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>{n2}</div>
                              <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: c }}>{fmt(gU2, 0)}</div>
                            </div>
                            <div style={{ background: colors.bgCard, border: `1px solid ${colors.bdCard}`, borderRadius: 8, padding: '15px 17px' }}>
                              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal</div>
                              <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: c }}>{fmt(gU1 + gU2, 0)}</div>
                            </div>
                          </div>
                        )
                      })() : (
                        <div style={{ background: colors.bgCard, border: `1px solid ${colors.bdCard}`, borderRadius: 8, padding: '15px 17px', marginTop: 14 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal per maand</div>
                          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: c }}>{fmt(groupItems.reduce((a, s) => a + subMonthly(s), 0), 0)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      })()}

    </div>
  )
}
