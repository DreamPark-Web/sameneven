'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'
import { fmtK } from '@/lib/format'

type Schuld = { id: string; naam: string; type: string; wie: string; balance: number; payment: number; rate: number; fixedYears: number; fixedStart: string }

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

  const panel: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
  const inp: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--input-border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', width: '100%', fontVariantNumeric: 'tabular-nums' }
  const eyebrow: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }
  const onEnterBlur = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.currentTarget.blur() }

  return (
    <div>
      <div style={panel}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Overzicht</span>
          </div>
          {editable && <button className="btn-add" onClick={() => setShowAdd(!showAdd)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(var(--accent-rgb), 0.4)', background: 'var(--s2)', color: 'var(--accent)' }}>{showAdd ? '− Toevoegen' : '+ Toevoegen'}</button>}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 14, lineHeight: 1.7 }}>DUO, hypotheek, autolening, etc. Stel rentevaste periode in voor een vervaldatummelding.</div>

        {showAdd && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={eyebrow}>Naam</div>
                <input autoFocus style={{ ...inp, textAlign: 'left' }} placeholder="Naam schuld" value={form.naam} onChange={e => setForm({ ...form, naam: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') addSchuld(); else if (e.key === 'Escape') setShowAdd(false) }} />
              </div>
              <div>
                <div style={eyebrow}>Type</div>
                <select style={{ ...inp, textAlign: 'left', cursor: 'pointer' } as React.CSSProperties} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {STYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <div style={eyebrow}>Van wie</div>
                <select style={{ ...inp, textAlign: 'left', cursor: 'pointer' } as React.CSSProperties} value={form.wie} onChange={e => setForm({ ...form, wie: e.target.value })}>
                  <option value="user1">{n1}</option>
                  <option value="user2">{n2}</option>
                  <option value="samen">Samen</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1.5fr 1.5fr', gap: 12, alignItems: 'end' }}>
                <div>
                  <div style={eyebrow}>Huidige schuld</div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                    <input style={{ ...inp, padding: '6px 9px 6px 22px' }} type="number" placeholder="Bedrag" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') addSchuld(); else if (e.key === 'Escape') setShowAdd(false) }} />
                  </div>
                </div>
                <div>
                  <div style={eyebrow}>Maand. aflossing</div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                    <input style={{ ...inp, padding: '6px 9px 6px 22px' }} type="number" placeholder="Bedrag" value={form.payment} onChange={e => setForm({ ...form, payment: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') addSchuld(); else if (e.key === 'Escape') setShowAdd(false) }} />
                  </div>
                </div>
                <div>
                  <div style={eyebrow}>Jaarrente (%)</div>
                  <input style={inp} type="number" step="0.01" placeholder="%" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') addSchuld(); else if (e.key === 'Escape') setShowAdd(false) }} />
                </div>
                <div>
                  <div style={eyebrow}>Rentevaste periode (jr)</div>
                  <input style={inp} type="number" step="1" value={form.fixedYears} onChange={e => setForm({ ...form, fixedYears: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') addSchuld(); else if (e.key === 'Escape') setShowAdd(false) }} />
                </div>
                <div>
                  <div style={eyebrow}>Startdatum rente</div>
                  <input style={{ ...inp, textAlign: 'left', fontSize: 11 }} type="date" value={form.fixedStart} onChange={e => setForm({ ...form, fixedStart: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') addSchuld(); else if (e.key === 'Escape') setShowAdd(false) }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setShowAdd(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}>Annuleren</button>
              <button className="btn-submit" onClick={addSchuld} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)' }}>Toevoegen</button>
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
            fixedBadge = { text: dl < 0 ? 'Rentevaste periode verlopen' : `Rente vast tot ${e.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })} (${Math.round(dl / 30)} mnd)`, ...cls }
          }

          return (
            <div key={sc.id} style={{ background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 6, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 7px', borderRadius: 999, background: 'rgba(255,255,255,.04)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb), .18)' }}>
                    {sc.naam}<span style={{ opacity: 0.45, fontWeight: 400 }}> – </span>{wieLabel}{endDate && <span style={{ opacity: 0.6, fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}> – afgelost {endDate}</span>}
                  </span>
                </div>
                {editable && <button className="btn-delete" onClick={() => deleteSchuld(sc.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>×</button>}
              </div>

              {(() => {
                const cols = '2fr 2fr 1.5fr 1.5fr 1.5fr'
                const gap = 10
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: cols, gap, marginBottom: 4 }}>
                      <div style={eyebrow}>Huidige schuld</div>
                      <div style={eyebrow}>Maand. aflossing</div>
                      <div style={eyebrow}>Jaarrente (%){fixedBadge && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: fixedBadge.color }}>{fixedBadge.text.replace(/^Rente vast /i, '').replace(/^Rentevaste /i, '')}</span>}</div>
                      <div style={eyebrow}>Rentevaste periode (jr)</div>
                      <div style={eyebrow}>Startdatum rente</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: cols, gap, marginBottom: 12 }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                        <input type="number" step="100" defaultValue={sc.balance} onBlur={e => editSchuld(sc.id, 'balance', e.target.value)} onKeyDown={onEnterBlur} disabled={!editable}
                          style={{ ...inp, width: '100%', background: editable ? 'var(--s2)' : 'transparent', border: editable ? '1px solid var(--input-border)' : 'none', padding: '6px 9px 6px 22px' }} />
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, pointerEvents: 'none', userSelect: 'none' }}>€</span>
                        <input type="number" step="1" defaultValue={sc.payment} onBlur={e => editSchuld(sc.id, 'payment', e.target.value)} onKeyDown={onEnterBlur} disabled={!editable}
                          style={{ ...inp, width: '100%', background: editable ? 'var(--s2)' : 'transparent', border: editable ? '1px solid var(--input-border)' : 'none', padding: '6px 9px 6px 22px' }} />
                      </div>
                      <input type="number" step="0.01" defaultValue={sc.rate} onBlur={e => editSchuld(sc.id, 'rate', e.target.value)} onKeyDown={onEnterBlur} disabled={!editable}
                        style={{ ...inp, width: '100%', background: editable ? 'var(--s2)' : 'transparent', border: editable ? '1px solid var(--input-border)' : 'none' }} />
                      <input type="number" step="1" defaultValue={sc.fixedYears} onBlur={e => editSchuld(sc.id, 'fixedYears', e.target.value)} onKeyDown={onEnterBlur} disabled={!editable}
                        style={{ ...inp, width: '100%', background: editable ? 'var(--s2)' : 'transparent', border: editable ? '1px solid var(--input-border)' : 'none' }} />
                      <input type="date" defaultValue={sc.fixedStart} onBlur={e => editSchuld(sc.id, 'fixedStart', e.target.value)} onKeyDown={onEnterBlur} disabled={!editable}
                        style={{ ...inp, width: '100%', textAlign: 'left', fontSize: 11, background: editable ? 'var(--s3)' : 'transparent', border: editable ? '1px solid var(--input-border)' : 'none' }} />
                    </div>
                  </>
                )
              })()}


              <div style={{ background: 'var(--s2)', border: '1px solid var(--card-border)', borderTop: '1px solid var(--accent)', borderRadius: 8, padding: '10px 14px', marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'stretch' }}>
                  {[
                    { label: 'Resterende schuld', val: fmtK(sc.balance), color: 'var(--accent)' },
                    { label: 'Maanden resterend', val: months === Infinity ? '∞' : months ? `${months}` : '—', color: 'var(--accent)' },
                    { label: 'In jaren', val: months && months !== Infinity ? `${yr}j ${rm}m` : '—', color: 'var(--accent)' },
                    { label: 'Totale rente', val: fmtK(totalInterestSc), color: 'var(--danger)' },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ ...eyebrow, fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', marginTop: 3, color: s.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={panel}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Gecombineerd</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'stretch' }}>
          {[
            { label: 'Totale schuld', val: fmtK(totalBalance), borderTop: 'var(--accent)' },
            { label: 'Totale maandlast', val: fmtK(totalPayment), borderTop: 'var(--accent)' },
            { label: 'Totale verwachte rente', val: fmtK(totalInterest), color: 'var(--danger)', borderTop: 'var(--danger)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--s2)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '15px 17px', borderTop: `1px solid ${s.borderTop}` }}>
              <div style={{ ...eyebrow, color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', color: s.color || 'var(--accent)' }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
