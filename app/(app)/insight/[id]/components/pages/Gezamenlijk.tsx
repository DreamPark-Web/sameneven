'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type CostItem = { id: string; label: string; value: number; split: 'ratio' | '5050' | 'user1' | 'user2' }

function fmt(n: number) { return '€ ' + n.toFixed(2).replace('.', ',') }

export default function Gezamenlijk() {
  const { data, saveData, canEdit } = useInsight()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: '', value: '', split: 'ratio' })

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const items: CostItem[] = data.shared || []

  const totalU1Income = (data.user1?.income || []).reduce((a: number, i: any) => a + i.value, 0)
  const totalU2Income = (data.user2?.income || []).reduce((a: number, i: any) => a + i.value, 0)
  const totalIncome = totalU1Income + totalU2Income
  const u1Ratio = totalIncome ? totalU1Income / totalIncome : 0.5
  const u2Ratio = 1 - u1Ratio

  function splitCost(item: CostItem) {
    const v = item.value
    if (item.split === '5050') return { u1: v / 2, u2: v / 2 }
    if (item.split === 'user1') return { u1: v, u2: 0 }
    if (item.split === 'user2') return { u1: 0, u2: v }
    return { u1: v * u1Ratio, u2: v * u2Ratio }
  }

  const totals = items.reduce((acc, item) => {
    const { u1, u2 } = splitCost(item)
    return { u1: acc.u1 + u1, u2: acc.u2 + u2 }
  }, { u1: 0, u2: 0 })

  function addItem() {
    if (!form.label.trim() || !form.value) return
    const item: CostItem = {
      id: 'sh' + Date.now(),
      label: form.label.trim(),
      value: parseFloat(form.value),
      split: form.split as CostItem['split'],
    }
    saveData({ ...data, shared: [...items, item] })
    setForm({ label: '', value: '', split: 'ratio' })
    setShowForm(false)
  }

  function deleteItem(id: string) {
    saveData({ ...data, shared: items.filter(i => i.id !== id) })
  }

  const splitLabel: Record<string, string> = {
    ratio: 'Naar rato', '5050': '50/50',
    user1: `Volledig ${n1}`, user2: `Volledig ${n2}`
  }

  const editable = canEdit('user1') || canEdit('user2')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Gezamenlijke Kosten</h1>
          <p className="text-sm text-[#666] mt-1">Gedeelde vaste lasten</p>
        </div>
        {editable && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition"
          >
            + Toevoegen
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Aandeel {n1}</p>
          <p className="text-xl font-bold text-[#00c2ff]">{fmt(totals.u1)}</p>
          <p className="text-xs text-[#666] mt-1">per maand</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
          <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Aandeel {n2}</p>
          <p className="text-xl font-bold text-[#00c2ff]">{fmt(totals.u2)}</p>
          <p className="text-xs text-[#666] mt-1">per maand</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5 mb-6">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Omschrijving"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
            />
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Bedrag"
              type="number"
              value={form.value}
              onChange={e => setForm({ ...form, value: e.target.value })}
            />
            <select
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              value={form.split}
              onChange={e => setForm({ ...form, split: e.target.value })}
            >
              <option value="ratio">Naar rato</option>
              <option value="5050">50/50</option>
              <option value="user1">Volledig {n1}</option>
              <option value="user2">Volledig {n2}</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-[#666] px-4 py-2 hover:text-white transition">Annuleren</button>
            <button onClick={addItem} className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition">Opslaan</button>
          </div>
        </div>
      )}

      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 px-5 py-2 border-b border-[#2e2e2e] text-xs font-bold uppercase tracking-widest text-[#666]">
          <span className="col-span-2">Omschrijving</span>
          <span>{n1}</span>
          <span>{n2}</span>
        </div>
        {items.map((item, i) => {
          const { u1, u2 } = splitCost(item)
          return (
            <div key={item.id} className={`grid grid-cols-4 items-center px-5 py-3 ${i > 0 ? 'border-t border-[#2e2e2e]' : ''}`}>
              <div className="col-span-2">
                <span className="text-white text-sm">{item.label}</span>
                <span className="text-xs text-[#666] ml-2">{splitLabel[item.split]}</span>
              </div>
              <span className="text-sm text-[#00c2ff] font-semibold">{fmt(u1)}</span>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#00c2ff] font-semibold">{fmt(u2)}</span>
                {editable && (
                  <button onClick={() => deleteItem(item.id)} className="text-[#444] hover:text-[#e05050] transition text-lg leading-none">×</button>
                )}
              </div>
            </div>
          )
        })}
        {items.length === 0 && (
          <p className="text-sm text-[#444] px-5 py-6">Nog geen gezamenlijke kosten.</p>
        )}
        {items.length > 0 && (
          <div className="grid grid-cols-4 px-5 py-3 border-t border-[#2e2e2e] bg-[#141414]">
            <span className="col-span-2 text-xs text-[#666]">Totaal</span>
            <span className="text-sm font-bold text-white">{fmt(totals.u1)}</span>
            <span className="text-sm font-bold text-white">{fmt(totals.u2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}