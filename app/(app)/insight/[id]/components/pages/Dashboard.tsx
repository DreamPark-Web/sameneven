'use client'

import { useInsight } from '@/lib/insight-context'
import { useEffect, useState } from 'react'

function fmt(n: number, d = 2) {
  return '€\u00a0' + n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtK(n: number) { return '€\u00a0' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
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

function sum(arr: any[]) {
  return (arr || []).reduce((a: number, i: any) => a + (i.value || 0), 0)
}

function daysUntil(dateStr: string) {
  if (!dateStr) return null
  const today = new Date()
  const next = new Date(dateStr)
  while (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.ceil((next.getTime() - today.getTime()) / 86400000)
}

function subMonthly(s: any) {
  return s.freq === 'jaarlijks' ? s.amount / 12 : s.amount
}

const FREQL: Record<string, string> = {
  maandelijks: 'p/mnd',
  jaarlijks: 'p/jr',
}

function hexToRgb(hex: string) {
  const clean = (hex || '#E8C49A').replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  }
}

function lighten(hex: string, factor = 0.5) {
  const { r, g, b } = hexToRgb(hex)
  const lr = Math.min(255, Math.round(r + (255 - r) * factor))
  const lg = Math.min(255, Math.round(g + (255 - g) * factor))
  const lb = Math.min(255, Math.round(b + (255 - b) * factor))
  return `rgb(${lr}, ${lg}, ${lb})`
}

function darken(hex: string, factor = 0.45) {
  const { r, g, b } = hexToRgb(hex)
  const dr = Math.max(0, Math.round(r * factor))
  const dg = Math.max(0, Math.round(g * factor))
  const db = Math.max(0, Math.round(b * factor))
  return `rgb(${dr}, ${dg}, ${db})`
}

export default function Dashboard() {
  const { data, isSingleUser } = useInsight()
  const [previewTheme, setPreviewTheme] = useState(data.theme || '#E8C49A')

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  const jI = sum(data.user1?.income || [])
  const dI = sum(data.user2?.income || [])
  const totalIncome = jI + dI
  const jRatio = totalIncome ? jI / totalIncome : 0.5
  const dRatio = 1 - jRatio

  const jSh = (data.shared || []).reduce((a: number, c: any) => {
    const v = c.value || 0
    if (c.split === '5050') return a + v / 2
    if (c.split === 'user1') return a + v
    if (c.split === 'user2') return a
    return a + v * jRatio
  }, 0)

  const dSh = (data.shared || []).reduce((a: number, c: any) => {
    const v = c.value || 0
    if (c.split === '5050') return a + v / 2
    if (c.split === 'user1') return a
    if (c.split === 'user2') return a + v
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

    const accentHex = (previewTheme || data.theme || '#E8C49A').toLowerCase()
  const accent = accentHex
  const accentDark = darken(accentHex, 0.45)
  const accentLight = lighten(accentHex, 0.55)
    useEffect(() => {
    setPreviewTheme(data.theme || '#E8C49A')
  }, [data.theme])

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ color?: string }>
      if (customEvent.detail?.color) {
        setPreviewTheme(customEvent.detail.color)
      }
    }

    window.addEventListener('se-theme-preview', handler)
    return () => window.removeEventListener('se-theme-preview', handler)
  }, [])

  const totalShared = jSh + dSh
  const totalSparen = jSv + dSv
  const totalPrive = jPr + dPr
  const totalDonut = totalShared + totalSparen + totalPrive

  const sharedPct = totalDonut ? (totalShared / totalDonut) * 100 : 0
  const sparenPct = totalDonut ? (totalSparen / totalDonut) * 100 : 0
  const privePct = totalDonut ? (totalPrive / totalDonut) * 100 : 0

  const donutBackground =
    totalDonut > 0
      ? `conic-gradient(
          ${accentDark} 0% ${sharedPct}%,
          ${accent} ${sharedPct}% ${sharedPct + sparenPct}%,
          ${accentLight} ${sharedPct + sparenPct}% 100%
        )`
      : 'var(--s3)'

  const upcoming = (data.abonnementen || [])
    .map((s: any) => ({ ...s, days: daysUntil(s.date) }))
    .filter((s: any) => s.days !== null && s.days >= -3 && s.days <= 60)
    .sort((a: any, b: any) => a.days - b.days)

  function renderPerc(inc: number, sh: number, pr: number, sv: number) {
    const l = inc ? (sh + pr) / inc : 0
    const sp = inc ? sv / inc : 0
    const r = Math.max(0, 1 - l - sp)

    return [
      { label: 'Vaste lasten', pct: l, c: accentDark },
      { label: 'Sparen', pct: sp, c: accent },
      { label: 'Prive restant', pct: r, c: accentLight },
    ]
  }

  const panel: React.CSSProperties = {
    background: 'var(--s3)',
    border: '1px solid var(--card-border)',
    borderRadius: 8,
    padding: '22px 26px',
    marginBottom: 0,
  }

  const panelHd: React.CSSProperties = {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  }

  return (
    <div style={{ overflowX: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>
        <div style={{ gridColumn: '1 / -1', ...panel }}>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Dashboard overzicht</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isSingleUser ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 12, alignItems: 'stretch' }}>
            {[
              { label: `Inkomen ${n1}`, val: fmtK(jI), color: 'var(--ok)', border: 'var(--ok)', sub: 'per maand' },
              ...(!isSingleUser ? [{ label: `Inkomen ${n2}`, val: fmtK(dI), color: 'var(--ok)', border: 'var(--ok)', sub: 'per maand' }] : []),
              { label: `Lasten ${n1}`, val: fmtK(jSh + jPr), color: 'var(--danger)', border: 'var(--danger)', sub: 'gezamenlijk + prive' },
              ...(!isSingleUser ? [{ label: `Lasten ${n2}`, val: fmtK(dSh + dPr), color: 'var(--danger)', border: 'var(--danger)', sub: 'gezamenlijk + prive' }] : []),
              { label: `Restant ${n1}`, val: fmtK(jR), color: 'var(--accent)', border: 'var(--accent)', sub: 'na lasten & sparen' },
              ...(!isSingleUser ? [{ label: `Restant ${n2}`, val: fmtK(dR), color: 'var(--accent)', border: 'var(--accent)', sub: 'na lasten & sparen' }] : []),
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--s2)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 8,
                  padding: '15px 17px',
                  borderTop: `1px solid ${s.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: 'rgba(245,245,245,0.45)',
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    lineHeight: 1,
                    margin: '6px 0 4px',
                    color: s.color,
                  }}
                >
                  <Num v={s.val} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.6 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {!isSingleUser && (
          <div style={panel}>
            <div style={panelHd}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                  Maandelijks
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                  Over te maken naar gezamenlijke rekening
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {[{ name: n1, val: jTr }, { name: n2, val: dTr }].map(({ name, val }) => (
                <div
                  key={name}
                  style={{
                    background: 'var(--s2)',
                    border: '1px solid var(--card-border)',
                    borderTop: '1px solid var(--accent)',
                    borderRadius: 8,
                    padding: '16px 20px',
                    textAlign: 'center',
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(245,245,245,0.45)' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, margin: '6px 0 4px', color: 'var(--accent)' }}>
                    <Num v={fmtK(val)} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted2)' }}>per maand</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 10, lineHeight: 1.6 }}>
              Lasten + gezamenlijke spaarbijdrage.
            </div>
          </div>
        )}


        <div style={panel}>
          <div style={panelHd}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>
                {n1}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                Verdeling inkomen
              </span>
            </div>
          </div>

          {renderPerc(jI, jSh, jPr, jSv).map((x, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12.5 }}>
                <span>{x.label}</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
                  {(x.pct * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 5, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 3,
                    width: `${(Math.max(0, x.pct) * 100).toFixed(2)}%`,
                    background: x.c,
                    transition: 'width .5s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {!isSingleUser && (
          <div style={panel}>
            <div style={panelHd}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>
                  {n2}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                  Verdeling inkomen
                </span>
              </div>
            </div>

            {renderPerc(dI, dSh, dPr, dSv).map((x, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12.5 }}>
                  <span>{x.label}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
                    {(x.pct * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 5, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      width: `${(Math.max(0, x.pct) * 100).toFixed(2)}%`,
                      background: x.c,
                      transition: 'width .5s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ gridColumn: '1 / -1', ...panel }}>
          <div style={panelHd}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                Vervaldagen abonnementen
              </span>
            </div>
          </div>

          {upcoming.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.6 }}>
              Geen vervaldagen de komende 60 dagen.
            </div>
          ) : (
            upcoming.map((s: any) => {
              const bcStyle =
                s.days <= 0
                  ? { background: 'rgba(224,80,80,.12)', color: 'var(--danger)' }
                  : s.days <= 14
                    ? { background: 'rgba(224,80,80,.12)', color: 'var(--danger)' }
                    : s.days <= 30
                      ? { background: 'rgba(212,160,23,.12)', color: 'var(--warn)' }
                      : { background: 'rgba(76,175,130,.12)', color: 'var(--ok)' }

              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: 'var(--s3)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    marginBottom: 6,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      <Num v={fmt(s.amount, 2)} /> {FREQL[s.freq] || ''} · <Num v={fmt(subMonthly(s), 2)} />/mnd
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '.07em',
                      textTransform: 'uppercase',
                      padding: '3px 7px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      ...bcStyle,
                    }}
                  >
                    {s.days <= 0 ? 'Verlopen' : `${s.days} dgn`}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}