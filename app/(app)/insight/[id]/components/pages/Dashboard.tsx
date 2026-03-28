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

  const myMember = members.find((m: any) => m.user_id === currentUser?.id)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'
  const myName = myMember?.display_name?.split(' ')[0] || 'daar'

  const upcomingSubs = (data.abonnementen || []).filter((s: any) => {
    if (!s.date) return false
    const today = new Date()
    const next = new Date(s.date)
    while (next < today) next.setFullYear(next.getFullYear() + 1)
    return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 60
  }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div id="page-dashboard">
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{greeting}, {myName}</div>
        <div className="caption" style={{ marginTop: 4 }}>Hier is een overzicht van jullie financiën.</div>
      </div>

      <div className="strip" style={{ marginBottom: 20 }}>
        <div className="stat-card ac">
          <div className="eyebrow">Totaal inkomen</div>
          <div className="stat-val" style={{ color: 'var(--accent)' }}>{fmt(totalIncome)}</div>
          <div className="caption">per maand</div>
        </div>
        <div className="stat-card ac">
          <div className="eyebrow">Gezamenlijke lasten</div>
          <div className="stat-val" style={{ color: 'var(--accent)' }}>{fmt(totalShared)}</div>
          <div className="caption">per maand</div>
        </div>
        <div className="stat-card ac">
          <div className="eyebrow">Abonnementen</div>
          <div className="stat-val" style={{ color: 'var(--accent)' }}>{fmt(totalSubs)}</div>
          <div className="caption">per maand</div>
        </div>
        <div className="stat-card ac">
          <div className="eyebrow">Totaal gespaard</div>
          <div className="stat-val" style={{ color: 'var(--accent)' }}>{fmt(totalSparen)}</div>
          <div className="caption">in spaarpotten</div>
        </div>
        <div className="stat-card" style={{ borderTopColor: totalSchuld > 0 ? 'var(--danger)' : 'var(--ok)' }}>
          <div className="eyebrow">Totaal schulden</div>
          <div className="stat-val" style={{ color: totalSchuld > 0 ? 'var(--danger)' : 'var(--ok)' }}>{fmt(totalSchuld)}</div>
        </div>
      </div>

      <div className="duo" style={{ marginBottom: 20 }}>
        {[{ name: n1, transfer: u1Transfer, rest: u1Rest }, { name: n2, transfer: u2Transfer, rest: u2Rest }].map(({ name, transfer, rest }) => (
          <div key={name} className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-hd">
              <div className="panel-hd-left">
                <span className="person-name">{name}</span>
                <span className="panel-sub">Maandoverzicht</span>
              </div>
            </div>
            <div className="totals-bar">
              <div className="total-box">
                <div className="eyebrow">Over te maken</div>
                <div className="total-val" style={{ color: 'var(--accent)' }}>{fmt(transfer)}</div>
                <div className="caption">per maand</div>
              </div>
              <div className="total-box">
                <div className="eyebrow">Vrij besteedbaar</div>
                <div className="total-val" style={{ color: rest < 0 ? 'var(--danger)' : 'var(--ok)' }}>{fmt(rest)}</div>
                <div className="caption">per maand</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {upcomingSubs.length > 0 && (
        <div className="panel">
          <div className="panel-hd">
            <div className="panel-hd-left">
              <span className="panel-sub">Abonnementen</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Binnenkort verlopen</span>
            </div>
          </div>
          {upcomingSubs.slice(0, 5).map((s: any) => {
            const today = new Date()
            const next = new Date(s.date)
            while (next < today) next.setFullYear(next.getFullYear() + 1)
            const days = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            return (
              <div key={s.id} className="row-item">
                <span className="row-lbl">{s.name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted2)' }}>{fmt(s.amount)}</span>
                <span className={`badge ${days <= 14 ? 'bg-ng' : 'bg-ac'}`}>{days} dgn</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}