'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type Sub = {
  id: string
  name: string
  amount: number
  freq: 'maandelijks' | 'jaarlijks'
  person: 'user1' | 'user2' | 'gezamenlijk'
  date: string
}

function daysUntil(dateStr: string) {
  if (!dateStr) return null
  const today = new Date()
  const next = new Date(dateStr)
  while (next < today) {
    next.setFullYear(next.getFullYear() + 1)
  }
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function fmt(n: number) {
  return '€ ' + n.toFixed(2).replace('.', ',')
}

export default function Abonnementen() {
  const { data, saveData, canEdit } = useInsight()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', amount: '', freq: 'maandelijks', person: 'gezamenlijk', date: ''
  })

  const subs: Sub[] = data.abonnementen || []
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  const personLabel: Record<string, string> = {
    user1: n1, user2: n2, gezamenlijk: 'Gezamenlijk'
  }

  const groups = ['gezamenlijk', 'user1', 'user2']

  function addSub() {
    if (!form.name.trim() || !form.amount) return
    const newSub: Sub = {
      id: 'sub' + Date.now(),
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      freq: form.freq as Sub['freq'],
      person: form.person as Sub['person'],
      date: form.date,
    }
    saveData({ ...data, abonnementen: [...subs, newSub] })
    setForm({ name: '', amount: '', freq: 'maandelijks', person: 'gezamenlijk', date: '' })
    setShowForm(false)
  }

  function deleteSub(id: string) {
    saveData({ ...data, abonnementen: subs.filter(s => s.id !== id) })
  }

  const totalMonthly = subs.reduce((acc, s) => {
    return acc + (s.freq === 'jaarlijks' ? s.amount / 12 : s.amount)
  }, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Abonnementen</h1>
          <p className="text-sm text-[#666] mt-1">Totaal per maand: <span className="text-[#00c2ff] font-semibold">{fmt(totalMonthly)}</span></p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition"
        >
          + Toevoegen
        </button>
      </div>

      {showForm && (
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5 mb-6">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Naam"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Bedrag"
              type="number"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
            />
            <select
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              value={form.freq}
              onChange={e => setForm({ ...form, freq: e.target.value })}
            >
              <option value="maandelijks">Maandelijks</option>
              <option value="jaarlijks">Jaarlijks</option>
            </select>
            <select
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              value={form.person}
              onChange={e => setForm({ ...form, person: e.target.value })}
            >
              <option value="gezamenlijk">Gezamenlijk</option>
              <option value="user1">{n1}</option>
              <option value="user2">{n2}</option>
            </select>
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff] col-span-2"
              placeholder="Verlengingsdatum (JJJJ-MM-DD)"
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-[#666] px-4 py-2 hover:text-white transition">Annuleren</button>
            <button onClick={addSub} className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition">Opslaan</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map(group => {
          const groupSubs = subs.filter(s => s.person === group)
          if (groupSubs.length === 0) return null
          return (
            <div key={group}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#666] mb-3">{personLabel[group]}</h2>
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl overflow-hidden">
                {groupSubs.map((sub, i) => {
                  const days = daysUntil(sub.date)
                  const monthly = sub.freq === 'jaarlijks' ? sub.amount / 12 : sub.amount
                  const editable = canEdit(group === 'gezamenlijk' ? 'gezamenlijk' : group)
                  return (
                    <div key={sub.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-[#2e2e2e]' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-semibold text-sm">{sub.name}</span>
                        <span className="text-xs text-[#666]">{fmt(sub.amount)} / {sub.freq === 'jaarlijks' ? 'jaar' : 'mnd'}</span>
                        {days !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${days <= 30 ? 'bg-[#e05050]/20 text-[#e05050]' : 'bg-[#00c2ff]/10 text-[#00c2ff]'}`}>
                            {days} dgn
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#00c2ff] text-sm font-semibold">{fmt(monthly)}/mnd</span>
                        {editable && (
                          <button onClick={() => deleteSub(sub.id)} className="text-[#444] hover:text-[#e05050] transition text-lg leading-none">×</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {subs.length === 0 && (
          <div className="text-center py-16 text-[#444] text-sm">Nog geen abonnementen. Voeg er een toe!</div>
        )}
      </div>
    </div>
  )
}