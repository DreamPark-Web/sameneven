'use client'

import { useState, useEffect, useRef } from 'react'
import { useInsight } from '@/lib/insight-context'
import { fmt, fmtK, sum } from '@/lib/format'
import { PAGE_COLORS } from '@/lib/pageColors'
import { useToast } from '@/lib/toast-context'

type SavItem = { id: string; label: string; value: number; split?: string; p1?: number; p2?: number }
type Pot = { id: string; label: string; current: number; goal: number; owner: string; createdAt?: string; updatedAt?: string }
type LoanType = 'annuitair' | 'lineair' | 'aflossingsvrij' | 'overig'
type RentePeriode = { id: string; startDate: string; endDate?: string; rate: number }
type Schuld = { id: string; naam: string; type: string; wie: string; balance: number; payment: number; rate: number; fixedYears: number; fixedStart: string; createdAt?: string; loanType?: LoanType; looptijdMaanden?: number; entryDate?: string; rentePeriodes?: RentePeriode[] }

function msBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (86400000 * 365.25 / 12)))
}

function maandenTussen(van: Date, tot: Date): number {
  return Math.max(0, (tot.getFullYear() - van.getFullYear()) * 12 + (tot.getMonth() - van.getMonth()))
}

function calcMonths(bal: number, pay: number, rate: number) {
  if (!bal || !pay || pay <= 0) return null
  const r = rate / 100 / 12
  if (r === 0) return Math.ceil(bal / pay)
  if (pay <= bal * r) return Infinity
  return Math.ceil(-Math.log(1 - (r * bal / pay)) / Math.log(1 + r))
}

function getActivePeriode(sc: Schuld, atDate: Date): RentePeriode | null {
  const periodes = sc.rentePeriodes
  if (!periodes || periodes.length === 0) return null
  const sorted = [...periodes].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  for (const p of sorted) {
    const start = new Date(p.startDate)
    const end = p.endDate ? new Date(p.endDate) : null
    if (atDate >= start && (!end || atDate < end)) return p
  }
  return sorted[sorted.length - 1]
}

function calcRemainingBalance(sc: Schuld, targetDate: Date): number {
  const loanType = sc.loanType || 'overig'
  const entry = sc.entryDate ? new Date(sc.entryDate) : null
  const n = sc.looptijdMaanden
  if (!entry || !n) return sc.balance
  if (loanType === 'aflossingsvrij') return sc.balance

  const periodes = sc.rentePeriodes && sc.rentePeriodes.length > 0
    ? [...sc.rentePeriodes].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    : null

  if (!periodes) {
    const r = sc.rate / 100 / 12
    const k = Math.max(0, maandenTussen(entry, targetDate) - 1)
    if (k === 0) return sc.balance
    if (loanType === 'annuitair') {
      if (r === 0) return Math.max(0, sc.balance - k * (sc.balance / n))
      const ann = sc.balance * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      return Math.max(0, sc.balance * Math.pow(1 + r, k) - ann * (Math.pow(1 + r, k) - 1) / r)
    }
    if (loanType === 'lineair') return Math.max(0, sc.balance - k * (sc.balance / n))
    return Math.max(0, sc.balance - k * (sc.payment || 0))
  }

  if (loanType !== 'annuitair' && loanType !== 'lineair') {
    const k = Math.max(0, maandenTussen(entry, targetDate) - 1)
    return Math.max(0, sc.balance - k * (sc.payment || 0))
  }

  let balance = sc.balance
  let cursor = new Date(entry)
  const loanEnd = new Date(entry)
  loanEnd.setMonth(loanEnd.getMonth() + n)

  for (let i = 0; i < periodes.length; i++) {
    const p = periodes[i]
    const periodeEnd = p.endDate ? new Date(p.endDate) : (periodes[i + 1] ? new Date(periodes[i + 1].startDate) : targetDate)
    const segmentEnd = periodeEnd < targetDate ? periodeEnd : targetDate
    if (segmentEnd <= cursor) { cursor = segmentEnd; continue }
    const rawK = i === 0 ? maandenTussen(cursor, segmentEnd) - 1 : maandenTussen(cursor, segmentEnd)
    const k = Math.max(0, rawK)
    if (k <= 0) { cursor = segmentEnd; continue }
    const r = p.rate / 100 / 12
    const remainingMonths = Math.max(1, msBetween(cursor, loanEnd))
    if (loanType === 'annuitair') {
      if (r === 0) {
        balance = Math.max(0, balance - k * (sc.balance / n))
      } else {
        const ann = balance * (r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1)
        balance = Math.max(0, balance * Math.pow(1 + r, k) - ann * (Math.pow(1 + r, k) - 1) / r)
      }
    } else {
      balance = Math.max(0, balance - k * (sc.balance / n))
    }
    cursor = segmentEnd
    if (cursor >= targetDate) break
  }

  return Math.max(0, balance)
}

function calcMonthlyPayment(sc: Schuld): number | null {
  const loanType = sc.loanType || 'overig'
  const n = sc.looptijdMaanden
  if (!n) return null
  const today = new Date()
  const activePeriode = getActivePeriode(sc, today)
  const rate = activePeriode ? activePeriode.rate : sc.rate
  const r = rate / 100 / 12
  const rem = calcRemainingBalance(sc, today)
  const entry = sc.entryDate ? new Date(sc.entryDate) : null
  const remMonths = entry ? Math.max(1, n - msBetween(entry, today)) : n
  if (loanType === 'annuitair') {
    if (r === 0) return rem / remMonths
    return rem * (r * Math.pow(1 + r, remMonths)) / (Math.pow(1 + r, remMonths) - 1)
  }
  if (loanType === 'lineair') {
    return (sc.balance / n) + rem * r
  }
  return null
}

const LOAN_TYPES: { value: LoanType; label: string }[] = [
  { value: 'annuitair', label: 'Annuïtair' },
  { value: 'lineair', label: 'Lineair' },
  { value: 'aflossingsvrij', label: 'Aflossingsvrij' },
  { value: 'overig', label: 'Overig' },
]

const STYPES = ['studieschuld', 'hypotheek', 'persoonlijke lening', 'creditcard', 'overig']

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

type Colors = typeof PAGE_COLORS.vermogen

const SAV_SPLITS: Record<string, string> = { ratio: 'Naar rato', '5050': '50/50', percent: 'Percentage', user1: '→ persoon 1', user2: '→ persoon 2' }

