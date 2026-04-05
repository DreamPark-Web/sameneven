'use client'

import { useInsight } from '@/lib/insight-context'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { fmtK, sum } from '@/lib/format'
import { PAGE_COLORS } from '@/lib/pageColors'
import { buildAutoKosten, AutoKostSplits } from '@/lib/schuld-calc'

type Sub = { id: string; name: string; date: string; amount: number; freq: string; person: string; split?: string; p1?: number; p2?: number }
type SavItem = { id: string; label: string; value: number; split?: string; p1?: number; p2?: number }
type SharedItem = { id: string; label: string; value: number; split: string; p1?: number; p2?: number }
type Schuld = { id: string; naam: string; type: string; wie: string; balance: number; payment: number; rate: number; fixedYears?: number; fixedStart?: string; createdAt?: string; loanType?: string; rentePeriodes?: { id: string; startDate: string; endDate?: string; rate: number }[] }
type AttentionItem = { id: string; priority: 'red' | 'orange'; title: string; action: { label: string; page: string; tab?: string } }
type Pot = { id: string; label: string; current: number; goal: number; owner: string }
type ActiveFilter = 'samen' | 'user1' | 'user2'
type DashPrefs = { hidden: string[] }

const DEFAULT_WIDGETS = ['over-te-maken', 'spaardoelen', 'schulden', 'abonnementen', 'inkomen']
const WIDGET_LABELS: Record<string, string> = {
  'over-te-maken': 'Over te maken',
  'spaardoelen':   'Spaardoelen',
  'schulden':      'Schulden',
  'abonnementen':  'Abonnementen',
  'inkomen':       'Inkomen',
}

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


function loadPrefs(hid: string): DashPrefs {
  try {
    const raw = localStorage.getItem(`se_dash_${hid}`)
    if (raw) {
      const p = JSON.parse(raw) as Partial<DashPrefs>
      return { hidden: p.hidden || [] }
    }
  } catch {}
  return { hidden: [] }
}

function savePrefs(hid: string, p: DashPrefs) {
  try { localStorage.setItem(`se_dash_${hid}`, JSON.stringify(p)) } catch {}
}

const card: CSSProperties = {
  background: 'var(--s3)',
  border: '1px solid var(--card-border)',
  borderRadius: 10,
  padding: '20px 22px',
  display: 'flex',
  flexDirection: 'column',
}

