export type RentePeriode = { id: string; startDate: string; endDate?: string; rate: number }

export type SchuldForCalc = {
  id: string
  naam: string
  wie: string
  balance: number
  payment: number
  rate: number
  loanType?: string
  looptijdMaanden?: number
  entryDate?: string
  rentePeriodes?: RentePeriode[]
}

export type AutoKostItem = {
  id: string
  label: string
  value: number
  split: string
  p1?: number
  p2?: number
  schuldId: string
  schuldNaam: string
}

export type AutoKostSplits = Record<string, { split: string; p1?: number; p2?: number }>

export function msBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (86400000 * 365.25 / 12)))
}

export function maandenTussen(van: Date, tot: Date): number {
  return Math.max(0, (tot.getFullYear() - van.getFullYear()) * 12 + (tot.getMonth() - van.getMonth()))
}

export function getActivePeriode(sc: SchuldForCalc, atDate: Date): RentePeriode | null {
  const periodes = sc.rentePeriodes
  if (!periodes || periodes.length === 0) return null
  const sorted = [...periodes].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  for (const p of sorted) {
    const start = new Date(p.startDate)
    const end = p.endDate ? new Date(p.endDate) : null
    if (atDate >= start && (!end || atDate < end)) return p
  }
  return sorted[sorted.length - 1]
}

export function calcRemainingBalance(sc: SchuldForCalc, targetDate: Date): number {
  const loanType = sc.loanType || 'overig'
  const entry = sc.entryDate ? new Date(sc.entryDate) : null
  const n = sc.looptijdMaanden
  if (!entry || !n) return sc.balance
  if (loanType === 'aflossingsvrij') return sc.balance

  const periodes = sc.rentePeriodes && sc.rentePeriodes.length > 0
    ? [...sc.rentePeriodes].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    : null

  if (!periodes) {
    const r = sc.rate / 100 / 12
    const k = Math.max(0, maandenTussen(entry, targetDate) - 1)
    if (k === 0) return sc.balance
    if (loanType === 'annuitair') {
      if (r === 0) return Math.max(0, sc.balance - k * (sc.balance / n))
      const ann = sc.balance * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      return Math.max(0, sc.balance * Math.pow(1 + r, k) - ann * (Math.pow(1 + r, k) - 1) / r)
    }
    if (loanType === 'lineair') return Math.max(0, sc.balance - k * (sc.balance / n))
    return Math.max(0, sc.balance - k * (sc.payment || 0))
  }

  if (loanType !== 'annuitair' && loanType !== 'lineair') {
    const k = Math.max(0, maandenTussen(entry, targetDate) - 1)
    return Math.max(0, sc.balance - k * (sc.payment || 0))
  }

  let balance = sc.balance
  let cursor = new Date(entry)
  const loanEnd = new Date(entry)
  loanEnd.setMonth(loanEnd.getMonth() + n)

  for (let i = 0; i < periodes.length; i++) {
    const p = periodes[i]
    const periodeEnd = p.endDate ? new Date(p.endDate) : (periodes[i + 1] ? new Date(periodes[i + 1].startDate) : targetDate)
    const segmentEnd = periodeEnd < targetDate ? periodeEnd : targetDate
    if (segmentEnd <= cursor) { cursor = segmentEnd; continue }
    const rawK = i === 0 ? maandenTussen(cursor, segmentEnd) - 1 : maandenTussen(cursor, segmentEnd)
    const k = Math.max(0, rawK)
    if (k <= 0) { cursor = segmentEnd; continue }
    const r = p.rate / 100 / 12
    const remainingMonths = Math.max(1, msBetween(cursor, loanEnd))
    if (loanType === 'annuitair') {
      if (r === 0) {
        balance = Math.max(0, balance - k * (sc.balance / n))
      } else {
        const ann = balance * (r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1)
        balance = Math.max(0, balance * Math.pow(1 + r, k) - ann * (Math.pow(1 + r, k) - 1) / r)
      }
    } else {
      balance = Math.max(0, balance - k * (sc.balance / n))
    }
    cursor = segmentEnd
    if (cursor >= targetDate) break
  }

  return Math.max(0, balance)
}

export function buildAutoKosten(schulden: SchuldForCalc[], splitOverrides?: AutoKostSplits): AutoKostItem[] {
  const now = new Date()
  const eersteVanDeMaand = new Date(now.getFullYear(), now.getMonth(), 1)
  const result: AutoKostItem[] = []

  for (const sc of schulden) {
    if (sc.wie !== 'samen') continue
    const lt = sc.loanType || 'overig'
    if (lt !== 'annuitair' && lt !== 'lineair') continue
    if (!sc.looptijdMaanden || !sc.entryDate) continue

    const activePeriode = getActivePeriode(sc, now)
    const actieveRente = activePeriode ? activePeriode.rate : sc.rate
    const r = actieveRente / 100 / 12
    const saldo = calcRemainingBalance(sc, eersteVanDeMaand)

    const entry = new Date(sc.entryDate)
    const loanEnd = new Date(entry)
    loanEnd.setMonth(loanEnd.getMonth() + sc.looptijdMaanden)

    let annuiteit: number
    if (lt === 'annuitair' && r > 0) {
      if (activePeriode && sc.rentePeriodes && sc.rentePeriodes.length > 1) {
        const periodeStart = new Date(activePeriode.startDate)
        const balAtStart = calcRemainingBalance(sc, periodeStart)
        const remAtStart = maandenTussen(periodeStart, loanEnd)
        annuiteit = remAtStart > 0 ? balAtStart * (r * Math.pow(1 + r, remAtStart)) / (Math.pow(1 + r, remAtStart) - 1) : 0
      } else {
        annuiteit = sc.balance * (r * Math.pow(1 + r, sc.looptijdMaanden)) / (Math.pow(1 + r, sc.looptijdMaanden) - 1)
      }
    } else if (lt === 'lineair' && sc.looptijdMaanden) {
      annuiteit = (sc.balance / sc.looptijdMaanden) + saldo * r
    } else {
      continue
    }

    const maandRente = saldo * r
    const maandAflossing = Math.max(0, annuiteit - maandRente)
    const renteId = `auto-rente-${sc.id}`
    const aflossId = `auto-aflossing-${sc.id}`
    const renteCfg = splitOverrides?.[renteId] || { split: '5050' }
    const aflosCfg = splitOverrides?.[aflossId] || { split: '5050' }

    if (maandRente > 0) {
      result.push({
        id: renteId,
        label: `${sc.naam} — rente`,
        value: Math.round(maandRente),
        split: renteCfg.split,
        p1: renteCfg.p1,
        p2: renteCfg.p2,
        schuldId: sc.id,
        schuldNaam: sc.naam,
      })
    }
    if (maandAflossing > 0) {
      result.push({
        id: aflossId,
        label: `${sc.naam} — aflossing`,
        value: Math.round(maandAflossing),
        split: aflosCfg.split,
        p1: aflosCfg.p1,
        p2: aflosCfg.p2,
        schuldId: sc.id,
        schuldNaam: sc.naam,
      })
    }
  }

  return result
}
