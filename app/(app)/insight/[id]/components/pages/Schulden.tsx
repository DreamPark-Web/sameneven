'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type Schuld = { id: string; naam: string; type: string; wie: string; balance: number; payment: number; rate: number; fixedYears: number; fixedStart: string }

function fmtK(n: number) { return '€\u00a0' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') }

function calcMonths(bal: number, pay: number, rate: number) {
  if (!bal || !pay || pay <= 0) return null
  const r = rate / 100 / 12
  if (r === 0) return Math.ceil(bal / pay)
  if (pay <= bal * r) return Infinity
  return Math.ceil(-Math.log(1 - (r * bal / pay)) / Math.log(1 + r))
}

const STYPES = ['studieschuld', 'hypotheek', 'persoonlijke lening', 'creditcard', 'overig']

export default function Schulden() {
  const { data, saveData, canEdit } = useInsight()
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const schulden: Schuld[] = data.schulden || []
  const editable = canEdit('user1') || canEdit('user2')

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ naam: '', type: 'overig', wie: 'user1', balance: '', payment: '', rate: '', fixedYears: '0', fixedStart: '' })

  function addSchuld() {
    if (!form.naam.trim()) return
    const s: Schuld = { id: 'sc' + Date.now(), naam: form.naam.trim(), type: form.type, wie: form.wie, balance: parseFloat(form.balance) || 0, payment: parseFloat(form.payment) || 0, rate: parseFloat(form.rate) || 0, fixedYears: parseInt(form.fixedYears) || 0, fixedStart: form.fixedStart }
    saveData({ ...data, schulden: [...schulden, s] })
    setForm({ naam: '', type: 'overig', wie: 'user1', balance: '', payment: '', rate: '', fixedYears: '0', fixedStart: '' })
    setShowAdd(false)
  }
  function deleteSchuld(id: string) { saveData({ ...data, schulden: schulden.filter(s => s.id !== id) }) }
  function editSchuld(id: string, field: string, val: string) {
    saveData({ ...data, schulden: schulden.map(s => s.id === id ? { ...s, [field]: ['balance', 'payment', 'rate', 'fixedYears'].includes(field) ? parseFloat(val) || 0 : val } : s) })
  }

  const totalBalance = schulden.reduce((a, s) => a + (s.balance || 0), 0)
  const totalPayment = schulden.reduce((a, s) => a + (s.payment || 0), 0)
  const totalInterest = schulden.reduce((a, s) => {
    const m = calcMonths(s.balance, s.payment, s.rate)
    if (m && m !== Infinity) return a + Math.max(0, m * s.payment - s.balance)
    return a
  }, 0)

  const panel: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
  const inp: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', width: '100%', fontVariantNumeric: 'tabular-nums' }
  const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }

  return (
    <div>
      <div style={panel}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Overzicht</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Schulden</span>
          </div>
          {editable && <button onClick={() => setShowAdd(!showAdd)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted2)' }}>+ Toevoegen</button>}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 14, lineHeight: 1.7 }}>DUO, hypotheek, autolening, etc. Stel rentevaste periode in voor een vervaldatummelding.</div>

        {showAdd && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={eyebrow}>Naam</div>
                <input style={{ ...inp, textAlign: 'left' }} placeholder="Naam schuld" value={form.naam} onChange={e => setForm({ ...form, naam: e.target.value })} />
              </div>
              <div>
                <div style={eyebrow}>Type</div>
                <select style={{ ...inp, textAlign: 'left', cursor: 'pointer' } as any} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {STYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <div style={eyebrow}>Van wie</div>
                <select style={{ ...inp, textAlign: 'left', cursor: 'pointer' } as any} value={form.wie} onChange={e => setForm({ ...form, wie: e.target.value })}>
                  <option value="user1">{n1}</option>
                  <option value="user2">{n2}</option>
                  <option value="samen">Samen</option>
                </select>
              </div>
              <div>
                <div style={eyebrow}>Huidige schuld</div>
                <input style={inp} type="number" placeholder="€" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
              </div>
              <div>
                <div style={eyebrow}>Maand. aflossing</div>
                <input style={inp} type="number" placeholder="€" value={form.payment} onChange={e => setForm({ ...form, payment: e.target.value })} />
              </div>
              <div>
                <div style={eyebrow}>Jaarrente (%)</div>
                <input style={inp} type="number" step="0.01" placeholder="%" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
              </div>
              <div>
                <div style={eyebrow}>Rentevaste periode (jr)</div>
                <input style={inp} type="number" step="1" value={form.fixedYears} onChange={e => setForm({ ...form, fixedYears: e.target.value })} />
              </div>
              <div>
                <div style={eyebrow}>Startdatum rente</div>
                <input style={{ ...inp, textAlign: 'left', fontSize: 11 }} type="date" value={form.fixedStart} onChange={e => setForm({ ...form, fixedStart: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--muted2)', border: '1px solid var(--border)' }}>Annuleren</button>
              <button onClick={addSchuld} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#0a0a0a' }}>Toevoegen</button>
            </div>
          </div>
        )}

        {schulden.map(sc => {
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
            fixedBadge = { text: dl < 0 ? 'Rentevaste periode verlopen' : `Rente vast t/m ${e.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })} (${Math.round(dl / 30)} mnd)`, ...cls }
          }

          return (
            <div key={sc.id} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {editable ? (
                    <input defaultValue={sc.naam} onBlur={e => editSchuld(sc.id, 'naam', e.target.value)}
                      style={{ display: 'block', fontSize: 14, fontWeight: 700, background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: 'var(--font-body)', outline: 'none', width: '100%', maxWidth: 300 }} />
                  ) : <div style={{ fontSize: 14, fontWeight: 700 }}>{sc.naam}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 4, background: 'rgba(0,194,255,.1)', color: 'var(--accent)', border: '1px solid rgba(0,194,255,.18)' }}>{wieLabel}</span>
                    <select value={sc.type} onChange={e => editSchuld(sc.id, 'type', e.target.value)} disabled={!editable}
                      style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '3px 6px', fontSize: 11, fontFamily: 'var(--font-body)', cursor: editable ? 'pointer' : 'default' }}>
                      {STYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                    <select value={sc.wie} onChange={e => editSchuld(sc.id, 'wie', e.target.value)} disabled={!editable}
                      style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '3px 6px', fontSize: 11, fontFamily: 'var(--font-body)', cursor: editable ? 'pointer' : 'default' }}>
                      <option value="user1">{n1}</option><option value="user2">{n2}</option><option value="samen">Samen</option>
                    </select>
                  </div>
                </div>
                {editable && <button onClick={() => deleteSchuld(sc.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>×</button>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Huidige schuld', field: 'balance', val: sc.balance, step: '100' },
                  { label: 'Maand. aflossing', field: 'payment', val: sc.payment, step: '1' },
                  { label: 'Jaarrente (%)', field: 'rate', val: sc.rate, step: '0.01' },
                  { label: 'Rentevaste periode (jr)', field: 'fixedYears', val: sc.fixedYears, step: '1' },
                ].map(f => (
                  <div key={f.field}>
                    <div style={eyebrow}>{f.label}</div>
                    <input type="number" step={f.step} defaultValue={f.val} onBlur={e => editSchuld(sc.id, f.field, e.target.value)} disabled={!editable}
                      style={{ ...inp, width: '100%', background: editable ? 'var(--s2)' : 'transparent', border: editable ? '1px solid var(--border)' : 'none' }} />
                  </div>
                ))}
                <div>
                  <div style={eyebrow}>Startdatum rente</div>
                  <input type="date" defaultValue={sc.fixedStart} onBlur={e => editSchuld(sc.id, 'fixedStart', e.target.value)} disabled={!editable}
                    style={{ ...inp, width: '100%', textAlign: 'left', fontSize: 11, background: editable ? 'var(--s2)' : 'transparent', border: editable ? '1px solid var(--border)' : 'none' }} />
                </div>
              </div>

              {fixedBadge && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 4, background: fixedBadge.bg, color: fixedBadge.color }}>{fixedBadge.text}</span>
                </div>
              )}

              <div style={{ background: 'var(--s3)', borderRadius: 6, padding: '14px 16px', marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'stretch' }}>
                  {[
                    { label: 'Resterende schuld', val: fmtK(sc.balance), color: 'var(--text)' },
                    { label: 'Maanden resterend', val: months === Infinity ? '∞' : months ? `${months}` : '—', color: 'var(--text)' },
                    { label: 'In jaren', val: months && months !== Infinity ? `${yr}j ${rm}m` : '—', color: 'var(--text)' },
                    { label: 'Totale rente', val: fmtK(totalInterestSc), color: 'var(--danger)' },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={eyebrow}>{s.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 4, color: s.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                {endDate && <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 8, lineHeight: 1.6 }}>Afgelost circa {endDate}</div>}
              </div>
            </div>
          )
        })}
      </div>

      <div style={panel}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Gecombineerd</span>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Totaaloverzicht</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
          {[
            { label: 'Totale schuld', val: fmtK(totalBalance), borderTop: 'var(--accent)' },
            { label: 'Totale maandlast', val: fmtK(totalPayment), borderTop: 'var(--border)' },
            { label: 'Totale verwachte rente', val: fmtK(totalInterest), color: 'var(--danger)', borderTop: 'var(--danger)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '15px 17px', borderTop: `2px solid ${s.borderTop}` }}>
              <div style={eyebrow}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', color: s.color || 'var(--text)' }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
