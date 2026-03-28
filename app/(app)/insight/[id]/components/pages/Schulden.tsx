'use client'

import { useState } from 'react'
import { useInsight } from '@/lib/insight-context'

type Schuld = {
  id: string
  naam: string
  type: string
  wie: 'user1' | 'user2' | 'samen'
  balance: number
  payment: number
  rate: number
}

function fmt(n: number) { return '€ ' + n.toFixed(2).replace('.', ',') }

const TYPES = ['studieschuld', 'hypotheek', 'persoonlijke lening', 'creditcard', 'overig']

export default function Schulden() {
  const { data, saveData, canEdit } = useInsight()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ naam: '', type: 'overig', wie: 'user1', balance: '', payment: '', rate: '' })

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'
  const schulden: Schuld[] = data.schulden || []
  const editable = canEdit('user1') || canEdit('user2')

  const totalBalance = schulden.reduce((a, s) => a + s.balance, 0)
  const totalPayment = schulden.reduce((a, s) => a + s.payment, 0)

  const wieLabel: Record<string, string> = { user1: n1, user2: n2, samen: 'Samen' }

  function addSchuld() {
    if (!form.naam.trim() || !form.balance) return
    const s: Schuld = {
      id: 'sc' + Date.now(),
      naam: form.naam.trim(),
      type: form.type,
      wie: form.wie as Schuld['wie'],
      balance: parseFloat(form.balance) || 0,
      payment: parseFloat(form.payment) || 0,
      rate: parseFloat(form.rate) || 0,
    }
    saveData({ ...data, schulden: [...schulden, s] })
    setForm({ naam: '', type: 'overig', wie: 'user1', balance: '', payment: '', rate: '' })
    setShowForm(false)
  }

  function deleteSchuld(id: string) {
    saveData({ ...data, schulden: schulden.filter(s => s.id !== id) })
  }

  function monthsLeft(s: Schuld) {
    if (!s.payment || s.payment <= 0) return null
    const monthlyInterest = s.rate / 100 / 12
    if (monthlyInterest === 0) return Math.ceil(s.balance / s.payment)
    return Math.ceil(Math.log(s.payment / (s.payment - s.balance * monthlyInterest)) / Math.log(1 + monthlyInterest))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Schulden</h1>
          <p className="text-sm text-[#666] mt-1">
            Totaal: <span className="text-[#e05050] font-semibold">{fmt(totalBalance)}</span>
            <span className="ml-3">Aflossing: <span className="text-[#00c2ff] font-semibold">{fmt(totalPayment)}/mnd</span></span>
          </p>
        </div>
        {editable && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition"
          >
            + Schuld
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5 mb-6">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input
              className="col-span-2 bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Naam"
              value={form.naam}
              onChange={e => setForm({ ...form, naam: e.target.value })}
            />
            <select
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              value={form.wie}
              onChange={e => setForm({ ...form, wie: e.target.value })}
            >
              <option value="user1">{n1}</option>
              <option value="user2">{n2}</option>
              <option value="samen">Samen</option>
            </select>
            <select
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Huidig saldo"
              type="number"
              value={form.balance}
              onChange={e => setForm({ ...form, balance: e.target.value })}
            />
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Maand. aflossing"
              type="number"
              value={form.payment}
              onChange={e => setForm({ ...form, payment: e.target.value })}
            />
            <input
              className="bg-[#222] border border-[#2e2e2e] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c2ff]"
              placeholder="Rente % per jaar"
              type="number"
              value={form.rate}
              onChange={e => setForm({ ...form, rate: e.target.value })}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-[#666] px-4 py-2 hover:text-white transition">Annuleren</button>
            <button onClick={addSchuld} className="bg-[#00c2ff] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#40d8ff] transition">Opslaan</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {schulden.map(s => {
          const months = monthsLeft(s)
          return (
            <div key={s.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white font-bold">{s.naam}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs bg-[#00c2ff]/10 text-[#00c2ff] px-2 py-0.5 rounded-full">{wieLabel[s.wie]}</span>
                    <span className="text-xs bg-[#2e2e2e] text-[#666] px-2 py-0.5 rounded-full">{s.type}</span>
                  </div>
                </div>
                {editable && (
                  <button onClick={() => deleteSchuld(s.id)} className="text-[#444] hover:text-[#e05050] transition text-lg leading-none">×</button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-[#666] mb-1">Huidig saldo</p>
                  <p className="text-lg font-bold text-[#e05050]">{fmt(s.balance)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">Aflossing</p>
                  <p className="text-lg font-bold text-white">{fmt(s.payment)}/mnd</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">Rente</p>
                  <p className="text-lg font-bold text-white">{s.rate}%</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] mb-1">Klaar over</p>
                  <p className="text-lg font-bold text-[#00c2ff]">
                    {months ? `${months} mnd` : '—'}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        {schulden.length === 0 && (
          <div className="text-center py-16 text-[#444] text-sm">Geen schulden geregistreerd.</div>
        )}
      </div>
    </div>
  )
}