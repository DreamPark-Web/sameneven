'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type SavItem = { id: string; label: string; value: number }
type Pot = { id: string; label: string; current: number; goal: number; owner: string }

function fmt(n: number) { return '€\u00a0' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function sum(arr: SavItem[]) { return (arr || []).reduce((a, i) => a + (i.value || 0), 0) }

export default function Sparen() {
  const { data, saveData, canEdit } = useInsight()
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const editable = canEdit('user1') || canEdit('user2')

  const [potForm, setPotForm] = useState({ label: '', current: '', goal: '', owner: 'gezamenlijk' })
  const [openSav, setOpenSav] = useState<string | null>(null)
  const [savForm, setSavForm] = useState({ label: '', value: '' })

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
  function addPot() {
    if (!potForm.label.trim()) return
    const pot: Pot = { id: 'sp' + Date.now(), label: potForm.label.trim(), current: parseFloat(potForm.current) || 0, goal: parseFloat(potForm.goal) || 0, owner: potForm.owner }
    saveData({ ...data, spaarpotjes: [...potten, pot] })
    setPotForm({ label: '', current: '', goal: '', owner: 'gezamenlijk' })
  }
  function deletePot(id: string) { saveData({ ...data, spaarpotjes: potten.filter(p => p.id !== id) }) }
  function editPot(id: string, field: string, val: string) {
    saveData({ ...data, spaarpotjes: potten.map(p => p.id === id ? { ...p, [field]: field === 'current' || field === 'goal' ? parseFloat(val) || 0 : val } : p) })
  }

  const panel: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
  const totalBox: React.CSSProperties = { background: 'var(--s2)', borderRadius: 6, padding: '10px 12px' }

  function SavList({ items, slot, type, can }: { items: SavItem[]; slot: 'user1' | 'user2'; type: 'shared' | 'private'; can: boolean }) {
    const key = `${slot}-${type}`
    return (
      <div>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
            <span style={{ flex: 1, fontSize: 13 }}>{item.label}</span>
            <input type="number" defaultValue={item.value} onBlur={e => editSavItem(slot, type, item.id, parseFloat(e.target.value) || 0)} disabled={!can}
              style={{ width: 90, background: can ? 'var(--s2)' : 'transparent', border: can ? '1px solid var(--border)' : 'none', borderRadius: 5, color: 'var(--text)', padding: '5px 7px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
            {can && <button onClick={() => deleteSavItem(slot, type, item.id)} style={{ width: 22, height: 22, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>}
          </div>
        ))}
        {can && (
          openSav === key ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '5px 7px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
                placeholder="Omschrijving" value={savForm.label} onChange={e => setSavForm({ ...savForm, label: e.target.value })} />
              <input style={{ width: 80, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '5px 7px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
                type="number" placeholder="€" value={savForm.value} onChange={e => setSavForm({ ...savForm, value: e.target.value })} />
              <button onClick={() => { if (!savForm.label.trim() || !savForm.value) return; addSavItem(slot, type, savForm.label.trim(), parseFloat(savForm.value)); setSavForm({ label: '', value: '' }); setOpenSav(null) }}
                style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#0a0a0a' }}>OK</button>
            </div>
          ) : (
            <button onClick={() => { setOpenSav(key); setSavForm({ label: '', value: '' }) }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 0', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--muted2)', marginTop: 8, width: '100%', textAlign: 'left' }}>+ Toevoegen</button>
          )
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[{ name: n1, slot: 'user1' as const, sh: u1sh, pr: u1pr, can: canEdit('user1') }, { name: n2, slot: 'user2' as const, sh: u2sh, pr: u2pr, can: canEdit('user2') }].map(({ name, slot, sh, pr, can }) => (
          <div key={slot} style={panel}>
            <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>{name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Spaardoelen</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 7, borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>Gezamenlijk</div>
                <SavList items={sh} slot={slot} type="shared" can={can} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 7, borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-heading)' }}>Prive</div>
                <SavList items={pr} slot={slot} type="private" can={can} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Totaal</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Gezamenlijk</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmt(sum(sh))}</div></div>
              <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Prive</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{fmt(sum(pr))}</div></div>
              <div style={totalBox}><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmt(sum(sh) + sum(pr))}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div style={panel}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Sparen</span>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Stand en Voortgang</div>
        </div>
        {potten.map(pot => {
          const pct = pot.goal > 0 ? Math.min(1, pot.current / pot.goal) : 0
          const ownerLabel = pot.owner === 'user1' ? n1 : pot.owner === 'user2' ? n2 : 'Gezamenlijk'
          return (
            <div key={pot.id} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: '15px 17px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{pot.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{ownerLabel}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {pot.goal > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmt(pot.current)} / {fmt(pot.goal)} ({(pct * 100).toFixed(0)}%)</span>}
                  {editable && <button onClick={() => deletePot(pot.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>}
                </div>
              </div>
              {pot.goal > 0 && (
                <div style={{ height: 5, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${(pct * 100).toFixed(2)}%`, background: 'var(--accent)', transition: 'width .5s ease' }} />
                </div>
              )}
              {editable && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input type="number" defaultValue={pot.current} onBlur={e => editPot(pot.id, 'current', e.target.value)}
                    style={{ flex: 1, background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }} placeholder="Huidig €" />
                  <input type="number" defaultValue={pot.goal} onBlur={e => editPot(pot.id, 'goal', e.target.value)}
                    style={{ flex: 1, background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }} placeholder="Doel €" />
                </div>
              )}
            </div>
          )
        })}
        {editable && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <input style={{ flex: 2, minWidth: 120, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
              placeholder="Naam spaarpot" value={potForm.label} onChange={e => setPotForm({ ...potForm, label: e.target.value })} />
            <input style={{ width: 100, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
              type="number" placeholder="Huidig €" value={potForm.current} onChange={e => setPotForm({ ...potForm, current: e.target.value })} />
            <input style={{ width: 100, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
              type="number" placeholder="Doel €" value={potForm.goal} onChange={e => setPotForm({ ...potForm, goal: e.target.value })} />
            <select style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
              value={potForm.owner} onChange={e => setPotForm({ ...potForm, owner: e.target.value })}>
              <option value="gezamenlijk">Gezamenlijk</option>
              <option value="user1">{n1}</option>
              <option value="user2">{n2}</option>
            </select>
            <button onClick={addPot} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#0a0a0a' }}>Toevoegen</button>
          </div>
        )}
      </div>
    </div>
  )
}
