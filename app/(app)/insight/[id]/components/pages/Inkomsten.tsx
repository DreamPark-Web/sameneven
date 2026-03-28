'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type IncomeItem = { id: string; label: string; value: number }

function fmt(n: number) {
  return '€ ' + n.toFixed(2).replace('.', ',')
}

function PersonPanel({
  name,
  items,
  onAdd,
  onDelete,
  canEdit,
}: {
  name: string
  items: IncomeItem[]
  onAdd: (label: string, value: number) => void
  onDelete: (id: string) => void
  canEdit: boolean
}) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const total = items.reduce((a, i) => a + i.value, 0)

  return (
    <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e2e]">
        <p className="text-xs font-bold uppercase tracking-widest text-[#666]">{name}</p>
        {canEdit && (
          <button
            onClick={() => setOpen(!open)}
            className="text-xs text-[#00c2ff] border border-[#00c2ff]/30 px-3 py-1.5 rounded-lg hover:bg-[#00c2ff]/10 transition"
          >
            + Post
          </button>
        )}
      </div>

      {open && (
        <div className="px-5 py-3 border-b border-[#2e2e2e] flex gap-2">
          <input
            className="flex-1 bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
            placeholder="Omschrijving"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
          <input
            className="w-32 bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
            placeholder="Bedrag"
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
          <button
            onClick={() => {
              if (!label.trim() || !value) return
              onAdd(label.trim(), parseFloat(value))
              setLabel(''); setValue(''); setOpen(false)
            }}
            className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition"
          >
            OK
          </button>
        </div>
      )}

      <div>
        {items.map((item, i) => (
          <div key={item.id} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-[#2e2e2e]' : ''}`}>
            <span className="text-sm text-white">{item.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-[#00c2ff]">{fmt(item.value)}</span>
              {canEdit && (
                <button onClick={() => onDelete(item.id)} className="text-[#444] hover:text-[#e05050] transition text-lg leading-none">×</button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-[#444] px-5 py-4">Nog geen inkomsten.</p>
        )}
      </div>

      <div className="px-5 py-3 border-t border-[#2e2e2e] bg-[#141414] flex justify-between items-center">
        <span className="text-xs text-[#666]">Totaal per maand</span>
        <span className="text-base font-bold text-[#00c2ff]">{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function Inkomsten() {
  const { data, saveData, canEdit } = useInsight()
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  const u1Income: IncomeItem[] = data.user1?.income || []
  const u2Income: IncomeItem[] = data.user2?.income || []
  const total1 = u1Income.reduce((a, i) => a + i.value, 0)
  const total2 = u2Income.reduce((a, i) => a + i.value, 0)
  const totalIncome = total1 + total2

  const u1Ratio = totalIncome ? ((total1 / totalIncome) * 100).toFixed(1) : '50.0'
  const u2Ratio = totalIncome ? ((total2 / totalIncome) * 100).toFixed(1) : '50.0'

  function addIncome(slot: 'user1' | 'user2', label: string, value: number) {
    const item = { id: slot + Date.now(), label, value }
    const updated = { ...data }
    updated[slot] = { ...updated[slot], income: [...(updated[slot]?.income || []), item] }
    saveData(updated)
  }

  function deleteIncome(slot: 'user1' | 'user2', id: string) {
    const updated = { ...data }
    updated[slot] = { ...updated[slot], income: updated[slot].income.filter((i: IncomeItem) => i.id !== id) }
    saveData(updated)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Inkomsten</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Totaal gezamenlijk</p>
          <p className="text-xl font-bold text-[#00c2ff]">{fmt(totalIncome)}</p>
          <p className="text-xs text-[#666] mt-1">per maand</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Aandeel {n1}</p>
          <p className="text-xl font-bold text-white">{u1Ratio}%</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Aandeel {n2}</p>
          <p className="text-xl font-bold text-white">{u2Ratio}%</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <PersonPanel
          name={n1}
          items={u1Income}
          onAdd={(l, v) => addIncome('user1', l, v)}
          onDelete={(id) => deleteIncome('user1', id)}
          canEdit={canEdit('user1')}
        />
        <PersonPanel
          name={n2}
          items={u2Income}
          onAdd={(l, v) => addIncome('user2', l, v)}
          onDelete={(id) => deleteIncome('user2', id)}
          canEdit={canEdit('user2')}
        />
      </div>
    </div>
  )
}