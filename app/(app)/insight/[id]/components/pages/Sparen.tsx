'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type Spaarpot = {
  id: string
  label: string
  current: number
  goal: number
  owner: 'user1' | 'user2' | 'gezamenlijk'
}

type SavingItem = { id: string; label: string; value: number }

function fmt(n: number) { return '€ ' + n.toFixed(2).replace('.', ',') }

export default function Sparen() {
  const { data, saveData, canEdit } = useInsight()
  const [showPotForm, setShowPotForm] = useState(false)
  const [potForm, setPotForm] = useState({ label: '', current: '', goal: '', owner: 'gezamenlijk' })

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const potten: Spaarpot[] = data.spaarpotjes || []

  const u1SharedSav: SavingItem[] = data.user1?.savings?.shared || []
  const u2SharedSav: SavingItem[] = data.user2?.savings?.shared || []
  const u1PrivSav: SavingItem[] = data.user1?.savings?.private || []
  const u2PrivSav: SavingItem[] = data.user2?.savings?.private || []

  const totalSparen = potten.reduce((a, p) => a + p.current, 0)
  const totalGoal = potten.reduce((a, p) => a + (p.goal || 0), 0)

  function addPot() {
    if (!potForm.label.trim()) return
    const pot: Spaarpot = {
      id: 'sp' + Date.now(),
      label: potForm.label.trim(),
      current: parseFloat(potForm.current) || 0,
      goal: parseFloat(potForm.goal) || 0,
      owner: potForm.owner as Spaarpot['owner'],
    }
    saveData({ ...data, spaarpotjes: [...potten, pot] })
    setPotForm({ label: '', current: '', goal: '', owner: 'gezamenlijk' })
    setShowPotForm(false)
  }

  function deletePot(id: string) {
    saveData({ ...data, spaarpotjes: potten.filter(p => p.id !== id) })
  }

  function updatePot(id: string, current: number) {
    saveData({ ...data, spaarpotjes: potten.map(p => p.id === id ? { ...p, current } : p) })
  }

  const ownerLabel: Record<string, string> = { user1: n1, user2: n2, gezamenlijk: 'Gezamenlijk' }
  const editable = canEdit('user1') || canEdit('user2')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sparen</h1>
          <p className="text-sm text-[#666] mt-1">
            Totaal gespaard: <span className="text-[#00c2ff] font-semibold">{fmt(totalSparen)}</span>
            {totalGoal > 0 && <span className="text-[#666]"> van {fmt(totalGoal)}</span>}
          </p>
        </div>
        {editable && (
          <button
            onClick={() => setShowPotForm(!showPotForm)}
            className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition"
          >
            + Spaarpot
          </button>
        )}
      </div>

      {showPotForm && (
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5 mb-6">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Naam spaarpot"
              value={potForm.label}
              onChange={e => setPotForm({ ...potForm, label: e.target.value })}
            />
            <select
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              value={potForm.owner}
              onChange={e => setPotForm({ ...potForm, owner: e.target.value })}
            >
              <option value="gezamenlijk">Gezamenlijk</option>
              <option value="user1">{n1}</option>
              <option value="user2">{n2}</option>
            </select>
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Huidig bedrag"
              type="number"
              value={potForm.current}
              onChange={e => setPotForm({ ...potForm, current: e.target.value })}
            />
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Doel (optioneel)"
              type="number"
              value={potForm.goal}
              onChange={e => setPotForm({ ...potForm, goal: e.target.value })}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowPotForm(false)} className="text-sm text-[#666] px-4 py-2 hover:text-white transition">Annuleren</button>
            <button onClick={addPot} className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition">Opslaan</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        {potten.map(pot => {
          const pct = pot.goal > 0 ? Math.min(100, (pot.current / pot.goal) * 100) : 0
          return (
            <div key={pot.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white font-semibold">{pot.label}</p>
                  <p className="text-xs text-[#666] mt-0.5">{ownerLabel[pot.owner]}</p>
                </div>
                {editable && (
                  <button onClick={() => deletePot(pot.id)} className="text-[#444] hover:text-[#e05050] transition text-lg leading-none">×</button>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold text-[#00c2ff]">{fmt(pot.current)}</span>
                {pot.goal > 0 && <span className="text-sm text-[#666]">van {fmt(pot.goal)}</span>}
              </div>
              {pot.goal > 0 && (
                <div className="w-full bg-[#2e2e2e] rounded-full h-1.5 mb-3">
                  <div
                    className="bg-[#00c2ff] h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              {editable && (
                <input
                  className="w-full bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
                  type="number"
                  placeholder="Huidig bedrag bijwerken"
                  onBlur={e => { if (e.target.value) updatePot(pot.id, parseFloat(e.target.value)) }}
                />
              )}
            </div>
          )
        })}
        {potten.length === 0 && (
          <div className="col-span-2 text-center py-16 text-[#444] text-sm">Nog geen spaarpotten. Voeg er een toe!</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {[
          { name: n1, shared: u1SharedSav, priv: u1PrivSav, slot: 'user1' },
          { name: n2, shared: u2SharedSav, priv: u2PrivSav, slot: 'user2' },
        ].map(({ name, shared, priv, slot }) => (
          <div key={slot} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#666] mb-3">{name}</p>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[#666]">Gezamenlijk sparen</span>
              <span className="text-[#00c2ff] font-semibold">{fmt(shared.reduce((a: number, i: any) => a + i.value, 0))}/mnd</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#666]">Privé sparen</span>
              <span className="text-[#00c2ff] font-semibold">{fmt(priv.reduce((a: number, i: any) => a + i.value, 0))}/mnd</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}