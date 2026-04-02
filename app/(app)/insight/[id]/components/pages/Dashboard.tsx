'use client'

import { useInsight } from '@/lib/insight-context'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { fmt, fmtK, sum } from '@/lib/format'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Sub = { id: string; name: string; date: string; amount: number; freq: string; person: string }
type SharedItem = { id: string; label: string; value: number; split: string; p1?: number; p2?: number }
type Schuld = { id: string; naam: string; type: string; wie: string; balance: number; payment: number; rate: number }
type Pot = { id: string; label: string; current: number; goal: number; owner: string }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Num({ v }: { v: string }) {
  if (v.startsWith('€')) {
    const num = v.replace(/^€[\u00a0 ]*/, '')
    return (
      <>
        <span style={{ fontFamily: 'var(--font-body)' }}>€{'\u00a0'}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{num}</span>
      </>
    )
  }
  return <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const today = new Date()
  const next = new Date(dateStr)
  while (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.ceil((next.getTime() - today.getTime()) / 86400000)
}

function subMonthly(s: Sub): number {
  if (s.freq === 'jaarlijks') return s.amount / 12
  if (s.freq === 'kwartaal') return s.amount / 3
  return s.amount
}

function hexToRgb(hex: string) {
  const c = (hex || '#E8C49A').replace('#', '')
  return { r: parseInt(c.slice(0, 2), 16) || 0, g: parseInt(c.slice(2, 4), 16) || 0, b: parseInt(c.slice(4, 6), 16) || 0 }
}
function lighten(hex: string, f = 0.5) {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${Math.min(255, Math.round(r + (255 - r) * f))},${Math.min(255, Math.round(g + (255 - g) * f))},${Math.min(255, Math.round(b + (255 - b) * f))})`
}
function darken(hex: string, f = 0.45) {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${Math.max(0, Math.round(r * f))},${Math.max(0, Math.round(g * f))},${Math.max(0, Math.round(b * f))})`
}

// ─── Widget system ──────────────────────────────────────────────────────────────

const DEFAULT_ORDER = [
  'financieel-overzicht',
  'cashflow',
  'over-te-maken',
  'inkomen-verdeling',
  'spaardoelen',
  'schulden',
  'abonnementen',
]

const WIDGET_META: Record<string, { label: string; dualOnly?: boolean; fullWidth: boolean }> = {
  'financieel-overzicht': { label: 'Financieel overzicht', fullWidth: true },
  'cashflow':             { label: 'Cashflow',              fullWidth: false },
  'over-te-maken':        { label: 'Over te maken',         dualOnly: true, fullWidth: false },
  'inkomen-verdeling':    { label: 'Inkomen verdeling',     fullWidth: true },
  'spaardoelen':          { label: 'Spaardoelen',           fullWidth: false },
  'schulden':             { label: 'Schulden',              fullWidth: false },
  'abonnementen':         { label: 'Abonnementen',          fullWidth: true },
}

type DashPrefs = { order: string[]; hidden: string[] }

function loadPrefs(hid: string): DashPrefs {
  try {
    const raw = localStorage.getItem(`se_dash_${hid}`)
    if (raw) {
      const p = JSON.parse(raw) as Partial<DashPrefs>
      const order = (p.order || []).filter(id => DEFAULT_ORDER.includes(id))
      const missing = DEFAULT_ORDER.filter(id => !order.includes(id))
      return { order: [...order, ...missing], hidden: p.hidden || [] }
    }
  } catch {}
  return { order: DEFAULT_ORDER, hidden: [] }
}

function savePrefs(hid: string, p: DashPrefs) {
  try { localStorage.setItem(`se_dash_${hid}`, JSON.stringify(p)) } catch {}
}

// ─── Shared styles ──────────────────────────────────────────────────────────────

const card: CSSProperties = {
  background: 'var(--s3)',
  border: '1px solid var(--card-border)',
  borderRadius: 10,
  padding: '20px 22px',
}

const cardHd: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 14,
  paddingBottom: 12,
  borderBottom: '1px solid var(--border)',
}