export default function Dashboard() {
  const { data, isSingleUser, household, canEdit } = useInsight()
  const hid = household?.id || 'local'

  const [prefs, setPrefs] = useState<DashPrefs>({ hidden: [] })
  const [showWidgetSettings, setShowWidgetSettings] = useState(false)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('samen')
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => { setPrefs(loadPrefs(hid)) }, [hid])

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  const jI = sum(data.user1?.income || [])
  const dI = sum(data.user2?.income || [])
  const totalIncome = jI + dI
  const jIRatio = sum((data.user1?.income || []).filter((i: { excludeFromRatio?: boolean }) => !i.excludeFromRatio))
  const dIRatio = sum((data.user2?.income || []).filter((i: { excludeFromRatio?: boolean }) => !i.excludeFromRatio))
  const totalRatio = jIRatio + dIRatio
  const jRatio = totalRatio ? jIRatio / totalRatio : 0.5
  const dRatio = 1 - jRatio

  const sharedItems = (data.shared as SharedItem[] || [])
  const autoKosten = buildAutoKosten(data.schulden || [], (data.autoKostenSplits as AutoKostSplits | undefined) || {})
  function calcSplit(split: string, value: number, p1: number | undefined, p2: number | undefined): { u1: number; u2: number } {
    if (split === '5050') return { u1: value / 2, u2: value / 2 }
    if (split === 'user1') return { u1: value, u2: 0 }
    if (split === 'user2') return { u1: 0, u2: value }
    if (split === 'percent') return { u1: value * (p1 ?? 50) / 100, u2: value * (p2 ?? 50) / 100 }
    return { u1: value * jRatio, u2: value * dRatio }
  }
  const jSh = sharedItems.reduce((a, c) => a + calcSplit(c.split, c.value || 0, c.p1, c.p2).u1, 0)
    + autoKosten.reduce((a, c) => a + calcSplit(c.split, c.value, undefined, undefined).u1, 0)
  const dSh = sharedItems.reduce((a, c) => a + calcSplit(c.split, c.value || 0, c.p1, c.p2).u2, 0)
    + autoKosten.reduce((a, c) => a + calcSplit(c.split, c.value, undefined, undefined).u2, 0)

  const jPr = sum(data.user1?.private || [])
  const dPr = sum(data.user2?.private || [])
  const jSprivate = sum(data.user1?.savings?.private || [])
  const dSprivate = sum(data.user2?.savings?.private || [])

  const allSavSh = [
    ...(data.user1?.savings?.shared as SavItem[] || []),
    ...(data.user2?.savings?.shared as SavItem[] || []),
  ]
  function splitSavItem(item: SavItem): { u1: number; u2: number } {
    const s = item.split || '5050'
    const v = item.value || 0
    if (s === 'user1') return { u1: v, u2: 0 }
    if (s === 'user2') return { u1: 0, u2: v }
    if (s === 'percent') return { u1: v * (item.p1 ?? 50) / 100, u2: v * (item.p2 ?? 50) / 100 }
    if (s === 'ratio') return { u1: v * jRatio, u2: v * dRatio }
    return { u1: v / 2, u2: v / 2 }
  }
  const jSsh = allSavSh.reduce((a, i) => a + splitSavItem(i).u1, 0)
  const dSsh = allSavSh.reduce((a, i) => a + splitSavItem(i).u2, 0)

  const subs = (data.abonnementen as Sub[] || [])
  const gezSubs = subs.filter(s => s.person === 'gezamenlijk')
  function subSplitMonthly(s: Sub): { u1: number; u2: number } {
    const m = subMonthly(s)
    const sp = s.split || '5050'
    if (sp === 'user1') return { u1: m, u2: 0 }
    if (sp === 'user2') return { u1: 0, u2: m }
    if (sp === 'percent') return { u1: m * (s.p1 ?? 50) / 100, u2: m * (s.p2 ?? 50) / 100 }
    if (sp === 'ratio') return { u1: m * jRatio, u2: m * dRatio }
    return { u1: m / 2, u2: m / 2 }
  }
  const jSubGez = gezSubs.reduce((a, s) => a + subSplitMonthly(s).u1, 0)
  const dSubGez = gezSubs.reduce((a, s) => a + subSplitMonthly(s).u2, 0)

  const jTr = jSh + jSsh + jSubGez
  const dTr = dSh + dSsh + dSubGez
  const jR = jI - jTr - jPr - jSprivate
  const dR = dI - dTr - dPr - dSprivate


  const schulden = (data.schulden as Schuld[] || [])
  const potten = (data.spaarpotjes as Pot[] || [])

  function goTo(page: string, tab?: string) {
    const params = new URLSearchParams(window.location.search)
    params.set('page', page)
    if (tab) params.set('tab', tab); else params.delete('tab')
    window.history.replaceState(null, '', `?${params.toString()}`)
    window.dispatchEvent(new CustomEvent('se-navigate', { detail: { page } }))
  }

  const attentionItems: AttentionItem[] = []
  for (const sub of subs) {
    const days = daysUntil(sub.date)
    if (days !== null && days >= 0 && days <= 7) {
      attentionItems.push({ id: `sub-${sub.id}`, priority: 'red', title: `${sub.name} verloopt over ${days === 0 ? 'vandaag' : `${days} dag${days !== 1 ? 'en' : ''}`}`, action: { label: 'Bekijk abonnementen', page: 'kosten', tab: 'abonnementen' } })
    }
  }
  for (const sc of schulden) {
    const periodes = (sc.rentePeriodes || []).slice().sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    if (periodes.length > 0) {
      const today = new Date()
      const activePeriode = periodes.find(p => { const s = new Date(p.startDate); const e = p.endDate ? new Date(p.endDate) : null; return today >= s && (!e || today < e) })
      if (activePeriode?.endDate) {
        const end = new Date(activePeriode.endDate)
        const days = Math.ceil((end.getTime() - today.getTime()) / 86400000)
        const nextPeriode = periodes.find(p => new Date(p.startDate) > today)
        if (days >= 0 && days <= 60 && (!nextPeriode || !nextPeriode.rate)) {
          attentionItems.push({ id: `sc-rp-${sc.id}`, priority: days <= 14 ? 'red' : 'orange', title: `Rentevaste periode ${sc.naam} loopt af op ${end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} — vul nieuwe rente in`, action: { label: 'Bekijk schulden', page: 'vermogen', tab: 'schulden' } })
        }
      }
    } else if (sc.fixedYears && sc.fixedYears > 0 && sc.fixedStart) {
      const e = new Date(sc.fixedStart)
      e.setFullYear(e.getFullYear() + sc.fixedYears)
      const days = Math.ceil((e.getTime() - Date.now()) / 86400000)
      if (days >= 0 && days <= 60) {
        attentionItems.push({ id: `sc-${sc.id}`, priority: days <= 14 ? 'red' : 'orange', title: `Rentevaste periode ${sc.naam} verloopt over ${days} dagen`, action: { label: 'Bekijk schulden', page: 'vermogen', tab: 'schulden' } })
      }
    }
  }
  for (const pot of potten) {
    const ts = (pot as any).updatedAt || (pot as any).createdAt
    if (ts) {
      const daysSince = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
      if (daysSince > 60) {
        attentionItems.push({ id: `pot-${pot.id}`, priority: 'orange', title: `${pot.label} heeft ${Math.floor(daysSince / 30)} maanden geen update gehad`, action: { label: 'Bekijk sparen', page: 'vermogen', tab: 'sparen' } })
      }
    }
  }
  if (!data.user1?.income?.length && canEdit('user1')) {
    attentionItems.push({ id: 'no-inc-1', priority: 'orange', title: `${n1} heeft nog geen inkomsten ingevuld`, action: { label: 'Voeg inkomsten toe', page: 'inkomsten' } })
  }
  if (!isSingleUser && !data.user2?.income?.length && canEdit('user2')) {
    attentionItems.push({ id: 'no-inc-2', priority: 'orange', title: `${n2} heeft nog geen inkomsten ingevuld`, action: { label: 'Voeg inkomsten toe', page: 'inkomsten' } })
  }
  const attentionSlice = attentionItems.slice(0, 4)

  const sevenDaysAgo = Date.now() - 7 * 86400000
  const recentChanges: string[] = []
  for (const item of [...(data.user1?.income || []), ...(data.user2?.income || [])]) {
    if (item.createdAt && new Date(item.createdAt).getTime() > sevenDaysAgo) recentChanges.push(`+ ${item.label} toegevoegd aan inkomsten`)
  }
  for (const item of [...(data.user1?.private || []), ...(data.user2?.private || []), ...(data.shared || [])]) {
    if (item.createdAt && new Date(item.createdAt).getTime() > sevenDaysAgo) recentChanges.push(`+ ${item.label} toegevoegd aan kosten`)
  }
  for (const pot of potten) {
    if ((pot as any).createdAt && new Date((pot as any).createdAt).getTime() > sevenDaysAgo) recentChanges.push(`+ ${pot.label} spaardoel toegevoegd`)
    else if ((pot as any).updatedAt && new Date((pot as any).updatedAt).getTime() > sevenDaysAgo) recentChanges.push(`${pot.label} spaardoel bijgewerkt`)
  }
  for (const sc of schulden) {
    if (sc.createdAt && new Date(sc.createdAt).getTime() > sevenDaysAgo) recentChanges.push(`+ ${sc.naam} schuld toegevoegd`)
  }
  for (const sub of subs) {
    if ((sub as any).createdAt && new Date((sub as any).createdAt).getTime() > sevenDaysAgo) recentChanges.push(`+ ${sub.name} abonnement toegevoegd`)
  }
  const recentPills = recentChanges.slice(0, 3)

  const colors = PAGE_COLORS.dashboard
  const dashColor = isDark ? colors.dark : colors.light


  function updatePrefs(p: DashPrefs) { setPrefs(p); savePrefs(hid, p) }
  function toggleWidget(id: string) {
    const hidden = prefs.hidden.includes(id) ? prefs.hidden.filter(h => h !== id) : [...prefs.hidden, id]
    updatePrefs({ hidden })
  }
  function isHidden(id: string) { return prefs.hidden.includes(id) }

  const heroUsers = isSingleUser
    ? [{ slot: 'user1' as const, name: n1, income: jI, rest: jR }]
    : activeFilter === 'samen'
      ? [{ slot: 'user1' as const, name: n1, income: jI, rest: jR }, { slot: 'user2' as const, name: n2, income: dI, rest: dR }]
      : activeFilter === 'user1'
        ? [{ slot: 'user1' as const, name: n1, income: jI, rest: jR }]
        : [{ slot: 'user2' as const, name: n2, income: dI, rest: dR }]

  const overTeMakenUsers = isSingleUser
    ? [{ name: n1, val: jTr }]
    : activeFilter === 'samen'
      ? [{ name: n1, val: jTr }, { name: n2, val: dTr }]
      : activeFilter === 'user1'
        ? [{ name: n1, val: jTr }]
        : [{ name: n2, val: dTr }]

  const filteredPotten = isSingleUser || activeFilter === 'samen'
    ? potten
    : potten.filter(p => p.owner === activeFilter)

  const filteredSchulden = isSingleUser || activeFilter === 'samen'
    ? schulden
    : schulden.filter(sc => sc.wie === activeFilter)

  const filteredSubsTotal = (() => {
    if (isSingleUser || activeFilter === 'samen') return subs.reduce((a, s) => a + subMonthly(s), 0)
    if (activeFilter === 'user1') return subs.filter(s => s.person === 'user1').reduce((a, s) => a + subMonthly(s), 0) + jSubGez
    return subs.filter(s => s.person === 'user2').reduce((a, s) => a + subMonthly(s), 0) + dSubGez
  })()

  const filteredInkomen = activeFilter === 'user2' ? dI : activeFilter === 'user1' ? jI : totalIncome

  const expiringSoon = subs.filter(s => {
    const days = daysUntil(s.date)
    return days !== null && days >= 0 && days <= 7
  })

  const midVisible = (['over-te-maken', 'spaardoelen'] as const).filter(id => !isHidden(id))
  const botVisible = (['inkomen', 'schulden', 'abonnementen'] as const).filter(id => !isHidden(id))

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showWidgetSettings ? 10 : 18 }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)', color: dashColor }}>Dashboard</span>
          {recentPills.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {recentPills.map((label, i) => (
                <span key={i} style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>{label}</span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowWidgetSettings(s => !s)}
          title="Widgets beheren"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: `1px solid ${showWidgetSettings ? dashColor : 'var(--border)'}`, background: showWidgetSettings ? colors.bg : 'transparent', color: showWidgetSettings ? dashColor : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '.15s', fontFamily: 'var(--font-body)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Widgets
        </button>
      </div>

      {/* Widget settings */}
      {showWidgetSettings && (
        <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Widgets tonen / verbergen</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {DEFAULT_WIDGETS.map(id => {
              const hidden = prefs.hidden.includes(id)
              return (
                <button key={id} onClick={() => toggleWidget(id)} style={{ padding: '5px 13px', borderRadius: 20, border: `1px solid ${hidden ? 'var(--border)' : dashColor}`, background: hidden ? 'transparent' : colors.bg, color: hidden ? 'var(--muted)' : dashColor, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '.15s', fontFamily: 'var(--font-body)' }}>
                  {hidden ? '+ ' : '✓ '}{WIDGET_LABELS[id]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Attention */}
      {attentionSlice.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {attentionSlice.map(item => (
            <div key={item.id} style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 12.5, color: '#FCD34D', lineHeight: 1.4 }}>{item.title}</span>
              <button onClick={() => goTo(item.action.page, item.action.tab)} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(217,119,6,0.4)', color: '#FCD34D', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--font-body)' }}>
                {item.action.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      {!isSingleUser && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {([
            { id: 'samen' as ActiveFilter, label: 'Gezamenlijk' },
            { id: 'user1' as ActiveFilter, label: n1 },
            { id: 'user2' as ActiveFilter, label: n2 },
          ]).map(f => {
            const active = activeFilter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', border: active ? '1px solid #6366F1' : '1px solid var(--border)', background: active ? 'rgba(99,102,241,0.2)' : 'transparent', color: active ? (isDark ? '#818CF8' : '#6366F1') : 'var(--muted)', transition: 'all .15s' }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Hero — vrij besteedbaar */}
      <div style={{ display: 'grid', gridTemplateColumns: heroUsers.length === 1 ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {heroUsers.map(u => {
          const pct = u.income > 0 ? Math.max(0, Math.min(100, (u.rest / u.income) * 100)) : 0
          const isNeg = u.rest < 0
          return (
            <div key={u.slot} style={{ ...card }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Vrij besteedbaar</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: dashColor, marginBottom: 6 }}>{u.name}</div>
              <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1, color: isNeg ? 'var(--danger)' : 'var(--text)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                <Num v={fmtK(u.rest)} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
                {u.income > 0 ? `${pct.toFixed(0)}% van inkomen · totaal ${fmtK(u.income)}/mnd` : 'Geen inkomen ingevuld'}
              </div>
              <div style={{ height: 8, background: 'var(--s2)', borderRadius: 4, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ height: '100%', width: `${pct.toFixed(1)}%`, background: isNeg ? 'var(--danger)' : dashColor, borderRadius: 4, transition: 'width .4s ease' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Middle row */}
      {midVisible.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${midVisible.length}, 1fr)`, gap: 14, marginBottom: 14 }}>
          {midVisible.includes('over-te-maken') && (
            <div style={{ ...card }}>
              <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Over te maken</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>naar gezamenlijke rekening</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {overTeMakenUsers.map(u => (
                  <div key={u.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>p/mnd naar gezamenlijk</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: dashColor, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}><Num v={fmtK(u.val)} /></div>
                  </div>
                ))}
                {activeFilter === 'samen' && !isSingleUser && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, fontSize: 12 }}>
                    <span style={{ color: 'var(--muted2)', fontWeight: 600 }}>Totaal</span>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}><Num v={fmtK(jTr + dTr)} />/mnd</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {midVisible.includes('spaardoelen') && (() => {
            const activePots = filteredPotten.filter(p => p.goal > 0)
            const barColor = isDark ? '#60A5FA' : '#3B82F6'
            return (
              <div style={{ ...card }}>
                <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Spaardoelen</div>
                  {activePots.length > 0 && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{activePots.length} actieve {activePots.length === 1 ? 'doel' : 'doelen'}</div>}
                </div>
                {activePots.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, textAlign: 'center', padding: '12px 0' }}>
                    Geen spaardoelen ingesteld.<br /><span style={{ color: 'var(--muted2)' }}>Voeg spaarpotjes toe via Vermogen → Sparen.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {activePots.map(p => {
                      const pct = Math.min(100, (p.current / p.goal) * 100)
                      const ownerLabel = p.owner === 'user1' ? n1 : p.owner === 'user2' ? n2 : 'Gedeeld'
                      return (
                        <div key={p.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                              {!isSingleUser && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'var(--s2)', color: 'var(--muted)', fontWeight: 600 }}>{ownerLabel}</span>}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{pct.toFixed(0)}%</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${pct.toFixed(1)}%`, background: barColor, transition: 'width .5s ease' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Bottom row */}
      {botVisible.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${botVisible.length}, 1fr)`, gap: 14, alignItems: 'stretch' }}>
          {botVisible.includes('inkomen') && (() => {
            const incColor = isDark ? '#34D399' : '#10B981'
            return (
              <div style={{ ...card, height: '100%' }}>
                <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Inkomen</div>
                </div>
                <div style={{ background: 'rgba(16,185,129,0.06)', border: '0.5px solid rgba(16,185,129,0.15)', borderRadius: 8, padding: '12px 16px', marginBottom: 12, height: '96px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                    {activeFilter === 'samen' ? 'Gecombineerd' : activeFilter === 'user1' ? n1 : n2}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: incColor, lineHeight: 1 }}><Num v={fmtK(filteredInkomen)} /></div>
                </div>
                {!isSingleUser && activeFilter === 'samen' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { name: n1, income: jI, ratio: jRatio },
                      { name: n2, income: dI, ratio: dRatio },
                    ].map(u => (
                      <div key={u.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: 'var(--muted2)' }}>{u.name}</span>
                          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{(u.ratio * 100).toFixed(0)}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(u.ratio * 100).toFixed(1)}%`, background: incColor, borderRadius: 3, transition: 'width .4s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
          {botVisible.includes('schulden') && (() => {
            const totalBalance = filteredSchulden.reduce((s, d) => s + (d.balance || 0), 0)
            const totalPayment = filteredSchulden.reduce((s, d) => s + (d.payment || 0), 0)
            const maxMonths = filteredSchulden.reduce((max, d) => Math.max(max, d.payment > 0 ? Math.ceil(d.balance / d.payment) : 0), 0)
            const dangerColor = isDark ? '#F87171' : '#EF4444'
            return (
              <div style={{ ...card, height: '100%' }}>
                <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Schulden</div>
                </div>
                {filteredSchulden.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, textAlign: 'center', padding: '12px 0' }}>Geen schulden geregistreerd.</div>
                ) : (
                  <>
                    <div style={{ background: 'rgba(239,68,68,0.06)', border: '0.5px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '12px 16px', marginBottom: 12, height: '96px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, boxSizing: 'border-box' }}>
                      {[{ label: 'Openstaand', val: fmtK(totalBalance) }, { label: 'Maandlast', val: fmtK(totalPayment) }].map(s => (
                        <div key={s.label} style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{s.label}</div>
                          <div style={{ fontSize: 26, fontWeight: 700, color: dangerColor, lineHeight: 1 }}><Num v={s.val} /></div>
                        </div>
                      ))}
                    </div>
                    {filteredSchulden.slice(0, 3).map(d => {
                      const months = d.payment > 0 ? Math.ceil(d.balance / d.payment) : null
                      const ownerLabel = !isSingleUser && d.wie ? (d.wie === 'user1' ? n1 : n2) : ''
                      return (
                        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{d.naam}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>{d.type}{!isSingleUser && ownerLabel ? ` · ${ownerLabel}` : ''}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: dangerColor }}><Num v={fmtK(d.balance)} /></div>
                            {months && <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 1 }}>~{months < 12 ? `${months}mnd` : `${Math.ceil(months / 12)}jr`}</div>}
                          </div>
                        </div>
                      )
                    })}
                    {filteredSchulden.length > 3 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>+{filteredSchulden.length - 3} meer</div>}
                    {maxMonths > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 10, lineHeight: 1.6 }}>
                        Langste looptijd: <strong style={{ color: 'var(--text)' }}>{Math.floor(maxMonths / 12) > 0 ? `${Math.floor(maxMonths / 12)}j ` : ''}{maxMonths % 12 > 0 ? `${maxMonths % 12}mnd` : ''}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })()}

          {botVisible.includes('abonnementen') && (() => {
            const subColor = isDark ? '#FBBF24' : '#D97706'
            return (
              <div style={{ ...card, height: '100%' }}>
                <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Abonnementen</div>
                </div>
                <div style={{ background: 'rgba(217,119,6,0.06)', border: '0.5px solid rgba(217,119,6,0.15)', borderRadius: 8, padding: '12px 16px', marginBottom: 12, height: '96px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Totaal per maand</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: subColor, lineHeight: 1 }}><Num v={fmtK(filteredSubsTotal)} /></div>
                </div>
                {expiringSoon.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 10 }}>
                    {expiringSoon.map(s => {
                      const days = daysUntil(s.date)
                      return (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{s.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)' }}>{days === 0 ? 'vandaag' : `${days} dgn`}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {subs.length > 0 && (
                  <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted2)' }}>
                    {subs.length} abonnement{subs.length !== 1 ? 'en' : ''} totaal
                  </div>
                )}
              </div>
            )
          })()}

        </div>
      )}
    </div>
  )
}
