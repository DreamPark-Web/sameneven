'use client'

import { useInsight } from '@/lib/insight-context'
import { fmtK, sum } from '@/lib/format'

type SharedItem = { id: string; label: string; value: number; split: string }
type Pot = { id: string; label: string; current: number; goal: number; owner: string }
type Schuld = { id: string; naam: string; type: string; wie: string; balance: number; payment: number; rate: number; fixedYears: number; fixedStart: string }

function calcMonths(bal: number, pay: number, rate: number) {
  if (!bal || !pay || pay <= 0) return null
  const r = rate / 100 / 12
  if (r === 0) return Math.ceil(bal / pay)
  if (pay <= bal * r) return Infinity
  return Math.ceil(-Math.log(1 - (r * bal / pay)) / Math.log(1 + r))
}

export default function Advies() {
  const { data } = useInsight()
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  const jI = sum(data.user1?.income || [])
  const dI = sum(data.user2?.income || [])
  const totalIncome = jI + dI
  const jRatio = totalIncome ? jI / totalIncome : 0.5
  const dRatio = 1 - jRatio

  const shared = (data.shared as SharedItem[]) || []
  const jSh = shared.reduce((a: number, c) => {
    if (c.split === '5050') return a + c.value / 2
    if (c.split === 'user1') return a + c.value
    if (c.split === 'user2') return a
    return a + c.value * jRatio
  }, 0)
  const dSh = shared.reduce((a: number, c) => {
    if (c.split === '5050') return a + c.value / 2
    if (c.split === 'user1') return a
    if (c.split === 'user2') return a + c.value
    return a + c.value * dRatio
  }, 0)

  const jPr = sum(data.user1?.private || [])
  const dPr = sum(data.user2?.private || [])
  const jSsh = sum(data.user1?.savings?.shared || [])
  const dSsh = sum(data.user2?.savings?.shared || [])
  const jSprivate = sum(data.user1?.savings?.private || [])
  const dSprivate = sum(data.user2?.savings?.private || [])
  const jTr = jSh + jSsh
  const dTr = dSh + dSsh
  const jR = jI - jTr - jPr - jSprivate
  const dR = dI - dTr - dPr - dSprivate
  const total = jR + dR

  const buffer = (data.spaarpotjes as Pot[])?.find((x) => x.id === 'sp1')
  const kindPot = (data.spaarpotjes as Pot[])?.find((x) => x.id === 'sp2')
  const hyp = (data.schulden as Schuld[])?.find((x) => x.type === 'hypotheek')
  const duoJ = (data.schulden as Schuld[])?.find((x) => x.type === 'studieschuld' && x.wie === 'user1')
  const duoD = (data.schulden as Schuld[])?.find((x) => x.type === 'studieschuld' && x.wie === 'user2')

  type CardType = 'ok' | 'ng' | 'tip' | 'info'
  function card(t: CardType, title: string, body: string) {
    const styles: Record<CardType, { bd: string; bg: string; tc: string; tl: string }> = {
      ok: { bd: 'rgba(76,175,130,.2)', bg: 'rgba(76,175,130,.04)', tc: 'var(--ok)', tl: 'Positief' },
      ng: { bd: 'rgba(224,80,80,.2)', bg: 'rgba(224,80,80,.04)', tc: 'var(--danger)', tl: 'Aandacht' },
      tip: { bd: 'rgba(0,194,255,.15)', bg: 'rgba(0,194,255,.03)', tc: 'var(--accent)', tl: 'Tip' },
      info: { bd: 'var(--border)', bg: 'rgba(255,255,255,.015)', tc: 'var(--muted2)', tl: 'Informatief' },
    }
    const s = styles[t]
    return { t, title, body, ...s }
  }

  const cards: ReturnType<typeof card>[] = []

  if (total >= 500) cards.push(card('ok', `Overschot: ${fmtK(total)}/maand`, `${n1} houdt ${fmtK(jR)} over, ${n2} houdt ${fmtK(dR)} over. Gebruik dit om de buffer aan te vullen richting €15.000.`))
  else if (total >= 0) cards.push(card('tip', `Beperkt restant: ${fmtK(total)}/maand`, `${n1} ${fmtK(jR)}, ${n2} ${fmtK(dR)}. Verlaag tijdelijk prive spaardoelen tot de buffer op orde is.`))
  else cards.push(card('ng', `Negatief saldo: ${fmtK(total)}/maand`, `${n1} ${fmtK(jR)}, ${n2} ${fmtK(dR)}. Jullie geven ${fmtK(-total)}/maand meer uit dan er binnenkomt.`))

  if (buffer) {
    const pct = buffer.current / buffer.goal
    const miss = buffer.goal - buffer.current
    const eta = total > 0 ? Math.ceil(miss / total) : null
    if (pct < 1) cards.push(card('tip', `Buffer ${Math.round(pct * 100)}% — nog ${fmtK(miss)} te gaan`, `Buffer staat op ${fmtK(buffer.current)} van ${fmtK(buffer.goal)}.${eta && eta > 0 ? ` Bij huidig overschot voltooid in ca. ${eta} maanden.` : ''}`))
    else cards.push(card('ok', `Buffer volledig: ${fmtK(buffer.current)}`, `Noodbuffer op orde. Extra overschot kan werken via beleggingen of extra aflossing.`))
  }

  if ((duoJ && duoJ.balance > 0) || (duoD && duoD.balance > 0)) {
    const jB = duoJ ? duoJ.balance : 0, dB = duoD ? duoD.balance : 0
    const jMo = duoJ ? calcMonths(jB, duoJ.payment, duoJ.rate) : null
    const dMo = duoD ? calcMonths(dB, duoD.payment, duoD.rate) : null
    const parts = []
    if (jB > 0 && jMo) parts.push(`${n1} ${fmtK(jB)} in ${Math.ceil(jMo / 12)} jaar`)
    if (dB > 0 && dMo) parts.push(`${n2} ${fmtK(dB)} in ${Math.ceil(dMo / 12)} jaar`)
    cards.push(card('info', `DUO-schuld: ${fmtK(jB + dB)}`, `${parts.join(', ')}. DUO-rente (~2,56%) is lager dan historisch beleggingsrendement. Kies bewust tussen rust (aflossen) en rendement (beleggen).`))
  }

  if (hyp && hyp.balance > 0) {
    const months = calcMonths(hyp.balance, hyp.payment, hyp.rate)
    let fn = ''
    if (hyp.fixedYears && hyp.fixedStart) {
      const e = new Date(hyp.fixedStart)
      e.setFullYear(e.getFullYear() + hyp.fixedYears)
      const dl = Math.ceil((e.getTime() - new Date().getTime()) / 86400000)
      fn = dl > 0 ? ` Rente vast t/m ${e.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })} (nog ${Math.round(dl / 30)} mnd).` : ' Rentevaste periode verlopen.'
    }
    cards.push(card('info', `Hypotheek: ${fmtK(hyp.balance)} resterende schuld`, `Looptijd ca. ${months ? Math.floor(months / 12) + ' jaar' : 'onbekend'}.${fn} Vergeet hypotheekrente in de belastingaangifte.`))
  }

  if (kindPot && kindPot.current < kindPot.goal) cards.push(card('tip', `Kind geld: ${Math.round(kindPot.current / kindPot.goal * 100)}% bereikt`, `Nog ${fmtK(kindPot.goal - kindPot.current)} te gaan. Overweeg een spaarrekening op naam voor betere groei.`))

  cards.push(card('ok', `Gezamenlijk sparen: ${fmtK(jSsh + dSsh)}/maand`, `${n1} maakt ${fmtK(jTr)} over, ${n2} ${fmtK(dTr)}. Spaarbijdragen zijn verwerkt in het overboekingsbedrag.`))

  const panel: React.CSSProperties = { background: 'var(--s3)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '22px 26px', marginBottom: 22 }

  return (
    <div style={panel}>
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Financieel advies op maat</span>
      </div>
      {cards.map((c, i) => (
        <div key={i} style={{ borderRadius: 7, padding: '16px 18px', marginBottom: 10, border: `1px solid ${c.bd}`, background: c.bg }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6, color: c.tc }}>{c.tl}</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, fontFamily: 'var(--font-heading)' }}>{c.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted2)', lineHeight: 1.75 }}>{c.body}</div>
        </div>
      ))}
    </div>
  )
}
