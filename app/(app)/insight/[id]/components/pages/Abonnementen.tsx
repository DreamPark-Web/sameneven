'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type Sub = { id: string; name: string; date: string; amount: number; freq: string; person: string }

function fmt(n: number, d = 2) { return '€\u00a0' + n.toFixed(d).replace('.', ',') }
function subMonthly(s: Sub) {
  const a = s.amount || 0
  if (s.freq === 'kwartaal') return a / 3
  if (s.freq === 'jaarlijks') return a / 12
  return a
}
function daysUntil(dateStr: string) {
  if (!dateStr) return null
  const today = new Date()
  const next = new Date(dateStr)
  while (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.ceil((next.getTime() - today.getTime()) / 86400000)
}

const FREQL: Record<string, string> = { maandelijks: 'p/mnd', kwartaal: 'p/kwt', jaarlijks: 'p/jr' }

export default function Abonnementen() {
  const { data, saveData, canEdit } = useInsight()
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const editable = canEdit('user1') || canEdit('user2')

  // Support both old 'subscriptions' key and new 'abonnementen' key
  const subs: Sub[] = data.abonnementen || (data as any).subscriptions || []

  const [form, setForm] = useState({ name: '', date: '', amount: '', freq: 'maandelijks', person: 'gezamenlijk' })

  function addSub() {
    if (!form.name.trim() || !form.date) return
    const sub: Sub = { id: 'sub' + Date.now(), name: form.name.trim(), date: form.date, amount: parseFloat(form.amount) || 0, freq: form.freq, person: form.person }
    saveData({ ...data, abonnementen: [...subs, sub] })
    setForm({ name: '', date: '', amount: '', freq: 'maandelijks', person: 'gezamenlijk' })
  }
  function deleteSub(id: string) { saveData({ ...data, abonnementen: subs.filter(s => s.id !== id) }) }

  const panel: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
  const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }

  function SubList({ items, title }: { items: Sub[]; title: string }) {
    return items.length === 0 ? null : (
      <>
        {items.map(sub => {
          const days = daysUntil(sub.date)
          const bc = days === null ? null : days <= 0 ? { bg: 'rgba(224,80,80,.12)', color: 'var(--danger)' } : days <= 14 ? { bg: 'rgba(224,80,80,.12)', color: 'var(--danger)' } : days <= 30 ? { bg: 'rgba(212,160,23,.12)', color: 'var(--warn)' } : { bg: 'rgba(76,175,130,.12)', color: 'var(--ok)' }
          const dateDisplay = sub.date ? new Date(sub.date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
          return (
            <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 6 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)' }}>{sub.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmt(sub.amount, 2)} {FREQL[sub.freq] || 'p/mnd'} · {fmt(subMonthly(sub), 2)}/mnd · {dateDisplay}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {bc && days !== null && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 4, whiteSpace: 'nowrap', ...bc }}>{days <= 0 ? 'Verlopen' : `${days} dgn`}</span>}
                {editable && <button onClick={() => deleteSub(sub.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>}
              </div>
            </div>
          )
        })}
      </>
    )
  }

  const groups = [
    { key: 'gezamenlijk', title: 'Gezamenlijk' },
    { key: 'user1', title: n1 },
    { key: 'user2', title: n2 },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {groups.map(g => (
          <div key={g.key} style={panel}>
            <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)', display: 'block' }}>{g.title}</span>
              <span style={{ ...eyebrow }}>Abonnementen</span>
            </div>
            <SubList items={subs.filter(s => s.person === g.key)} title={g.title} />
            {subs.filter(s => s.person === g.key).length === 0 && <div style={{ fontSize: 11, color: 'var(--muted2)' }}>Geen abonnementen.</div>}
          </div>
        ))}
      </div>

      {editable && (
        <div style={panel}>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <span style={{ ...eyebrow }}>Toevoegen</span>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Nieuw abonnement</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input style={{ flex: 2, minWidth: 120, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
              placeholder="Naam" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input style={{ width: 160, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
              type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <input style={{ width: 100, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
              type="number" step="0.01" placeholder="Bedrag" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <select style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
              value={form.freq} onChange={e => setForm({ ...form, freq: e.target.value })}>
              <option value="maandelijks">Per maand</option>
              <option value="kwartaal">Per kwartaal</option>
              <option value="jaarlijks">Per jaar</option>
            </select>
            <select style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
              value={form.person} onChange={e => setForm({ ...form, person: e.target.value })}>
              <option value="gezamenlijk">Gezamenlijk</option>
              <option value="user1">{n1}</option>
              <option value="user2">{n2}</option>
            </select>
            <button onClick={addSub} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#0a0a0a' }}>Toevoegen</button>
          </div>
        </div>
      )}
    </div>
  )
}