function SavList({ items, can, c, onSaveEdit, onDelete, onReorder, showSplit, n1, n2, r1 }: {
  items: SavItem[]
  can: boolean
  c: string
  onSaveEdit: (id: string, label: string, value: number, split?: string, p1?: number, p2?: number) => void
  onDelete: (id: string) => void
  onReorder: (newItems: SavItem[]) => void
  showSplit?: boolean
  n1?: string
  n2?: string
  r1?: number
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAmt, setEditAmt] = useState('')
  const [editSplit, setEditSplit] = useState('5050')
  const [editP1, setEditP1] = useState('50')
  const [editP2, setEditP2] = useState('50')
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  function startEdit(item: SavItem) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditAmt(String(item.value))
    setEditSplit(item.split || '5050')
    setEditP1(String(item.p1 ?? 50))
    setEditP2(String(item.p2 ?? 50))
  }
  function saveEdit(item: SavItem) {
    const newLabel = editLabel.trim() || item.label
    const newValue = parseFloat(editAmt) || item.value
    if (showSplit) {
      onSaveEdit(item.id, newLabel, newValue, editSplit, editSplit === 'percent' ? parseFloat(editP1) || 50 : undefined, editSplit === 'percent' ? parseFloat(editP2) || 50 : undefined)
    } else {
      onSaveEdit(item.id, newLabel, newValue)
    }
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
    <div>
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
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); else if (e.key === 'Escape') setEditingId(null) }}
                        style={{ width: 58, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }} title={(n1 || '') + ' %'} />
                      <input type="number" min={0} max={100} value={editP2} onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setEditP2(String(v)) }}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); else if (e.key === 'Escape') setEditingId(null) }}
                        style={{ width: 58, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }} title={(n2 || '') + ' %'} />
                    </>
                  )}
                </div>
              )}
              <button onClick={() => saveEdit(item)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Opslaan</button>
              <button onClick={() => setEditingId(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
            </div>
          ) : (
            <div draggable={can}
              onDragStart={() => setDragging(idx)}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
              onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
              onDragLeave={() => setDragOver(d => d === idx ? null : d)}
              onDrop={() => handleDrop(idx)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', borderTop: dragOver === idx && dragging !== idx ? `2px solid ${c}` : '2px solid transparent', opacity: dragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
            >
              {can && <span style={{ color: 'var(--muted)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}><GripIcon /></span>}
              <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                <input type="number" key={item.id + '-' + item.value} defaultValue={item.value} disabled
                  style={{ width: 100, background: 'transparent', border: 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
              </div>
              {showSplit && (
                <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0, width: 90, textAlign: 'right', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SAV_SPLITS[item.split || '5050']}</span>
              )}
              {can && (
                <>
                  <button onClick={() => startEdit(item)} style={{ width: 26, height: 26, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}><PencilIcon /></button>
                  <button onClick={() => onDelete(item.id)} style={{ width: 22, height: 22, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const TABS = [
  { id: 'sparen', label: 'Sparen' },
  { id: 'schulden', label: 'Schulden' },
]

export default function Vermogen() {
  const { data, saveData, canEdit, isSingleUser } = useInsight()
  const { addToast, removeToast } = useToast()
  const [pendingDeletionIds, setPendingDeletionIds] = useState<Set<string>>(new Set())
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const colors = PAGE_COLORS.vermogen
  const [isDark, setIsDark] = useState(false)
  const c = isDark ? colors.dark : colors.light

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'sparen'
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    return tab && ['sparen', 'schulden'].includes(tab) ? tab : 'sparen'
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
  const editable = canEdit('user1') || canEdit('user2')

  const u1Inc = sum(data.user1?.income || [])
  const u2Inc = sum(data.user2?.income || [])
  const totalInc = u1Inc + u2Inc
  const r1 = totalInc ? u1Inc / totalInc : 0.5

  function splitSavVal(item: SavItem): { u1: number; u2: number } {
    const s = item.split || '5050'
    if (s === 'user1') return { u1: item.value, u2: 0 }
    if (s === 'user2') return { u1: 0, u2: item.value }
    if (s === 'percent') return { u1: item.value * (item.p1 ?? 50) / 100, u2: item.value * (item.p2 ?? 50) / 100 }
    if (s === 'ratio') return { u1: item.value * r1, u2: item.value * (1 - r1) }
    return { u1: item.value / 2, u2: item.value / 2 }
  }

  // ─── Sparen state ───────────────────────────────────────────────────────────
  const [potForm, setPotForm] = useState({ label: '', current: '', goal: '', owner: 'gezamenlijk' })
  const [openPotForm, setOpenPotForm] = useState<string | null>(null)
  const [openSav, setOpenSav] = useState<string | null>(null)
  const [savForm, setSavForm] = useState({ label: '', value: '', split: '5050', p1: '50', p2: '50' })
  const [editingPotId, setEditingPotId] = useState<string | null>(null)
  const [editPotLabel, setEditPotLabel] = useState('')
  const [editPotCurrent, setEditPotCurrent] = useState('')
  const [editPotGoal, setEditPotGoal] = useState('')
  const [potDragging, setPotDragging] = useState<number | null>(null)
  const [potDragOver, setPotDragOver] = useState<number | null>(null)

  const potten: Pot[] = data.spaarpotjes || []
  const u1sh: SavItem[] = data.user1?.savings?.shared || []
  const u1pr: SavItem[] = data.user1?.savings?.private || []
  const u2sh: SavItem[] = data.user2?.savings?.shared || []
  const u2pr: SavItem[] = data.user2?.savings?.private || []

  function addSavItem(slot: 'user1' | 'user2', type: 'shared' | 'private', label: string, value: number, split?: string, p1?: number, p2?: number) {
    const extra = type === 'shared' ? { split: split || '5050', ...(split === 'percent' ? { p1: p1 ?? 50, p2: p2 ?? 50 } : {}) } : {}
    const item: SavItem = { id: slot + type + Date.now(), label, value, ...extra }
    const updated = { ...data }
    updated[slot] = { ...updated[slot], savings: { ...updated[slot]?.savings, [type]: [...(updated[slot]?.savings?.[type] || []), item] } }
    saveData(updated)
  }
  function deleteSavItem(slot: 'user1' | 'user2', type: 'shared' | 'private', id: string) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], savings: { ...updated[slot]?.savings, [type]: updated[slot].savings[type].filter((i: SavItem) => i.id !== id) } }
    saveData(updated)
  }
  function editSavFull(slot: 'user1' | 'user2', type: 'shared' | 'private', id: string, label: string, value: number, split?: string, p1?: number, p2?: number) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], savings: { ...updated[slot]?.savings, [type]: (updated[slot]?.savings?.[type] || []).map((i: SavItem) => i.id === id ? { ...i, label, value, ...(split !== undefined ? { split, ...(split === 'percent' ? { p1: p1 ?? 50, p2: p2 ?? 50 } : {}) } : {}) } : i) } }
    saveData(updated)
  }
  function reorderSavItems(slot: 'user1' | 'user2', type: 'shared' | 'private', newItems: SavItem[]) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], savings: { ...updated[slot]?.savings, [type]: newItems } }
    saveData(updated)
  }
  function addPot() {
    if (!potForm.label.trim()) return
    const pot: Pot = { id: 'sp' + Date.now(), label: potForm.label.trim(), current: parseFloat(potForm.current) || 0, goal: parseFloat(potForm.goal) || 0, owner: potForm.owner, createdAt: new Date().toISOString() }
    saveData({ ...data, spaarpotjes: [...potten, pot], vermogenTs: new Date().toISOString() })
    addToast({ message: `${potForm.label} spaardoel aangemaakt`, variant: 'success' })
    setPotForm({ label: '', current: '', goal: '', owner: 'gezamenlijk' })
    setOpenPotForm(null)
  }
  function deletePot(id: string) {
    const pot = potten.find(p => p.id === id)
    if (!pot) return
    setPendingDeletionIds(prev => new Set(prev).add(id))
    let toastId: string
    const undo = () => {
      clearTimeout(pendingTimers.current.get(id))
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
      removeToast(toastId)
    }
    toastId = addToast({ message: `${pot.label} verwijderd`, variant: 'danger', duration: 5000, action: { label: 'Ongedaan maken', onClick: undo } })
    const timer = setTimeout(() => {
      saveData({ ...data, spaarpotjes: potten.filter(p => p.id !== id), vermogenTs: new Date().toISOString() })
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 5000)
    pendingTimers.current.set(id, timer)
  }
  function editPot(id: string, field: string, val: string) {
    saveData({ ...data, spaarpotjes: potten.map(p => p.id === id ? { ...p, [field]: field === 'current' || field === 'goal' ? parseFloat(val) || 0 : val, updatedAt: new Date().toISOString() } : p), vermogenTs: new Date().toISOString() })
  }
  function reorderPotten(newPotten: Pot[]) { saveData({ ...data, spaarpotjes: newPotten }) }
  function savePotEdit(pot: Pot) {
    const label = editPotLabel.trim() || pot.label
    const current = parseFloat(editPotCurrent) || 0
    const goal = parseFloat(editPotGoal) || 0
    saveData({ ...data, spaarpotjes: potten.map(p => p.id === pot.id ? { ...p, label, current, goal, updatedAt: new Date().toISOString() } : p), vermogenTs: new Date().toISOString() })
    setEditingPotId(null)
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

  const potsFiltered = potten.filter(p => !pendingDeletionIds.has(p.id))

  // ─── Schulden state ─────────────────────────────────────────────────────────
  const schulden: Schuld[] = data.schulden || []
  const [openSchuldCol, setOpenSchuldCol] = useState<string | null>(null)
  const [editingSchuldId, setEditingSchuldId] = useState<string | null>(null)
  const blankSForm = { naam: '', type: 'overig', loanType: 'overig' as LoanType, looptijdMaanden: '', balance: '', payment: '', rate: '', fixedYears: '0', fixedStart: '' }
  const [sForm, setSForm] = useState(blankSForm)

  function addSchuld(wie: string) {
    if (!sForm.naam.trim()) return
    const loanType = sForm.loanType
    if ((loanType === 'annuitair' || loanType === 'lineair') && !sForm.looptijdMaanden) {
      addToast({ message: 'Vul de looptijd in maanden in voor dit leningtype.', variant: 'danger' })
      return
    }
    const s: Schuld = { id: 'sc' + Date.now(), naam: sForm.naam.trim(), type: sForm.type, wie, loanType, looptijdMaanden: sForm.looptijdMaanden ? parseInt(sForm.looptijdMaanden) : undefined, entryDate: new Date().toISOString(), balance: parseFloat(sForm.balance) || 0, payment: parseFloat(sForm.payment) || 0, rate: parseFloat(sForm.rate) || 0, fixedYears: parseInt(sForm.fixedYears) || 0, fixedStart: sForm.fixedStart, createdAt: new Date().toISOString() }
    saveData({ ...data, schulden: [...schulden, s], vermogenTs: new Date().toISOString() })
    const totalDebt = [...schulden, s].reduce((a, sc) => a + sc.balance, 0)
    addToast({ message: `${s.naam} toegevoegd — totale schuld is nu ${fmt(totalDebt, 0)}`, variant: 'success' })
    setSForm(blankSForm)
    setOpenSchuldCol(null)
  }
  function deleteSchuld(id: string) {
    const sc = schulden.find(s => s.id === id)
    if (!sc) return
    setPendingDeletionIds(prev => new Set(prev).add(id))
    let toastId: string
    const undo = () => {
      clearTimeout(pendingTimers.current.get(id))
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
      removeToast(toastId)
    }
    toastId = addToast({ message: `${sc.naam} verwijderd`, variant: 'danger', duration: 5000, action: { label: 'Ongedaan maken', onClick: undo } })
    const timer = setTimeout(() => {
      saveData({ ...data, schulden: schulden.filter(s => s.id !== id), vermogenTs: new Date().toISOString() })
      pendingTimers.current.delete(id)
      setPendingDeletionIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 5000)
    pendingTimers.current.set(id, timer)
  }
  function editSchuld(id: string, field: string, val: string) {
    const intFields = ['fixedYears', 'looptijdMaanden']
    const floatFields = ['balance', 'payment', 'rate']
    saveData({ ...data, schulden: schulden.map(s => s.id === id ? { ...s, [field]: intFields.includes(field) ? (parseInt(val) || undefined) : floatFields.includes(field) ? parseFloat(val) || 0 : val } : s), vermogenTs: new Date().toISOString() })
  }
  function addRentePeriode(schuldId: string) {
    const sc = schulden.find(s => s.id === schuldId)
    if (!sc) return
    const sorted = [...(sc.rentePeriodes || [])].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    const lastEnd = sorted.length > 0 && sorted[sorted.length - 1].endDate
      ? sorted[sorted.length - 1].endDate as string
      : (sc.entryDate?.split('T')[0] || new Date().toISOString().split('T')[0])
    const newP: RentePeriode = { id: 'rp' + Date.now(), startDate: lastEnd, rate: 0 }
    saveData({ ...data, schulden: schulden.map(s => s.id === schuldId ? { ...s, rentePeriodes: [...(s.rentePeriodes || []), newP] } : s), vermogenTs: new Date().toISOString() })
  }
  function deleteRentePeriode(schuldId: string, periodeId: string) {
    saveData({ ...data, schulden: schulden.map(s => s.id === schuldId ? { ...s, rentePeriodes: (s.rentePeriodes || []).filter(p => p.id !== periodeId) } : s), vermogenTs: new Date().toISOString() })
  }
  function editRentePeriode(schuldId: string, periodeId: string, field: string, val: string) {
    saveData({ ...data, schulden: schulden.map(s => s.id === schuldId ? { ...s, rentePeriodes: (s.rentePeriodes || []).map(p => p.id === periodeId ? { ...p, [field]: field === 'rate' ? (parseFloat(val) || 0) : val } : p) } : s), vermogenTs: new Date().toISOString() })
  }

  useEffect(() => {
    const needsMigration = schulden.some(sc =>
      (sc.loanType === 'annuitair' || sc.loanType === 'lineair') &&
      (sc.fixedYears || 0) > 0 && sc.fixedStart &&
      (!sc.rentePeriodes || sc.rentePeriodes.length === 0)
    )
    if (!needsMigration) return
    const migrated = schulden.map(sc => {
      if ((sc.loanType === 'annuitair' || sc.loanType === 'lineair') &&
          (sc.fixedYears || 0) > 0 && sc.fixedStart &&
          (!sc.rentePeriodes || sc.rentePeriodes.length === 0)) {
        const end = new Date(sc.fixedStart)
        end.setFullYear(end.getFullYear() + (sc.fixedYears || 0))
        return { ...sc, rentePeriodes: [{ id: 'rp' + Date.now(), startDate: sc.fixedStart, endDate: end.toISOString().split('T')[0], rate: sc.rate }] }
      }
      return sc
    })
    saveData({ ...data, schulden: migrated, vermogenTs: new Date().toISOString() })
  }, [])

  const schuldenFiltered = schulden.filter(s => !pendingDeletionIds.has(s.id))

  const now = new Date()
  const totalBalance = schulden.reduce((a, s) => a + calcRemainingBalance(s, now), 0)
  const totalPayment = schulden.reduce((a, s) => a + (calcMonthlyPayment(s) ?? s.payment ?? 0), 0)
  const totalInterest = schulden.reduce((a, s) => {
    const m = calcMonths(s.balance, s.payment, s.rate)
    if (m && m !== Infinity) return a + Math.max(0, m * s.payment - s.balance)
    return a
  }, 0)

  // ─── Shared styles ──────────────────────────────────────────────────────────
  const panel: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
  const totalBox: React.CSSProperties = { background: colors.bgCard, border: `1px solid ${colors.bdCard}`, borderRadius: 8, padding: '10px 12px' }
  const inp: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', width: '100%', fontVariantNumeric: 'tabular-nums' }
  const eyebrow: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }
  const onEnterBlur = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur() }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)', marginBottom: 20 }}>Vermogen</div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {TABS.map(tab => {
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

      {activeTab === 'sparen' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
            {!isSingleUser && (() => {
              const isOpen = openSav === 'gezamenlijk'
              const gezCan = canEdit('user1') || canEdit('user2')
              const allSh = [...u1sh, ...u2sh]
              const totSh1 = allSh.reduce((a, i) => a + splitSavVal(i).u1, 0)
              const totSh2 = allSh.reduce((a, i) => a + splitSavVal(i).u2, 0)
              const total = totSh1 + totSh2
              function submitGez() {
                if (!savForm.label.trim() || !savForm.value) return
                addSavItem('user1', 'shared', savForm.label.trim(), parseFloat(savForm.value), savForm.split, parseFloat(savForm.p1) || 50, parseFloat(savForm.p2) || 50)
                setSavForm({ label: '', value: '', split: '5050', p1: '50', p2: '50' })
                setOpenSav(null)
              }
              return (
                <div style={{ ...panel, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)' }}>Gezamenlijk</span>
                    {gezCan && <button className="btn-add" onClick={() => { if (isOpen) setOpenSav(null); else { setSavForm({ label: '', value: '', split: '5050', p1: '50', p2: '50' }); setOpenSav('gezamenlijk') } }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{isOpen ? '− Post' : '+ Post'}</button>}
                  </div>
                  {isOpen && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                      <input autoFocus style={{ flex: 1, minWidth: 80, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}
                        placeholder="Omschrijving" value={savForm.label} onChange={e => setSavForm({ ...savForm, label: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') submitGez(); else if (e.key === 'Escape') setOpenSav(null) }} />
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                        <input style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                          type="number" placeholder="Bedrag" value={savForm.value} onChange={e => setSavForm({ ...savForm, value: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') submitGez(); else if (e.key === 'Escape') setOpenSav(null) }} />
                      </div>
                      <select style={{ background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                        value={savForm.split} onChange={e => setSavForm({ ...savForm, split: e.target.value })}>
                        <option value="ratio">Naar rato</option>
                        <option value="5050">50/50</option>
                        <option value="percent">Percentage</option>
                        <option value="user1">{n1}</option>
                        <option value="user2">{n2}</option>
                      </select>
                      {savForm.split === 'percent' && (
                        <>
                          <input type="number" min={0} max={100} style={{ width: 52, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                            placeholder={n1} value={savForm.p1}
                            onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setSavForm({ ...savForm, p1: String(v), p2: String(100 - v) }) }}
                            onKeyDown={e => { if (e.key === 'Enter') submitGez(); else if (e.key === 'Escape') setOpenSav(null) }} />
                          <input type="number" min={0} max={100} style={{ width: 52, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                            placeholder={n2} value={savForm.p2}
                            onChange={e => { const v = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setSavForm({ ...savForm, p2: String(v), p1: String(100 - v) }) }}
                            onKeyDown={e => { if (e.key === 'Enter') submitGez(); else if (e.key === 'Escape') setOpenSav(null) }} />
                        </>
                      )}
                      <button className="btn-submit" onClick={submitGez} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Toevoegen</button>
                      <button className="btn-cancel" onClick={() => setOpenSav(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
                    </div>
                  )}
                  {allSh.length === 0 && !isOpen ? (
                    <div style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', flex: 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${c}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, maxWidth: 200 }}>Leg vast wat jullie samen sparen.</div>
                      {gezCan && <button className="btn-submit" onClick={() => { setSavForm({ label: '', value: '', split: '5050', p1: '50', p2: '50' }); setOpenSav('gezamenlijk') }} style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF', fontFamily: 'var(--font-body)' }}>+ Post toevoegen</button>}
                    </div>
                  ) : (
                    <>
                      <SavList items={u1sh} can={canEdit('user1')} c={c} onSaveEdit={(id, label, value, split, p1, p2) => editSavFull('user1', 'shared', id, label, value, split, p1, p2)} onDelete={id => deleteSavItem('user1', 'shared', id)} onReorder={newItems => reorderSavItems('user1', 'shared', newItems)} showSplit n1={n1} n2={n2} r1={r1} />
                      <SavList items={u2sh} can={canEdit('user2')} c={c} onSaveEdit={(id, label, value, split, p1, p2) => editSavFull('user2', 'shared', id, label, value, split, p1, p2)} onDelete={id => deleteSavItem('user2', 'shared', id)} onReorder={newItems => reorderSavItems('user2', 'shared', newItems)} showSplit n1={n1} n2={n2} r1={r1} />
                    </>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 'auto', paddingTop: 14 }}>
                    <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>{n1}</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: c, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(totSh1, 0)}</div></div>
                    <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>{n2}</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: c, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(totSh2, 0)}</div></div>
                    <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: c, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(total, 0)}</div></div>
                  </div>
                </div>
              )
            })()}
            {[
              { name: n1, slot: 'user1' as const, pr: u1pr, can: canEdit('user1') },
              ...(!isSingleUser ? [{ name: n2, slot: 'user2' as const, pr: u2pr, can: canEdit('user2') }] : [])
            ].map(({ name, slot, pr, can }) => {
              const isOpen = openSav === slot
              function submitPriv() {
                if (!savForm.label.trim() || !savForm.value) return
                addSavItem(slot, 'private', savForm.label.trim(), parseFloat(savForm.value))
                setSavForm({ label: '', value: '', split: '5050', p1: '50', p2: '50' })
                setOpenSav(null)
              }
              return (
                <div key={slot} style={{ ...panel, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)' }}>{name}</span>
                    {can && <button className="btn-add" onClick={() => { if (isOpen) setOpenSav(null); else { setSavForm({ label: '', value: '', split: '5050', p1: '50', p2: '50' }); setOpenSav(slot) } }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{isOpen ? '− Post' : '+ Post'}</button>}
                  </div>
                  {isOpen && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                      <input autoFocus style={{ flex: 1, minWidth: 80, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}
                        placeholder="Omschrijving" value={savForm.label} onChange={e => setSavForm({ ...savForm, label: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') submitPriv(); else if (e.key === 'Escape') setOpenSav(null) }} />
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                        <input style={{ width: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                          type="number" placeholder="Bedrag" value={savForm.value} onChange={e => setSavForm({ ...savForm, value: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') submitPriv(); else if (e.key === 'Escape') setOpenSav(null) }} />
                      </div>
                      <button className="btn-submit" onClick={submitPriv} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Toevoegen</button>
                      <button className="btn-cancel" onClick={() => setOpenSav(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
                    </div>
                  )}
                  {pr.length === 0 && !isOpen ? (
                    <div style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', flex: 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${c}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/>
                        </svg>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, maxWidth: 200 }}>Nog geen spaarbedragen toegevoegd.</div>
                      {can && <button className="btn-submit" onClick={() => { setSavForm({ label: '', value: '', split: '5050', p1: '50', p2: '50' }); setOpenSav(slot) }} style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF', fontFamily: 'var(--font-body)' }}>+ Post toevoegen</button>}
                    </div>
                  ) : (
                    <SavList items={pr} can={can} c={c} onSaveEdit={(id, label, value) => editSavFull(slot, 'private', id, label, value)} onDelete={id => deleteSavItem(slot, 'private', id)} onReorder={newItems => reorderSavItems(slot, 'private', newItems)} />
                  )}
                  <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                    <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal privé</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: c, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(sum(pr), 0)}</div></div>
                  </div>
                </div>
              )
            })}
          </div>

          {(() => {
            const potGroups = isSingleUser
              ? [{ key: 'user1', title: n1, canAdd: canEdit('user1') }]
              : [{ key: 'gezamenlijk', title: 'Gezamenlijk', canAdd: editable }, { key: 'user1', title: n1, canAdd: canEdit('user1') }, { key: 'user2', title: n2, canAdd: canEdit('user2') }]
            function cancelPotForm() { setPotForm({ label: '', current: '', goal: '', owner: 'gezamenlijk' }); setOpenPotForm(null) }
            function renderPotRow(pot: Pot) {
              const idx = potsFiltered.indexOf(pot)
              const pct = pot.goal > 0 ? Math.min(1, pot.current / pot.goal) : 0
              const isEditingPot = editingPotId === pot.id
              return (
                <div key={pot.id} draggable={editable && !isEditingPot}
                  onDragStart={() => setPotDragging(idx)}
                  onDragEnd={() => { setPotDragging(null); setPotDragOver(null) }}
                  onDragOver={e => { e.preventDefault(); setPotDragOver(idx) }}
                  onDragLeave={() => setPotDragOver(d => d === idx ? null : d)}
                  onDrop={() => handlePotDrop(idx)}
                  style={{ background: 'var(--s3)', border: isEditingPot ? `1px solid ${c}` : '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', marginBottom: 8, borderTop: potDragOver === idx && potDragging !== idx ? `2px solid ${c}` : undefined, opacity: potDragging === idx ? 0.4 : 1, transition: 'opacity .15s' }}
                >
                  {isEditingPot ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input autoFocus value={editPotLabel} onChange={e => setEditPotLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') savePotEdit(pot); else if (e.key === 'Escape') setEditingPotId(null) }}
                        placeholder="Naam" style={{ flex: 2, minWidth: 80, background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }} />
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 12, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                        <input type="number" value={editPotCurrent} onChange={e => setEditPotCurrent(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') savePotEdit(pot); else if (e.key === 'Escape') setEditingPotId(null) }}
                          placeholder="Huidig" style={{ width: 90, background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px 6px 20px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }} />
                      </div>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 12, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                        <input type="number" value={editPotGoal} onChange={e => setEditPotGoal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') savePotEdit(pot); else if (e.key === 'Escape') setEditingPotId(null) }}
                          placeholder="Doel" style={{ width: 90, background: 'var(--s2)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px 6px 20px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }} />
                      </div>
                      <button onClick={() => savePotEdit(pot)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Opslaan</button>
                      <button onClick={() => setEditingPotId(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: pot.goal > 0 ? 10 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          {editable && <span style={{ color: 'var(--muted)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}><GripIcon /></span>}
                          <div style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pot.label}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(pot.current, 0)}</span>
                          <span style={{ color: 'var(--muted)', fontSize: 13 }}>/</span>
                          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>{fmt(pot.goal, 0)}</span>
                          {pot.goal > 0 && <span style={{ fontSize: 12, color: 'rgba(245,245,245,0.45)' }}>({(pct * 100).toFixed(0)}%)</span>}
                          {editable && <button onClick={() => { setEditingPotId(pot.id); setEditPotLabel(pot.label); setEditPotCurrent(String(pot.current)); setEditPotGoal(String(pot.goal)) }} style={{ width: 26, height: 26, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }} title="Bewerken"><PencilIcon /></button>}
                          {editable && <button className="btn-delete" onClick={() => deletePot(pot.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>}
                        </div>
                      </div>
                      {pot.goal > 0 && (
                        <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, width: `${(pct * 100).toFixed(2)}%`, background: c, transition: 'width .5s ease' }} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            }
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
                  {potGroups.map(({ key, title, canAdd }) => {
                    const groupPots = potsFiltered.filter(p => p.owner === key)
                    const isFormOpen = openPotForm === key
                    return (
                      <div key={key} style={{ ...panel, display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
                        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)' }}>{title}</span>
                          {canAdd && <button className="btn-add" onClick={() => { if (isFormOpen) { cancelPotForm() } else { setPotForm({ label: '', current: '', goal: '', owner: key }); setOpenPotForm(key) } }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{isFormOpen ? '− Spaarpot' : '+ Spaarpot'}</button>}
                        </div>
                        {isFormOpen && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                            <input autoFocus style={{ flex: 2, minWidth: 100, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
                              placeholder="Naam spaarpot" value={potForm.label} onChange={e => setPotForm({ ...potForm, label: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') addPot(); else if (e.key === 'Escape') cancelPotForm() }} />
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                              <input style={{ width: 90, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                                type="number" placeholder="Huidig" value={potForm.current} onChange={e => setPotForm({ ...potForm, current: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') addPot(); else if (e.key === 'Escape') cancelPotForm() }} />
                            </div>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                              <input style={{ width: 90, background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px 6px 22px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                                type="number" placeholder="Doel" value={potForm.goal} onChange={e => setPotForm({ ...potForm, goal: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') addPot(); else if (e.key === 'Escape') cancelPotForm() }} />
                            </div>
                            <button className="btn-submit" onClick={addPot} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Toevoegen</button>
                            <button className="btn-cancel" onClick={cancelPotForm} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
                          </div>
                        )}
                        {groupPots.length === 0 && !isFormOpen ? (
                          <div style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', flex: 1 }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${c}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                              </svg>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, maxWidth: 180 }}>Stel een spaardoel in en volg de voortgang.</div>
                            {canAdd && <button className="btn-submit" onClick={() => { setPotForm({ label: '', current: '', goal: '', owner: key }); setOpenPotForm(key) }} style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF', fontFamily: 'var(--font-body)' }}>+ Spaardoel toevoegen</button>}
                          </div>
                        ) : (
                          <div style={{ flex: 1 }}>{groupPots.map(renderPotRow)}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </>
      )}

      {activeTab === 'schulden' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr 1fr', gap: 16, alignItems: 'stretch', marginBottom: 22 }}>
            {(isSingleUser
              ? [{ colWie: 'user1', title: n1, can: editable }]
              : [
                  { colWie: 'samen', title: 'Gezamenlijk', can: editable },
                  { colWie: 'user1', title: n1, can: canEdit('user1') },
                  { colWie: 'user2', title: n2, can: canEdit('user2') },
                ]
            ).map(({ colWie, title, can }) => {
              const colSchulden = isSingleUser ? schuldenFiltered : schuldenFiltered.filter(sc => sc.wie === colWie)
              const isFormOpen = openSchuldCol === colWie
              return (
                <div key={colWie} style={{ ...panel, display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
                  <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'var(--font-heading)' }}>{title}</span>
                    {can && <button className="btn-add" onClick={() => { if (isFormOpen) { setOpenSchuldCol(null) } else { setSForm(blankSForm); setOpenSchuldCol(colWie) } }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', ...(isDark ? { background: colors.bg, color: colors.dark, border: `1px solid ${colors.dark}4D` } : { background: colors.light, color: '#FFFFFF', border: 'none' }) }}>{isFormOpen ? '− Schuld' : '+ Schuld'}</button>}
                  </div>
                  {isFormOpen && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Type lening</div>
                          <select style={{ ...inp, textAlign: 'left', cursor: 'pointer', width: '100%' } as React.CSSProperties} value={sForm.loanType} onChange={e => setSForm({ ...sForm, loanType: e.target.value as LoanType })}>
                            {LOAN_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Naam</div>
                          <input autoFocus style={{ ...inp, textAlign: 'left', width: '100%' }} placeholder="Naam schuld" value={sForm.naam} onChange={e => setSForm({ ...sForm, naam: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') addSchuld(colWie); else if (e.key === 'Escape') setOpenSchuldCol(null) }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Type schuld</div>
                          <select style={{ ...inp, textAlign: 'left', cursor: 'pointer', width: '100%' } as React.CSSProperties} value={sForm.type} onChange={e => setSForm({ ...sForm, type: e.target.value })}>
                            {STYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Beginschuld</div>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                            <input style={{ ...inp, padding: '6px 9px 6px 22px', width: '100%' }} type="number" placeholder="0" value={sForm.balance} onChange={e => setSForm({ ...sForm, balance: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') addSchuld(colWie); else if (e.key === 'Escape') setOpenSchuldCol(null) }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Looptijd (mnd)</div>
                          <input style={{ ...inp, width: '100%' }} type="number" step="1" placeholder={sForm.loanType === 'annuitair' || sForm.loanType === 'lineair' ? 'Verplicht' : 'Optioneel'} value={sForm.looptijdMaanden} onChange={e => setSForm({ ...sForm, looptijdMaanden: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') addSchuld(colWie); else if (e.key === 'Escape') setOpenSchuldCol(null) }} />
                        </div>
                        {(sForm.loanType === 'aflossingsvrij' || sForm.loanType === 'overig') && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Maand. aflossing</div>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                              <input style={{ ...inp, padding: '6px 9px 6px 22px', width: '100%' }} type="number" placeholder="0" value={sForm.payment} onChange={e => setSForm({ ...sForm, payment: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') addSchuld(colWie); else if (e.key === 'Escape') setOpenSchuldCol(null) }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Jaarrente (%)</div>
                          <input style={{ ...inp, width: '100%' }} type="number" step="0.01" placeholder="%" value={sForm.rate} onChange={e => setSForm({ ...sForm, rate: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') addSchuld(colWie); else if (e.key === 'Escape') setOpenSchuldCol(null) }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Rentevaste periode (jr)</div>
                          <input style={{ ...inp, width: '100%' }} type="number" step="1" value={sForm.fixedYears} onChange={e => setSForm({ ...sForm, fixedYears: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') addSchuld(colWie); else if (e.key === 'Escape') setOpenSchuldCol(null) }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Startdatum rente</div>
                          <input style={{ ...inp, textAlign: 'left', fontSize: 11, width: '100%' }} type="date" value={sForm.fixedStart} onChange={e => setSForm({ ...sForm, fixedStart: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') addSchuld(colWie); else if (e.key === 'Escape') setOpenSchuldCol(null) }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-cancel" onClick={() => setOpenSchuldCol(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
                        <button className="btn-submit" onClick={() => addSchuld(colWie)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF' }}>Toevoegen</button>
                      </div>
                    </div>
                  )}
                  {colSchulden.length === 0 && !isFormOpen ? (
                    <div style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', flex: 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${c}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 17 L12 3 L22 17 Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, maxWidth: 220 }}>Geen schulden geregistreerd.</div>
                      {can && <button className="btn-submit" onClick={() => { setSForm(blankSForm); setOpenSchuldCol(colWie) }} style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: c, color: '#FFFFFF', fontFamily: 'var(--font-body)' }}>+ Schuld toevoegen</button>}
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {colSchulden.map(sc => {
                        const months = calcMonths(sc.balance, sc.payment, sc.rate)
                        const wieLabel = sc.wie === 'user1' ? n1 : sc.wie === 'user2' ? n2 : 'Samen'
                        const endDate = months && months !== Infinity ? (() => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }) })() : null
                        const totalInterestSc = months && months !== Infinity ? Math.max(0, months * sc.payment - sc.balance) : 0
                        const yr = months && months !== Infinity ? Math.floor(months / 12) : 0
                        const rm = months && months !== Infinity ? months % 12 : 0
                        let fixedBadge = null
                        if (sc.fixedYears > 0 && sc.fixedStart) {
                          const e = new Date(sc.fixedStart)
                          e.setFullYear(e.getFullYear() + sc.fixedYears)
                          const dl = Math.ceil((e.getTime() - new Date().getTime()) / 86400000)
                          const cls = dl < 0 ? { bg: 'rgba(224,80,80,.12)', color: 'var(--danger)' } : dl < 180 ? { bg: 'rgba(212,160,23,.12)', color: 'var(--warn)' } : { bg: 'rgba(76,175,130,.12)', color: 'var(--ok)' }
                          fixedBadge = { text: dl < 0 ? 'Rentevaste periode verlopen' : `Rente vast tot ${e.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })} (${Math.round(dl / 30)} mnd)`, ...cls }
                        }
                        const isEditing = editingSchuldId === sc.id
                        return (
                          <div key={sc.id} style={{ background: 'var(--s3)', border: `1px solid ${isEditing ? c : 'var(--card-border)'}`, borderRadius: 10, padding: '16px 18px', marginBottom: 12, display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: endDate ? 3 : 0 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{sc.naam}</span>
                                  <span style={{ padding: '2px 8px', borderRadius: 10, background: 'var(--s2)', fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>{LOAN_TYPES.find(lt => lt.value === (sc.loanType || 'overig'))?.label || 'Overig'}</span>
                                </div>
                                {endDate && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Afgelost {endDate}</div>}
                              </div>
                              {editable && (
                                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                  <button onClick={() => setEditingSchuldId(isEditing ? null : sc.id)} style={{ width: 26, height: 26, background: isEditing ? `${c}20` : 'transparent', color: isEditing ? c : 'var(--muted)', border: `1px solid ${isEditing ? c + '60' : 'var(--border)'}`, borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                    <PencilIcon />
                                  </button>
                                  <button className="btn-delete" onClick={() => deleteSchuld(sc.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                                </div>
                              )}
                            </div>
                            {isEditing ? (
                              <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Type lening</div>
                                    <select value={sc.loanType || 'overig'} onChange={e => editSchuld(sc.id, 'loanType', e.target.value)}
                                      style={{ ...inp, textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)' } as React.CSSProperties}>
                                      {LOAN_TYPES.map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Beginschuld</div>
                                    <div style={{ position: 'relative' }}>
                                      <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                                      <input type="number" step="100" defaultValue={sc.balance} onBlur={e => editSchuld(sc.id, 'balance', e.target.value)} onKeyDown={onEnterBlur}
                                        style={{ ...inp, width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)', padding: '6px 9px 6px 22px' }} />
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: `1fr${(sc.loanType === 'aflossingsvrij' || sc.loanType === 'overig' || !sc.loanType) ? ' 1fr' : ''}`, gap: 12, marginBottom: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Looptijd (mnd)</div>
                                    <input type="number" step="1" defaultValue={sc.looptijdMaanden ?? ''} onBlur={e => editSchuld(sc.id, 'looptijdMaanden', e.target.value)} onKeyDown={onEnterBlur}
                                      style={{ ...inp, width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)' }} />
                                  </div>
                                  {(sc.loanType === 'aflossingsvrij' || sc.loanType === 'overig' || !sc.loanType) && (
                                    <div>
                                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Maand. aflossing</div>
                                      <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                                        <input type="number" step="1" defaultValue={sc.payment} onBlur={e => editSchuld(sc.id, 'payment', e.target.value)} onKeyDown={onEnterBlur}
                                          style={{ ...inp, width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)', padding: '6px 9px 6px 22px' }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: (sc.loanType === 'annuitair' || sc.loanType === 'lineair') ? 4 : 12 }}>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Jaarrente (%)</div>
                                    <input type="number" step="0.01" defaultValue={sc.rate} onBlur={e => editSchuld(sc.id, 'rate', e.target.value)} onKeyDown={onEnterBlur}
                                      style={{ ...inp, width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Looptijd ingangsdatum</div>
                                    <input type="date" defaultValue={sc.entryDate?.split('T')[0] || ''} onBlur={e => editSchuld(sc.id, 'entryDate', e.target.value)} onKeyDown={onEnterBlur}
                                      style={{ ...inp, width: '100%', textAlign: 'left', fontSize: 11, background: 'var(--s2)', border: '1px solid var(--input-border)' }} />
                                  </div>
                                </div>
                                {(sc.loanType === 'annuitair' || sc.loanType === 'lineair') && (() => {
                                  const sortedPeriodes = [...(sc.rentePeriodes || [])].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                                  return (
                                    <div style={{ marginTop: 12, marginBottom: 12, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>Rentevaste periodes</div>
                                        {editable && <button onClick={() => addRentePeriode(sc.id)} style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: c, border: `1px solid ${c}50` }}>+ Periode</button>}
                                      </div>
                                      {sortedPeriodes.length > 0 ? (
                                        <>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 72px 28px', gap: 6, marginBottom: 4 }}>
                                            {['Van', 'Jaren', 'Rente', ''].map((h, i) => (
                                              <div key={i} style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{h}</div>
                                            ))}
                                          </div>
                                          {sortedPeriodes.map((p, idx) => {
                                            const derivedYears = p.endDate ? Math.round((new Date(p.endDate).getFullYear() - new Date(p.startDate).getFullYear()) + (new Date(p.endDate).getMonth() - new Date(p.startDate).getMonth()) / 12) : undefined
                                            return (
                                              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 72px 28px', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                                                <div style={{ fontSize: 12, color: 'var(--muted)', padding: '5px 0' }}>
                                                  {new Date(p.startDate).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </div>
                                                <input type="number" step="1" min="1" key={`${p.id}-yrs`} defaultValue={derivedYears ?? ''} placeholder="jr"
                                                  onBlur={e => {
                                                    const yrs = parseInt(e.target.value)
                                                    if (!yrs) return
                                                    const end = new Date(p.startDate)
                                                    end.setFullYear(end.getFullYear() + yrs)
                                                    editRentePeriode(sc.id, p.id, 'endDate', end.toISOString().split('T')[0])
                                                  }}
                                                  onKeyDown={onEnterBlur}
                                                  style={{ ...inp, width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)' }} />
                                                <input type="number" step="0.01" key={`${p.id}-rate`} defaultValue={p.rate || ''} onBlur={e => editRentePeriode(sc.id, p.id, 'rate', e.target.value)} onKeyDown={onEnterBlur}
                                                  placeholder="%" style={{ ...inp, width: '100%', background: 'var(--s2)', border: '1px solid var(--input-border)' }} />
                                                {idx === sortedPeriodes.length - 1 && editable
                                                  ? <button onClick={() => deleteRentePeriode(sc.id, p.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>×</button>
                                                  : <div />}
                                              </div>
                                            )
                                          })}
                                        </>
                                      ) : (
                                        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>Nog geen periodes — klik "+ Periode" om te beginnen</div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </>
                            ) : (() => {
                                const calcBal = calcRemainingBalance(sc, now)
                                const calcPay = calcMonthlyPayment(sc)
                                const loanLabel = LOAN_TYPES.find(lt => lt.value === (sc.loanType || 'overig'))?.label || 'Overig'
                                const entryLabel = sc.entryDate ? new Date(sc.entryDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : null
                                return (
                                  <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
                                      {[
                                        { label: 'Beginschuld', val: fmtK(sc.balance, 2) },
                                        { label: 'Maand. aflossing', val: calcPay != null ? fmtK(calcPay, 2) : fmtK(sc.payment, 2) },
                                        { label: 'Jaarrente', val: `${sc.rate}%` },
                                        { label: 'Rentevaste jaren', val: sc.fixedYears > 0 ? `${sc.fixedYears} jaar` : '—' },
                                      ].map((f, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{f.label}</span>
                                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{f.val}</span>
                                        </div>
                                      ))}
                                      {(() => {
                                        const periodes = [...(sc.rentePeriodes || [])].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                                        const today = now
                                        const activePeriode = periodes.find(p => { const s = new Date(p.startDate); const e = p.endDate ? new Date(p.endDate) : null; return today >= s && (!e || today < e) })
                                        const nextPeriode = periodes.find(p => new Date(p.startDate) > today)
                                        if (periodes.length === 0) {
                                          if (sc.fixedStart && sc.fixedYears > 0) {
                                            const end = new Date(sc.fixedStart)
                                            end.setFullYear(end.getFullYear() + sc.fixedYears)
                                            return (
                                              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                                <span style={{ fontSize: 12, color: 'var(--muted2)' }}>Rentevaste periode tot</span>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                              </div>
                                            )
                                          }
                                          return null
                                        }
                                        return (
                                          <>
                                            {activePeriode?.endDate && (() => {
                                              const end = new Date(activePeriode.endDate)
                                              const monthsLeft = Math.round((end.getTime() - today.getTime()) / (86400000 * 365.25 / 12))
                                              return (
                                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                                  <span style={{ fontSize: 12, color: 'var(--muted2)' }}>Rentevaste periode tot</span>
                                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(nog {monthsLeft} mnd)</span></span>
                                                </div>
                                              )
                                            })()}
                                            {nextPeriode ? (
                                              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                                <span style={{ fontSize: 12, color: 'var(--muted2)' }}>Daarna</span>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                                                  {nextPeriode.rate ? `nieuwe rente: ${String(nextPeriode.rate).replace('.', ',')}%` : <span style={{ color: 'var(--muted)' }}>nog niet ingevuld</span>}
                                                  {nextPeriode.endDate ? ` t/m ${new Date(nextPeriode.endDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                                                </span>
                                              </div>
                                            ) : activePeriode?.endDate ? (
                                              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                                <span style={{ fontSize: 12, color: 'var(--muted2)' }}>Volgende periode</span>
                                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>nog niet ingevuld</span>
                                              </div>
                                            ) : null}
                                          </>
                                        )
                                      })()}
                                    </div>
                                    {entryLabel && (
                                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Berekend op basis van {loanLabel.toLowerCase()} · ingevoerd op {entryLabel}</div>
                                    )}
                                  </>
                                )
                              })()}
                            {(() => {
                              const entry = sc.entryDate ? new Date(sc.entryDate) : null
                              const loanEnd = entry && sc.looptijdMaanden ? (() => { const d = new Date(entry); d.setMonth(d.getMonth() + sc.looptijdMaanden!); return d })() : null
                              const remBal = calcRemainingBalance(sc, now)
                              const maandenRest = loanEnd
                                ? maandenTussen(now, loanEnd)
                                : (() => { const m = calcMonths(remBal, sc.payment, sc.rate); return m && m !== Infinity ? m : null })()
                              const restJr = maandenRest !== null ? Math.floor(maandenRest / 12) : null
                              const restMnd = maandenRest !== null ? maandenRest % 12 : null
                              return (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 'auto' }}>
                                  {[
                                    { label: 'Resterende schuld', val: fmtK(remBal), color: c },
                                    { label: 'Maanden resterend', val: maandenRest !== null ? `${maandenRest}` : '—', color: 'var(--text)' },
                                    { label: 'In jaren', val: restJr !== null ? `${restJr}j ${restMnd}m` : '—', color: 'var(--text)' },
                                    { label: 'Totale rente', val: fmtK(totalInterestSc), color: 'var(--danger)' },
                                  ].map((s, i) => (
                                    <div key={i} style={totalBox}>
                                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4, minHeight: 28, lineHeight: 1.4 }}>{s.label}</div>
                                      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', color: s.color }}>{s.val}</div>
                                    </div>
                                  ))}
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

    </div>
  )
}
