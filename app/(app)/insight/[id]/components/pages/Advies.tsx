'use client'

import { useInsight } from '@/lib/insight-context'

function fmt(n: number) { return '€ ' + n.toFixed(2).replace('.', ',') }

export default function Advies() {
  const { data } = useInsight()

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

  const totalSubs = (data.abonnementen || []).reduce((a: number, s: any) => {
    return a + (s.freq === 'jaarlijks' ? s.amount / 12 : s.amount)
  }, 0)

  const totalSchuld = (data.schulden || []).reduce((a: number, s: any) => a + s.balance, 0)
  const totalSparen = (data.spaarpotjes || []).reduce((a: number, p: any) => a + p.current, 0)

  const tips = []

  if (u1Rest < 0) tips.push({ type: 'warning', text: `${n1} heeft een negatief saldo van ${fmt(Math.abs(u1Rest))} per maand. Bekijk de privé kosten.` })
  if (u2Rest < 0) tips.push({ type: 'warning', text: `${n2} heeft een negatief saldo van ${fmt(Math.abs(u2Rest))} per maand. Bekijk de privé kosten.` })
  if (totalSubs > totalIncome * 0.15) tips.push({ type: 'warning', text: `Abonnementen zijn meer dan 15% van het inkomen (${fmt(totalSubs)}/mnd). Overweeg te snijden.` })
  if (totalSchuld > 0 && totalSparen > totalSchuld) tips.push({ type: 'tip', text: `Je hebt meer gespaard (${fmt(totalSparen)}) dan schulden (${fmt(totalSchuld)}). Overweeg schulden sneller af te lossen.` })
  if (u1Rest > 500) tips.push({ type: 'tip', text: `${n1} heeft ${fmt(u1Rest)} per maand over. Overweeg dit toe te voegen aan een spaarpot.` })
  if (u2Rest > 500) tips.push({ type: 'tip', text: `${n2} heeft ${fmt(u2Rest)} per maand over. Overweeg dit toe te voegen aan een spaarpot.` })
  if (tips.length === 0) tips.push({ type: 'ok', text: 'Alles ziet er goed uit! Geen bijzondere aandachtspunten.' })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Advies</h1>
        <p className="text-sm text-[#666] mt-1">Automatische inzichten op basis van je financiën</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { label: `Over te maken ${n1}`, value: fmt(u1Transfer), sub: 'per maand' },
          { label: `Over te maken ${n2}`, value: fmt(u2Transfer), sub: 'per maand' },
          { label: `Vrij besteedbaar ${n1}`, value: fmt(u1Rest), color: u1Rest < 0 ? '#e05050' : '#00c2ff' },
          { label: `Vrij besteedbaar ${n2}`, value: fmt(u2Rest), color: u2Rest < 0 ? '#e05050' : '#00c2ff' },
        ].map((card, i) => (
          <div key={i} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
            <p className="text-xs text-[#666] uppercase tracking-widest mb-1">{card.label}</p>
            <p className="text-xl font-bold" style={{ color: card.color || '#fff' }}>{card.value}</p>
            {card.sub && <p className="text-xs text-[#666] mt-1">{card.sub}</p>}
          </div>
        ))}
      </div>

      <h2 className="text-xs font-bold uppercase tracking-widest text-[#666] mb-4">Aandachtspunten</h2>
      <div className="flex flex-col gap-3">
        {tips.map((tip, i) => (
          <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${
            tip.type === 'warning' ? 'bg-[#e05050]/10 border-[#e05050]/20' :
            tip.type === 'ok' ? 'bg-[#4caf82]/10 border-[#4caf82]/20' :
            'bg-[#00c2ff]/10 border-[#00c2ff]/20'
          }`}>
            <span className="text-lg mt-0.5">
              {tip.type === 'warning' ? '⚠' : tip.type === 'ok' ? '✓' : '💡'}
            </span>
            <p className="text-sm text-white">{tip.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}