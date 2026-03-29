'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type Item = { id: string; label: string; value: number }

function fmt(n: number) { return '€\u00a0' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function sum(arr: Item[]) { return (arr || []).reduce((a, i) => a + i.value, 0) }

const panel: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }
const panelHd: React.CSSProperties = { marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }

function PersonPanel({ name, items, onAdd, onDelete, onEdit, canEdit }: {
  name: string; items: Item[]; onAdd: (label: string, value: number) => void
  onDelete: (id: string) => void; onEdit: (id: string, label: string, value: number) => void; canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const total = sum(items)

  return (
    <div style={panel}>
      <div style={panelHd}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>{name}</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Inkomsten</span>
        </div>
        {canEdit && (
          <button onClick={() => setOpen(!open)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted2)', transition: 'all .15s' }}>
            + Post
          </button>
        )}
      </div>

      {open && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <input
            style={{ flex: 1, minWidth: 80, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'left' }}
            placeholder="Omschrijving" value={label} onChange={e => setLabel(e.target.value)}
          />
          <input
            style={{ width: 100, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right' }}
            type="number" placeholder="Bedrag" value={value} onChange={e => setValue(e.target.value)}
          />
          <button onClick={() => { if (!label.trim() || !value) return; onAdd(label.trim(), parseFloat(value)); setLabel(''); setValue(''); setOpen(false) }}
            style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#0a0a0a' }}>
            Toevoegen
          </button>
          <button onClick={() => setOpen(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color: 'var(--muted2)', border: '1px solid var(--border)' }}>
            Annuleren
          </button>
        </div>
      )}

      <div>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
            <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
            <input
              type="number"
              defaultValue={item.value}
              onBlur={e => onEdit(item.id, item.label, parseFloat(e.target.value) || 0)}
              disabled={!canEdit}
              style={{ width: 100, background: canEdit ? 'var(--s2)' : 'transparent', border: canEdit ? '1px solid var(--border)' : 'none', borderRadius: 5, color: 'var(--text)', padding: '6px 9px', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            />
            {canEdit && (
              <button onClick={() => onDelete(item.id)} style={{ width: 26, height: 26, background: 'rgba(200,60,60,.1)', color: 'var(--danger)', border: '1px solid rgba(200,60,60,.2)', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Totaal</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ background: 'var(--s2)', borderRadius: 6, padding: '13px 15px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>Totaal netto per maand</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4, color: 'var(--accent)' }}>{fmt(total)}</div>
        </div>
      </div>
    </div>
  )
}

export default function Inkomsten() {
  const { data, saveData, canEdit } = useInsight()
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const u1: Item[] = data.user1?.income || []
  const u2: Item[] = data.user2?.income || []
  const t1 = sum(u1), t2 = sum(u2), total = t1 + t2
  const r1 = total ? (t1 / total * 100).toFixed(1) + '%' : '—'
  const r2 = total ? (t2 / total * 100).toFixed(1) + '%' : '—'

  function addIncome(slot: 'user1' | 'user2', label: string, value: number) {
    const item = { id: slot + Date.now(), label, value }
    const updated = { ...data }
    updated[slot] = { ...updated[slot], income: [...(updated[slot]?.income || []), item] }
    saveData(updated)
  }
  function deleteIncome(slot: 'user1' | 'user2', id: string) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], income: updated[slot].income.filter((i: Item) => i.id !== id) }
    saveData(updated)
  }
  function editIncome(slot: 'user1' | 'user2', id: string, label: string, value: number) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], income: updated[slot].income.map((i: Item) => i.id === id ? { ...i, label, value } : i) }
    saveData(updated)
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <PersonPanel name={n1} items={u1} onAdd={(l, v) => addIncome('user1', l, v)} onDelete={id => deleteIncome('user1', id)} onEdit={(id, l, v) => editIncome('user1', id, l, v)} canEdit={canEdit('user1')} />
        <PersonPanel name={n2} items={u2} onAdd={(l, v) => addIncome('user2', l, v)} onDelete={id => deleteIncome('user2', id)} onEdit={(id, l, v) => editIncome('user2', id, l, v)} canEdit={canEdit('user2')} />
      </div>
      <div style={panel}>
        <div style={panelHd}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Overzicht</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Gecombineerd inkomen</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { label: 'Totaal gezamenlijk', val: fmt(total), sub: 'per maand', color: 'var(--accent)' },
            { label: `Aandeel ${n1}`, val: r1, color: 'var(--accent)' },
            { label: `Aandeel ${n2}`, val: r2, color: 'var(--accent)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '15px 17px', borderTop: '2px solid var(--accent)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: i === 0 ? 28 : 19, fontWeight: 700, lineHeight: 1, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums', color: s.color }}>{s.val}</div>
              {s.sub && <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
