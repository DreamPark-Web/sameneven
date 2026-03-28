'use client'

import { useInsight } from '@/lib/insight-context'

function fmt(n: number) { return '€ ' + n.toFixed(2).replace('.', ',') }

export default function Dashboard() {
  const { data, members, currentUser } = useInsight()

  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  const u1Income = (data.user1?.income || []).reduce((a: number, i: any) => a + i.value, 0)
  const u2Income = (data.user2?.income || []).reduce((a: number, i: any) => a + i.value, 0)
  const totalIncome = u1Income + u2Income

  const u1Ratio = totalIncome ? u1Income / totalIncome : 0.5
  const u2Ratio = 1 - u1Ratio

  const shared = data.shared || []
  const totalShared = shared.reduce((a: number, c: any) => a + c.value, 0)

  const u1Private = (data.user1?.private || []).reduce((a: number, i: any) => a + i.value, 0)
  const u2Private = (data.user2?.private || []).reduce((a: number, i: any) => a + i.value, 0)

  const u1SharedSav = (data.user1?.savings?.shared || []).reduce((a: number, i: any) => a + i.value, 0)
  const u2SharedSav = (data.user2?.savings?.shared || []).reduce((a: number, i: any) => a + i.value, 0)
  const u1PrivSav = (data.user1?.savings?.private || []).reduce((a: number, i: any) => a + i.value, 0)
  const u2PrivSav = (data.user2?.savings?.private || []).reduce((a: number, i: any) => a + i.value, 0)

  const u1Transfer = (totalShared * u1Ratio) + u1SharedSav
  const u2Transfer = (totalShared * u2Ratio) + u2SharedSav

  const u1Rest = u1Income - u1Transfer - u1Private - u1PrivSav
  const u2Rest = u2Income - u2Transfer - u2Private - u2PrivSav

  const totalSparen = (data.spaarpotjes || []).reduce((a: number, p: any) => a + p.current, 0)
  const totalSchuld = (data.schulden || []).reduce((a: number, s: any) => a + s.balance, 0)
  const totalSubs = (data.abonnementen || []).reduce((a: number, s: any) =>
    a + (s.freq === 'jaarlijks' ? s.amount / 12 : s.amount), 0)

  const myMember = members.find(m => m.user_id === currentUser?.id)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'
  const myName = myMember?.display_name?.split(' ')[0] || 'daar'

  const stats = [
    { label: 'Totaal inkomen', value: fmt(totalIncome), sub: 'per maand' },
    { label: 'Gezamenlijke lasten', value: fmt(totalShared), sub: 'per maand' },
    { label: 'Abonnementen', value: fmt(totalSubs), sub: 'per maand' },
    { label: 'Totaal gespaard', value: fmt(totalSparen), sub: 'in spaarpotten' },
    { label: 'Totaal schulden', value: fmt(totalSchuld), color: totalSchuld > 0 ? '#e05050' : '#4caf82' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{greeting}, {myName}</h1>
        <p className="text-sm text-[#666] mt-1">Hier is een overzicht van jullie financiën.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
            <p className="text-xs text-[#666] uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-xl font-bold" style={{ color: s.color || '#00c2ff' }}>{s.value}</p>
            {s.sub && <p className="text-xs text-[#666] mt-1">{s.sub}</p>}
          </div>
        ))}
      </div>

      <h2 className="text-xs font-bold uppercase tracking-widest text-[#666] mb-4">Over te maken</h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { name: n1, transfer: u1Transfer, rest: u1Rest },
          { name: n2, transfer: u2Transfer, rest: u2Rest },
        ].map(({ name, transfer, rest }) => (
          <div key={name} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#666] mb-4">{name}</p>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[#666]">Over te maken</span>
              <span className="text-sm font-bold text-white">{fmt(transfer)}/mnd</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#666]">Vrij besteedbaar</span>
              <span className="text-sm font-bold" style={{ color: rest < 0 ? '#e05050' : '#4caf82' }}>
                {fmt(rest)}/mnd
              </span>
            </div>
          </div>
        ))}
      </div>

      {(data.abonnementen || []).length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#666] mb-4">Abonnementen die binnenkort verlopen</h2>
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl overflow-hidden">
            {(data.abonnementen || [])
              .filter((s: any) => {
                if (!s.date) return false
                const today = new Date()
                const next = new Date(s.date)
                while (next < today) next.setFullYear(next.getFullYear() + 1)
                return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 60
              })
              .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .slice(0, 5)
              .map((s: any, i: number) => {
                const today = new Date()
                const next = new Date(s.date)
                while (next < today) next.setFullYear(next.getFullYear() + 1)
                const days = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={s.id} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-[#2e2e2e]' : ''}`}>
                    <span className="text-sm text-white">{s.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[#666]">€ {s.amount.toFixed(2)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${days <= 14 ? 'bg-[#e05050]/20 text-[#e05050]' : 'bg-[#00c2ff]/10 text-[#00c2ff]'}`}>
                        {days} dgn
                      </span>
                    </div>
                  </div>
                )
              })}
            {(data.abonnementen || []).filter((s: any) => {
              if (!s.date) return false
              const today = new Date()
              const next = new Date(s.date)
              while (next < today) next.setFullYear(next.getFullYear() + 1)
              return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 60
            }).length === 0 && (
              <p className="text-sm text-[#444] px-5 py-4">Geen abonnementen die binnenkort verlopen.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}