// ─── Drag handle icon ───────────────────────────────────────────────────────────

function DragHandle() {
  return (
    <span title="Versleep om te herordenen" style={{ cursor: 'grab', color: 'var(--muted)', opacity: 0.5, lineHeight: 1, fontSize: 14, userSelect: 'none', flexShrink: 0 }}>
      <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
        <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
        <circle cx="3" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/>
        <circle cx="3" cy="15" r="1.5"/><circle cx="9" cy="15" r="1.5"/>
      </svg>
    </span>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, isSingleUser, household } = useInsight()
  const hid = household?.id || 'local'

  const [prefs, setPrefs] = useState<DashPrefs>({ order: DEFAULT_ORDER, hidden: [] })
  const [showWidgetSettings, setShowWidgetSettings] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [previewTheme, setPreviewTheme] = useState(data.theme || '#E8C49A')

  useEffect(() => { setPrefs(loadPrefs(hid)) }, [hid])
  useEffect(() => { setPreviewTheme(data.theme || '#E8C49A') }, [data.theme])

  useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as CustomEvent<{ color?: string }>).detail?.color
      if (color) setPreviewTheme(color)
    }
    window.addEventListener('se-theme-preview', handler)
    return () => window.removeEventListener('se-theme-preview', handler)
  }, [])

  // ── Colors ──────────────────────────────────────────────────────────────────

  const accentHex = previewTheme.toLowerCase()
  const accentDark = darken(accentHex, 0.45)
  const accentLight = lighten(accentHex, 0.55)

  // ── Financials ──────────────────────────────────────────────────────────────

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  const jI = sum(data.user1?.income || [])
  const dI = sum(data.user2?.income || [])
  const totalIncome = jI + dI
  const jRatio = totalIncome ? jI / totalIncome : 0.5
  const dRatio = 1 - jRatio

  const sharedItems = (data.shared as SharedItem[] || [])
  const jSh = sharedItems.reduce((a, c) => {
    const v = c.value || 0
    if (c.split === '5050') return a + v / 2
    if (c.split === 'user1') return a + v
    if (c.split === 'user2') return a
    if (c.split === 'percent') return a + v * (c.p1 ?? 50) / 100
    return a + v * jRatio
  }, 0)

  const dSh = sharedItems.reduce((a, c) => {
    const v = c.value || 0
    if (c.split === '5050') return a + v / 2
    if (c.split === 'user1') return a
    if (c.split === 'user2') return a + v
    if (c.split === 'percent') return a + v * (c.p2 ?? 50) / 100
    return a + v * dRatio
  }, 0)

  const jPr = sum(data.user1?.private || [])
  const dPr = sum(data.user2?.private || [])
  const jSsh = sum(data.user1?.savings?.shared || [])
  const dSsh = sum(data.user2?.savings?.shared || [])
  const jSprivate = sum(data.user1?.savings?.private || [])
  const dSprivate = sum(data.user2?.savings?.private || [])
  const jSv = jSsh + jSprivate
  const dSv = dSsh + dSprivate

  const jTr = jSh + jSsh
  const dTr = dSh + dSsh
  const jR = jI - jTr - jPr - jSprivate
  const dR = dI - dTr - dPr - dSprivate

  const totalShared = jSh + dSh
  const totalPrive = jPr + dPr
  const totalSparen = jSv + dSv
  const totalDonut = totalShared + totalSparen + totalPrive
  const shPct = totalDonut ? (totalShared / totalDonut) * 100 : 0
  const svPct = totalDonut ? (totalSparen / totalDonut) * 100 : 0

  const subs = (data.abonnementen as Sub[] || [])
  const schulden = (data.schulden as Schuld[] || [])
  const potten = (data.spaarpotjes as Pot[] || [])

  const upcoming = subs
    .map(s => ({ ...s, days: daysUntil(s.date) }))
    .filter(s => s.days !== null && s.days >= -3 && s.days <= 60)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function updatePrefs(p: DashPrefs) { setPrefs(p); savePrefs(hid, p) }

  function toggleWidget(id: string) {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter(h => h !== id)
      : [...prefs.hidden, id]
    updatePrefs({ ...prefs, hidden })
  }

  function onDragStart(id: string) { setDragId(id) }
  function onDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDragOverId(id) }
  function onDrop(id: string) {
    if (!dragId || dragId === id) { setDragId(null); setDragOverId(null); return }
    const order = [...prefs.order]
    const from = order.indexOf(dragId)
    const to = order.indexOf(id)
    if (from >= 0 && to >= 0) { order.splice(from, 1); order.splice(to, 0, dragId) }
    updatePrefs({ ...prefs, order })
    setDragId(null); setDragOverId(null)
  }
  function onDragEnd() { setDragId(null); setDragOverId(null) }

  // ── Visible widgets ────────────────────────────────────────────────────────

  const visibleIds = prefs.order
    .filter(id => WIDGET_META[id])
    .filter(id => !prefs.hidden.includes(id))
    .filter(id => !(WIDGET_META[id].dualOnly && isSingleUser))

  // ── Income bar helper ──────────────────────────────────────────────────────

  function incBars(inc: number, sh: number, pr: number, sv: number) {
    const expenses = inc ? (sh + pr) / inc : 0
    const savings = inc ? sv / inc : 0
    const rest = Math.max(0, 1 - expenses - savings)
    return [
      { label: 'Vaste lasten', pct: expenses, c: accentDark },
      { label: 'Sparen',       pct: savings,  c: accentHex },
      { label: 'Restant',      pct: rest,     c: accentLight },
    ]
  }

  // ── Widget renderers ───────────────────────────────────────────────────────

  function renderFinancieelOverzicht() {
    const cols = isSingleUser ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)'
    const stats = [
      { label: `Inkomen ${n1}`,  val: fmtK(jI),        color: 'var(--ok)',     sub: 'per maand' },
      ...(!isSingleUser ? [{ label: `Inkomen ${n2}`, val: fmtK(dI), color: 'var(--ok)', sub: 'per maand' }] : []),
      { label: `Lasten ${n1}`,   val: fmtK(jSh + jPr), color: 'var(--danger)', sub: 'gezamenlijk + privé' },
      ...(!isSingleUser ? [{ label: `Lasten ${n2}`, val: fmtK(dSh + dPr), color: 'var(--danger)', sub: 'gezamenlijk + privé' }] : []),
      { label: `Restant ${n1}`,  val: fmtK(jR),         color: accentHex,       sub: 'na lasten & sparen' },
      ...(!isSingleUser ? [{ label: `Restant ${n2}`, val: fmtK(dR), color: accentHex, sub: 'na lasten & sparen' }] : []),
    ]
    return (
      <div style={card}>
        <div style={cardHd}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Financieel overzicht</span>
          <DragHandle />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: 'var(--s2)', border: '1px solid var(--card-border)', borderTop: `2px solid ${s.color}`, borderRadius: 8, padding: '13px 15px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: s.color }}><Num v={s.val} /></div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 5 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {/* Donut summary */}
        {totalDonut > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: `conic-gradient(${accentDark} 0% ${shPct}%, ${accentHex} ${shPct}% ${shPct + svPct}%, ${accentLight} ${shPct + svPct}% 100%)`, flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Gezamenlijk', val: totalShared, c: accentDark },
                { label: 'Sparen',      val: totalSparen, c: accentHex },
                { label: 'Privé',       val: totalPrive,  c: accentLight },
              ].map(x => (
                <div key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: x.c, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{x.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}><Num v={fmtK(x.val)} /></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderCashflow() {
    const items = isSingleUser
      ? [{ name: n1, val: jR, inc: jI }]
      : [{ name: n1, val: jR, inc: jI }, { name: n2, val: dR, inc: dI }]
    return (
      <div style={card}>
        <div style={cardHd}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Cashflow</span>
          <DragHandle />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map(({ name, val, inc }) => {
            const pct = inc > 0 ? Math.min(100, Math.max(0, (val / inc) * 100)) : 0
            const color = val >= 0 ? 'var(--ok)' : 'var(--danger)'
            return (
              <div key={name}>
                {!isSingleUser && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{name}</div>}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}><Num v={fmtK(val)} /></span>
                  <span style={{ fontSize: 12, color: 'var(--muted2)' }}>/ maand vrij besteedbaar</span>
                </div>
                <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${pct.toFixed(1)}%`, background: color, transition: 'width .5s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'var(--muted2)' }}>
                  <span>{pct.toFixed(0)}% van inkomen</span>
                  <span><Num v={fmtK(inc)} /> inkomen</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderOverTeMaken() {
    return (
      <div style={card}>
        <div style={cardHd}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Over te maken</span>
          <DragHandle />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[{ name: n1, val: jTr }, { name: n2, val: dTr }].map(({ name, val }) => (
            <div key={name} style={{ flex: 1, background: 'var(--s2)', borderTop: `2px solid ${accentHex}`, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{name}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: accentHex, lineHeight: 1 }}><Num v={fmtK(val)} /></div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 5 }}>p/mnd naar gezamenlijk</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 10, lineHeight: 1.6 }}>
          Gezamenlijke lasten + gedeeld sparen.
          {jTr + dTr > 0 && <> Totaal: <strong style={{ color: 'var(--text)' }}><Num v={fmtK(jTr + dTr)} /></strong>/mnd.</>}
        </div>
      </div>
    )
  }

  function renderInkomenVerdeling() {
    const users = isSingleUser
      ? [{ name: n1, inc: jI, sh: jSh, pr: jPr, sv: jSv }]
      : [{ name: n1, inc: jI, sh: jSh, pr: jPr, sv: jSv }, { name: n2, inc: dI, sh: dSh, pr: dPr, sv: dSv }]
    return (
      <div style={card}>
        <div style={cardHd}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Inkomen &amp; verdeling</span>
          <DragHandle />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? '1fr' : '1fr 1fr', gap: 20 }}>
          {users.map(({ name, inc, sh, pr, sv }) => (
            <div key={name}>
              {!isSingleUser && <div style={{ fontSize: 13, fontWeight: 700, color: accentHex, fontFamily: 'var(--font-heading)', marginBottom: 12 }}>{name}</div>}
              {incBars(inc, sh, pr, sv).map((x, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: 'var(--muted2)' }}>{x.label}</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{(x.pct * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${(Math.max(0, x.pct) * 100).toFixed(2)}%`, background: x.c, transition: 'width .5s ease' }} />
                  </div>
                </div>
              ))}
              {inc > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted2)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                  <span>Totaal inkomen</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ok)' }}><Num v={fmtK(inc)} /></span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderSpaardoelen() {
    const activePots = potten.filter(p => p.goal > 0)
    const totalCurrent = potten.reduce((s, p) => s + (p.current || 0), 0)
    const totalGoal = activePots.reduce((s, p) => s + (p.goal || 0), 0)
    return (
      <div style={card}>
        <div style={cardHd}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Spaardoelen</span>
          <DragHandle />
        </div>
        {activePots.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, textAlign: 'center', padding: '12px 0' }}>
            Nog geen spaardoelen ingesteld.<br />
            <span style={{ color: 'var(--muted2)' }}>Voeg spaarpotjes toe via Sparen.</span>
          </div>
        ) : (
          <>
            {activePots.map(p => {
              const pct = p.goal > 0 ? Math.min(100, (p.current / p.goal) * 100) : 0
              const remaining = Math.max(0, p.goal - p.current)
              const ownerLabel = p.owner === 'user1' ? n1 : p.owner === 'user2' ? n2 : 'Gedeeld'
              const barColor = pct >= 80 ? 'var(--ok)' : pct >= 50 ? accentHex : accentDark
              return (
                <div key={p.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                      {!isSingleUser && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'var(--s2)', color: 'var(--muted)', fontWeight: 600 }}>{ownerLabel}</span>}
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted2)', fontVariantNumeric: 'tabular-nums' }}>
                      <Num v={fmt(p.current, 0)} /> / <Num v={fmt(p.goal, 0)} />
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${pct.toFixed(1)}%`, background: barColor, transition: 'width .5s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--muted2)' }}>
                    <span style={{ color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                    {remaining > 0 && <span>nog <Num v={fmt(remaining, 0)} /></span>}
                  </div>
                </div>
              )
            })}
            {activePots.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6, fontSize: 11 }}>
                <span style={{ color: 'var(--muted2)' }}>{activePots.length} doelen · <Num v={fmt(totalCurrent, 0)} /> gespaard</span>
                <span style={{ fontWeight: 600, color: accentHex }}><Num v={fmt(totalGoal, 0)} /> doel</span>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  function renderSchulden() {
    const totalBalance = schulden.reduce((s, d) => s + (d.balance || 0), 0)
    const totalPayment = schulden.reduce((s, d) => s + (d.payment || 0), 0)
    const maxMonths = schulden.reduce((max, d) => {
      const m = d.payment > 0 ? Math.ceil(d.balance / d.payment) : 0
      return Math.max(max, m)
    }, 0)
    const years = Math.floor(maxMonths / 12)
    const months = maxMonths % 12
    return (
      <div style={card}>
        <div style={cardHd}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Schulden</span>
          <DragHandle />
        </div>
        {schulden.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, textAlign: 'center', padding: '12px 0' }}>
            Geen schulden geregistreerd.<br />
            <span style={{ color: 'var(--muted2)' }}>Voeg schulden toe via Schulden.</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', borderTop: '2px solid var(--danger)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Openstaand</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}><Num v={fmtK(totalBalance)} /></div>
              </div>
              <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', borderTop: `2px solid ${accentHex}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Maand&shy;last</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: accentHex }}><Num v={fmtK(totalPayment)} /></div>
              </div>
            </div>
            {schulden.slice(0, 4).map(d => {
              const months = d.payment > 0 ? Math.ceil(d.balance / d.payment) : null
              const ownerLabel = d.wie === 'user1' ? n1 : d.wie === 'user2' ? n2 : ''
              return (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{d.naam}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>
                      {d.type}{!isSingleUser && ownerLabel ? ` · ${ownerLabel}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}><Num v={fmtK(d.balance)} /></div>
                    {months && <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 1 }}>~{months < 12 ? `${months}mnd` : `${Math.ceil(months/12)}jr`}</div>}
                  </div>
                </div>
              )
            })}
            {schulden.length > 4 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>+{schulden.length - 4} meer</div>}
            {maxMonths > 0 && (
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 10, lineHeight: 1.6 }}>
                Langste looptijd:{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {years > 0 ? `${years}j ` : ''}{months > 0 ? `${months}mnd` : ''}
                </strong>{' '}(vereenvoudigd, zonder rente)
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  function renderAbonnementen() {
    const monthlyTotal = subs.reduce((s, sub) => s + subMonthly(sub), 0)
    const byPerson = isSingleUser ? null : {
      [n1]: subs.filter(s => s.person === 'user1' || s.person === 'shared').reduce((s, sub) => s + (sub.person === 'shared' ? subMonthly(sub) / 2 : subMonthly(sub)), 0),
      [n2]: subs.filter(s => s.person === 'user2' || s.person === 'shared').reduce((s, sub) => s + (sub.person === 'shared' ? subMonthly(sub) / 2 : subMonthly(sub)), 0),
    }
    return (
      <div style={card}>
        <div style={cardHd}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Abonnementen</span>
            {monthlyTotal > 0 && (
              <div style={{ display: 'flex', gap: 16, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--muted2)' }}>Totaal/mnd: <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}><Num v={fmtK(monthlyTotal)} /></strong></span>
                {byPerson && Object.entries(byPerson).map(([name, val]) => (
                  <span key={name} style={{ fontSize: 11, color: 'var(--muted2)' }}>{name}: <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}><Num v={fmtK(val)} /></strong></span>
                ))}
              </div>
            )}
          </div>
          <DragHandle />
        </div>
        {upcoming.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            {subs.length === 0 ? 'Geen abonnementen ingevoerd.' : 'Geen vervaldagen de komende 60 dagen.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {upcoming.map(s => {
              const days = s.days ?? 0
              const urgency = days <= 14
                ? { bg: 'rgba(224,80,80,.1)', color: 'var(--danger)' }
                : days <= 30
                  ? { bg: 'rgba(212,160,23,.1)', color: 'var(--warn)' }
                  : { bg: 'rgba(76,175,130,.1)', color: 'var(--ok)' }
              const ownerLabel = !isSingleUser ? (s.person === 'user1' ? n1 : s.person === 'user2' ? n2 : 'Gedeeld') : null
              return (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      <Num v={fmt(subMonthly(s), 2)} />/mnd
                      {ownerLabel && <> · {ownerLabel}</>}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', background: urgency.bg, color: urgency.color }}>
                    {days <= 0 ? 'Verlopen' : `${days} dgn`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Widget dispatcher ──────────────────────────────────────────────────────

  function renderWidget(id: string): React.ReactNode {
    switch (id) {
      case 'financieel-overzicht': return renderFinancieelOverzicht()
      case 'cashflow':             return renderCashflow()
      case 'over-te-maken':        return renderOverTeMaken()
      case 'inkomen-verdeling':    return renderInkomenVerdeling()
      case 'spaardoelen':          return renderSpaardoelen()
      case 'schulden':             return renderSchulden()
      case 'abonnementen':         return renderAbonnementen()
      default:                     return null
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ overflowX: 'hidden' }}>
      {/* Dashboard header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showWidgetSettings ? 10 : 18 }}>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>Dashboard</span>
        <button
          onClick={() => setShowWidgetSettings(s => !s)}
          title="Widgets beheren"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: `1px solid ${showWidgetSettings ? 'var(--accent)' : 'var(--border)'}`, background: showWidgetSettings ? 'rgba(var(--accent-rgb),.08)' : 'transparent', color: showWidgetSettings ? 'var(--accent)' : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '.15s' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Widgets
        </button>
      </div>

      {/* Widget settings panel */}
      {showWidgetSettings && (
        <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Widgets tonen / verbergen · sleep kaarten om te herordenen</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {DEFAULT_ORDER.map(id => {
              const meta = WIDGET_META[id]
              if (!meta || (meta.dualOnly && isSingleUser)) return null
              const isHidden = prefs.hidden.includes(id)
              return (
                <button
                  key={id}
                  onClick={() => toggleWidget(id)}
                  style={{ padding: '5px 13px', borderRadius: 20, border: `1px solid ${isHidden ? 'var(--border)' : 'var(--accent)'}`, background: isHidden ? 'transparent' : 'rgba(var(--accent-rgb),.1)', color: isHidden ? 'var(--muted)' : 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '.15s' }}
                >
                  {isHidden ? '+ ' : '✓ '}{meta.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Widget grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, alignItems: 'start' }}>
        {visibleIds.map(id => {
          const meta = WIDGET_META[id]
          const isDragging = dragId === id
          const isOver = dragOverId === id && !isDragging
          return (
            <div
              key={id}
              draggable
              onDragStart={() => onDragStart(id)}
              onDragOver={e => onDragOver(e, id)}
              onDrop={() => onDrop(id)}
              onDragEnd={onDragEnd}
              style={{
                gridColumn: meta.fullWidth ? '1 / -1' : undefined,
                opacity: isDragging ? 0.35 : 1,
                transition: 'opacity .15s',
                outline: isOver ? `2px solid var(--accent)` : '2px solid transparent',
                outlineOffset: 2,
                borderRadius: 12,
                cursor: 'default',
              }}
            >
              {renderWidget(id)}
            </div>
          )
        })}
      </div>

      {visibleIds.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: 13 }}>
          Alle widgets zijn verborgen.{' '}
          <button onClick={() => setShowWidgetSettings(true)} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Widgets beheren
          </button>
        </div>
      )}
    </div>
  )
}
