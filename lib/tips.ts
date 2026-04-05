import { InsightData } from './insight-context'
import { fmtK } from './format'

export type Tip = {
  id: string
  categorie: 'buffer' | 'schulden' | 'sparen' | 'kosten' | 'verdeling' | 'algemeen'
  prioriteit: 'hoog' | 'medium' | 'laag'
  titel: string
  tekst: string
  actie?: { label: string; pagina: string; tab?: string }
}

type Sub = { id: string; name: string; amount: number; freq: string; person: string; split?: string; p1?: number; p2?: number }
type Pot = { id: string; label: string; current: number; goal: number }
type Schuld = { id: string; naam: string; type: string; wie: string; balance: number; payment: number; rate: number; loanType?: string; fixedYears?: number; fixedStart?: string; rentePeriodes?: { id: string; startDate: string; endDate?: string; rate: number }[] }
type SavItem = { value: number; split?: string; p1?: number; p2?: number }
type SharedItem = { value: number; split: string; p1?: number; p2?: number }
type IncomeItem = { value: number; excludeFromRatio?: boolean }

type Ctx = {
  data: InsightData
  isSingleUser: boolean
  n1: string
  n2: string
  jI: number
  dI: number
  totalIncome: number
  jRatio: number
  dRatio: number
  jR: number
  dR: number
  gezamenlijkeLasten: number
  spaarbuffer: number
  totaleSpaarbedragen: number
  totalSchulden: number
  totaleAbonnementen: number
  potten: Pot[]
  schulden: Schuld[]
  subs: Sub[]
}

type TipDef = {
  id: string
  categorie: Tip['categorie']
  prioriteit: Tip['prioriteit']
  titel: string | ((ctx: Ctx) => string)
  tekst: string | ((ctx: Ctx) => string)
  conditie: (ctx: Ctx) => boolean
  actie?: { label: string; pagina: string; tab?: string }
}

function subMonthly(s: Sub): number {
  if (s.freq === 'jaarlijks') return s.amount / 12
  if (s.freq === 'kwartaal') return s.amount / 3
  return s.amount
}


const TIPS: TipDef[] = [
  {
    id: 'tip-geen-buffer',
    categorie: 'buffer',
    prioriteit: 'hoog',
    conditie: (ctx) => !ctx.potten.some((p) => /buffer|nood|reserve/i.test(p.label)),
    titel: 'Zet een noodfonds apart',
    tekst: 'Een noodfonds is geld dat je alleen aanraakt als het echt niet anders kan. Zet dit op een aparte spaarrekening zodat je niet in de verleiding komt het uit te geven. Begin klein — zelfs €50 per maand helpt al.',
    actie: { label: 'Noodfonds aanmaken', pagina: 'vermogen', tab: 'sparen' },
  },
  {
    id: 'tip-buffer-te-laag-stel',
    categorie: 'buffer',
    prioriteit: 'medium',
    conditie: (ctx) =>
      !ctx.isSingleUser &&
      ctx.spaarbuffer > 0 &&
      ctx.gezamenlijkeLasten > 0 &&
      ctx.spaarbuffer < ctx.gezamenlijkeLasten * 3,
    titel: 'Jullie buffer kan wat groter',
    tekst: (ctx) =>
      `Het NIBUD adviseert stellen om 3 à 4 maandsalarissen achter de hand te houden voor onverwachte kosten. Denk aan een kapotte wasmachine of een periode zonder inkomen. Jullie vaste lasten zijn ${fmtK(ctx.gezamenlijkeLasten)} per maand — een buffer van minimaal ${fmtK(ctx.gezamenlijkeLasten * 3)} is verstandig.`,
    actie: { label: 'Spaardoel instellen', pagina: 'vermogen', tab: 'sparen' },
  },
  {
    id: 'tip-buffer-te-laag-solo',
    categorie: 'buffer',
    prioriteit: 'medium',
    conditie: (ctx) =>
      ctx.isSingleUser &&
      ctx.spaarbuffer > 0 &&
      ctx.gezamenlijkeLasten > 0 &&
      ctx.spaarbuffer < ctx.gezamenlijkeLasten * 2,
    titel: 'Je buffer kan wat groter',
    tekst: (ctx) =>
      `Het NIBUD adviseert alleenstaanden om 2 à 3 maandsalarissen achter de hand te houden. Je vaste lasten zijn ${fmtK(ctx.gezamenlijkeLasten)} per maand — probeer minimaal ${fmtK(ctx.gezamenlijkeLasten * 2)} apart te zetten.`,
    actie: { label: 'Spaardoel instellen', pagina: 'vermogen', tab: 'sparen' },
  },
  {
    id: 'tip-duo-rente-laag',
    categorie: 'schulden',
    prioriteit: 'laag',
    conditie: (ctx) =>
      ctx.schulden.some((s) => s.type === 'studieschuld' && s.balance > 0 && s.rate < 3),
    titel: 'Aflossen of beleggen?',
    tekst: (ctx) => {
      const s = ctx.schulden.find((s) => s.type === 'studieschuld' && s.balance > 0 && s.rate < 3)
      const rate = s ? s.rate.toFixed(2).replace('.', ',') : '?'
      return `De DUO-rente is ${rate}%. Historisch gezien levert beleggen op de lange termijn gemiddeld meer op dan deze rente kost. Het kan dus slimmer zijn om het geld te beleggen in plaats van extra af te lossen. Bespreek dit met een financieel adviseur.`
    },
  },
  {
    id: 'tip-duo-rente-hoog',
    categorie: 'schulden',
    prioriteit: 'medium',
    conditie: (ctx) =>
      ctx.schulden.some((s) => s.type === 'studieschuld' && s.balance > 0 && s.rate > 3.5),
    titel: 'Extra aflossen op je studielening?',
    tekst: (ctx) => {
      const s = ctx.schulden.find((s) => s.type === 'studieschuld' && s.balance > 0 && s.rate > 3.5)
      const rate = s ? s.rate.toFixed(2).replace('.', ',') : '?'
      return `De DUO-rente is ${rate}%. Bij een rente boven de 3% kan het slim zijn om extra af te lossen als je geld over hebt — dat scheelt je meer dan het meeste spaarrendement oplevert.`
    },
  },
  {
    id: 'tip-hypotheek-rentevaste-periode',
    categorie: 'schulden',
    prioriteit: 'hoog',
    conditie: (ctx) => {
      const today = new Date()
      const in12m = new Date(today)
      in12m.setMonth(in12m.getMonth() + 12)
      return ctx.schulden.some((s) => {
        if (s.type !== 'hypotheek') return false
        const periodes = (s.rentePeriodes || []).slice().sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        )
        if (periodes.length > 0) {
          const active = periodes.find((p) => {
            const start = new Date(p.startDate)
            const end = p.endDate ? new Date(p.endDate) : null
            return today >= start && (!end || today < end)
          })
          if (active?.endDate) {
            const end = new Date(active.endDate)
            return end > today && end <= in12m
          }
        }
        if (s.fixedYears && s.fixedStart) {
          const end = new Date(s.fixedStart)
          end.setFullYear(end.getFullYear() + s.fixedYears)
          return end > today && end <= in12m
        }
        return false
      })
    },
    titel: 'Rentevaste periode loopt bijna af',
    tekst: (ctx) => {
      const today = new Date()
      const in12m = new Date(today)
      in12m.setMonth(in12m.getMonth() + 12)
      let naam = ''
      let endDate: Date | null = null
      for (const s of ctx.schulden) {
        if (s.type !== 'hypotheek') continue
        const periodes = (s.rentePeriodes || []).slice().sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        )
        if (periodes.length > 0) {
          const active = periodes.find((p) => {
            const start = new Date(p.startDate)
            const end = p.endDate ? new Date(p.endDate) : null
            return today >= start && (!end || today < end)
          })
          if (active?.endDate) {
            const end = new Date(active.endDate)
            if (end > today && end <= in12m) { naam = s.naam; endDate = end; break }
          }
        }
        if (!endDate && s.fixedYears && s.fixedStart) {
          const end = new Date(s.fixedStart)
          end.setFullYear(end.getFullYear() + s.fixedYears)
          if (end > today && end <= in12m) { naam = s.naam; endDate = end; break }
        }
      }
      const dateStr = endDate
        ? endDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'onbekend'
      return `De rentevaste periode van ${naam} loopt af op ${dateStr}. Dit is het moment om de markt te vergelijken en je bank te bellen over een nieuwe rente. Begin hier minimaal 3 maanden van tevoren mee.`
    },
    actie: { label: 'Bekijk hypotheek', pagina: 'vermogen', tab: 'schulden' },
  },
  {
    id: 'tip-hoge-schuld-ratio',
    categorie: 'schulden',
    prioriteit: 'medium',
    conditie: (ctx) => ctx.totalIncome > 0 && ctx.totalSchulden > ctx.totalIncome * 12,
    titel: (ctx) => ctx.isSingleUser ? 'Je schuld is relatief hoog' : 'Jullie schuld is relatief hoog',
    tekst: 'De totale schuld is meer dan een jaarsalaris. Dat is niet per se een probleem als het een hypotheek is, maar het is wel goed om hier bewust van te zijn. Zorg dat de maandlasten nooit meer dan 30% van het inkomen zijn.',
  },
  {
    id: 'tip-geen-spaardoelen',
    categorie: 'sparen',
    prioriteit: 'medium',
    conditie: (ctx) => ctx.potten.length === 0,
    titel: (ctx) => ctx.isSingleUser ? 'Waar spaar je voor?' : 'Waar sparen jullie voor?',
    tekst: (ctx) =>
      ctx.isSingleUser
        ? 'Sparen gaat veel makkelijker als je weet waarvoor. Of het nou een vakantie, verbouwing of nieuwe auto is — een concreet doel helpt je gemotiveerd te blijven. Stel je eerste spaardoel in.'
        : 'Sparen gaat veel makkelijker als je weet waarvoor. Of het nou een vakantie, verbouwing of nieuwe auto is — een concreet doel helpt jullie gemotiveerd te blijven. Stel jullie eerste spaardoel in.',
    actie: { label: 'Spaardoel aanmaken', pagina: 'vermogen', tab: 'sparen' },
  },
  {
    id: 'tip-spaardoel-bijna-bereikt',
    categorie: 'sparen',
    prioriteit: 'laag',
    conditie: (ctx) =>
      ctx.potten.some((p) => p.goal > 0 && p.current / p.goal > 0.8 && p.current < p.goal),
    titel: (ctx) => {
      const pot = ctx.potten.find((p) => p.goal > 0 && p.current / p.goal > 0.8 && p.current < p.goal)
      return pot ? `${pot.label} is bijna bereikt!` : 'Spaardoel bijna bereikt!'
    },
    tekst: (ctx) => {
      const pot = ctx.potten.find((p) => p.goal > 0 && p.current / p.goal > 0.8 && p.current < p.goal)
      if (!pot) return ''
      const p = Math.round((pot.current / pot.goal) * 100)
      const jeZijn = ctx.isSingleUser ? 'je bent' : 'jullie zijn'
      const jeVolgende = ctx.isSingleUser ? 'je' : 'jullie'
      return `Het ${pot.label} spaardoel is voor ${p}% gevuld. Nog even volhouden — ${jeZijn} er bijna. Denk alvast na over wat ${jeVolgende} volgende spaardoel wordt.`
    },
  },
  {
    id: 'tip-weinig-spaargeld-percentage',
    categorie: 'sparen',
    prioriteit: 'medium',
    conditie: (ctx) =>
      ctx.totalIncome > 0 && ctx.totaleSpaarbedragen / ctx.totalIncome < 0.1,
    titel: (ctx) =>
      ctx.isSingleUser ? 'Je spaart nog relatief weinig' : 'Jullie sparen nog relatief weinig',
    tekst: (ctx) => {
      const p = Math.round((ctx.totaleSpaarbedragen / ctx.totalIncome) * 100)
      const jeSit = ctx.isSingleUser ? 'Je zit' : 'Jullie zitten'
      const jeMaand = ctx.isSingleUser ? 'je' : 'jullie'
      return `Financieel adviseurs raden aan om minimaal 10% van je inkomen te sparen. ${jeSit} nu op ${p}%. Een kleine verhoging van ${jeMaand} maandelijkse spaarbedrag maakt op de lange termijn een groot verschil.`
    },
    actie: { label: 'Spaarbedrag aanpassen', pagina: 'vermogen', tab: 'sparen' },
  },
  {
    id: 'tip-geen-pensioen-sparen',
    categorie: 'sparen',
    prioriteit: 'laag',
    conditie: (ctx) =>
      ctx.totalIncome > 3000 &&
      !ctx.potten.some((p) => /pensioen|oudedag/i.test(p.label)),
    titel: (ctx) =>
      ctx.isSingleUser ? 'Denk je al aan later?' : 'Denken jullie al aan later?',
    tekst: 'Naast het pensioen dat je via je werk opbouwt, is extra sparen voor later slim — zeker als je een tijdje minder hebt gewerkt of ZZP\'er bent. Hoe eerder je begint, hoe minder je per maand hoeft te sparen.',
  },
  {
    id: 'tip-dubbele-abonnementen',
    categorie: 'kosten',
    prioriteit: 'laag',
    conditie: (ctx) => {
      const names = ctx.subs.map((s) => s.name.toLowerCase().trim())
      return names.some((n, i) => names.indexOf(n) !== i)
    },
    titel: 'Dubbele abonnementen?',
    tekst: (ctx) =>
      ctx.isSingleUser
        ? 'Check of je twee keer hetzelfde abonnement hebt — dat is vaak onnodig.'
        : 'Nu jullie samenwonen kunnen sommige abonnementen samengevoegd worden. Check of jullie allebei een eigen abonnement hebben voor dezelfde dienst — dat is vaak onnodig.',
    actie: { label: 'Bekijk abonnementen', pagina: 'kosten', tab: 'abonnementen' },
  },
  {
    id: 'tip-hoge-abonnementen',
    categorie: 'kosten',
    prioriteit: 'medium',
    conditie: (ctx) =>
      ctx.totalIncome > 0 && ctx.totaleAbonnementen > ctx.totalIncome * 0.08,
    titel: (ctx) =>
      ctx.isSingleUser ? 'Abonnementen kosten je veel' : 'Abonnementen kosten jullie veel',
    tekst: (ctx) => {
      const p = Math.round((ctx.totaleAbonnementen / ctx.totalIncome) * 100)
      const jeGeven = ctx.isSingleUser ? 'Je geeft' : 'Jullie geven'
      const jeInk = ctx.isSingleUser ? 'je' : 'jullie'
      const jeCheck = ctx.isSingleUser ? 'je' : 'jullie'
      const gebruik = ctx.isSingleUser ? 'gebruikt' : 'gebruiken'
      return `${jeGeven} ${fmtK(ctx.totaleAbonnementen)} per maand uit aan abonnementen — dat is ${p}% van ${jeInk} inkomen. Loop ze eens door en check welke ${jeCheck} echt nog ${gebruik}. Kleine bezuinigingen hier tellen snel op.`
    },
    actie: { label: 'Bekijk abonnementen', pagina: 'kosten', tab: 'abonnementen' },
  },
  {
    id: 'tip-hoge-vaste-lasten',
    categorie: 'kosten',
    prioriteit: 'medium',
    conditie: (ctx) =>
      ctx.totalIncome > 0 && ctx.gezamenlijkeLasten / ctx.totalIncome > 0.4,
    titel: (ctx) =>
      ctx.isSingleUser ? 'Je vaste lasten zijn hoog' : 'Jullie vaste lasten zijn hoog',
    tekst: (ctx) => {
      const p = Math.round((ctx.gezamenlijkeLasten / ctx.totalIncome) * 100)
      const jeJullie = ctx.isSingleUser ? 'Je' : 'Jullie'
      const jeInk = ctx.isSingleUser ? 'je' : 'jullie'
      return `${jeJullie} vaste lasten zijn ${fmtK(ctx.gezamenlijkeLasten)} per maand — dat is ${p}% van ${jeInk} inkomen. Het NIBUD hanteert als richtlijn dat woonlasten en vaste kosten idealiter niet meer dan 35-40% van je inkomen zijn.`
    },
  },
  {
    id: 'tip-geen-reisverzekering',
    categorie: 'kosten',
    prioriteit: 'laag',
    conditie: (ctx) => {
      const allItems = [
        ...ctx.subs.map((s) => s.name),
        ...(ctx.data.shared as { label?: string; name?: string }[]).map((i) => i.label || i.name || ''),
        ...(ctx.data.user1?.private as { label?: string; name?: string }[] || []).map((i) => i.label || i.name || ''),
        ...(ctx.data.user2?.private as { label?: string; name?: string }[] || []).map((i) => i.label || i.name || ''),
      ]
      return !allItems.some((n) => /reis/i.test(n))
    },
    titel: (ctx) =>
      ctx.isSingleUser ? 'Heb je een reisverzekering?' : 'Hebben jullie een reisverzekering?',
    tekst: (ctx) =>
      ctx.isSingleUser
        ? 'Check of je goed verzekerd bent voor je volgende reis.'
        : 'Nu jullie samenwonen is een gezamenlijke reisverzekering vaak goedkoper dan twee losse. Check of jullie goed verzekerd zijn voor jullie volgende reis.',
  },
  {
    id: 'tip-geen-rechtsbijstand',
    categorie: 'kosten',
    prioriteit: 'laag',
    conditie: (ctx) => {
      const allItems = [
        ...ctx.subs.map((s) => s.name),
        ...(ctx.data.shared as { label?: string; name?: string }[]).map((i) => i.label || i.name || ''),
        ...(ctx.data.user1?.private as { label?: string; name?: string }[] || []).map((i) => i.label || i.name || ''),
        ...(ctx.data.user2?.private as { label?: string; name?: string }[] || []).map((i) => i.label || i.name || ''),
      ]
      return !allItems.some((n) => /rechtsbijstand/i.test(n))
    },
    titel: 'Rechtsbijstandsverzekering?',
    tekst: 'Een rechtsbijstandsverzekering helpt je als je juridische hulp nodig hebt — bijvoorbeeld bij een arbeidsconflict of burenruzie. Veel mensen onderschatten hoe handig dit kan zijn.',
  },
  {
    id: 'tip-groot-inkomensverschil',
    categorie: 'verdeling',
    prioriteit: 'medium',
    conditie: (ctx) => {
      if (ctx.isSingleUser || ctx.jI <= 0 || ctx.dI <= 0) return false
      const diff = Math.abs(ctx.jI - ctx.dI) / Math.max(ctx.jI, ctx.dI)
      if (diff <= 0.3) return false
      const shared = ctx.data.shared as SharedItem[]
      const totalSharedValue = shared.reduce((a, s) => a + (s.value || 0), 0)
      const fiftyfiftyValue = shared.filter((s) => s.split === '5050').reduce((a, s) => a + (s.value || 0), 0)
      return totalSharedValue > 0 && fiftyfiftyValue / totalSharedValue > 0.5
    },
    titel: 'Groot inkomensverschil — is 50/50 eerlijk?',
    tekst: (ctx) => {
      const diff = Math.round((Math.abs(ctx.jI - ctx.dI) / Math.max(ctx.jI, ctx.dI)) * 100)
      return `Er zit een verschil van ${diff}% in jullie inkomens. Veel stellen kiezen in dat geval voor een verdeling naar rato — wie meer verdient betaalt een groter deel van de vaste lasten. Zo houden jullie beiden even veel vrij besteedbaar.`
    },
    actie: { label: 'Verdeling aanpassen', pagina: 'kosten', tab: 'gezamenlijk' },
  },
  {
    id: 'tip-weinig-vrij-besteedbaar',
    categorie: 'verdeling',
    prioriteit: 'medium',
    conditie: (ctx) => {
      if (ctx.isSingleUser) {
        return ctx.jI > 0 && ctx.jR >= 0 && ctx.jR < ctx.jI * 0.15
      }
      const bothHaveIncome = ctx.jI > 0 && ctx.dI > 0
      if (!bothHaveIncome) return false
      const minR = Math.min(ctx.jR, ctx.dR)
      const minI = Math.min(ctx.jI, ctx.dI)
      return minR >= 0 && minR < minI * 0.15
    },
    titel: (ctx) => {
      if (ctx.isSingleUser) return `${ctx.n1} houdt weinig over`
      const poorerName = ctx.jR <= ctx.dR ? ctx.n1 : ctx.n2
      return `${poorerName} houdt weinig over`
    },
    tekst: (ctx) => {
      if (ctx.isSingleUser) {
        return `${ctx.n1} houdt na alle vaste lasten en sparen maar ${fmtK(ctx.jR)} per maand over. Dat is minder dan 15% van het inkomen. Kijk of je ergens op kunt besparen.`
      }
      const poorerName = ctx.jR <= ctx.dR ? ctx.n1 : ctx.n2
      const poorerR = Math.min(ctx.jR, ctx.dR)
      return `${poorerName} houdt na alle vaste lasten en sparen maar ${fmtK(poorerR)} per maand over. Dat is minder dan 15% van het inkomen. Bespreek samen of de verdeling van kosten nog klopt of dat er ergens op bespaard kan worden.`
    },
  },
  {
    id: 'tip-negatief-restant',
    categorie: 'verdeling',
    prioriteit: 'hoog',
    conditie: (ctx) => ctx.jR < 0 || (!ctx.isSingleUser && ctx.dR < 0),
    titel: (ctx) => {
      const j = ctx.jR < 0
      const d = !ctx.isSingleUser && ctx.dR < 0
      if (j && d) return 'Jullie komen geld tekort'
      if (j) return `${ctx.n1} komt geld tekort`
      return `${ctx.n2} komt geld tekort`
    },
    tekst: (ctx) => {
      const j = ctx.jR < 0
      const d = !ctx.isSingleUser && ctx.dR < 0
      if (j && d) return 'Jullie geven meer uit dan er binnenkomt. Check of alle kosten kloppen en of er iets aangepast moet worden.'
      const name = j ? ctx.n1 : ctx.n2
      return `${name} geeft meer uit dan er binnenkomt. Check of alle kosten kloppen en of er iets aangepast moet worden.`
    },
  },
  {
    id: 'tip-samenlevingscontract',
    categorie: 'algemeen',
    prioriteit: 'laag',
    conditie: (ctx) => !ctx.isSingleUser,
    titel: 'Hebben jullie een samenlevingscontract?',
    tekst: 'Als je samenwoont ben je niet automatisch elkaars erfgenaam. Een samenlevingscontract legt afspraken vast over jullie bezittingen, schulden en wat er gebeurt als jullie uit elkaar gaan of één van jullie overlijdt. Dit regel je bij de notaris.',
  },
  {
    id: 'tip-fiscaal-partnerschap',
    categorie: 'algemeen',
    prioriteit: 'laag',
    conditie: (ctx) => !ctx.isSingleUser,
    titel: 'Zijn jullie fiscale partners?',
    tekst: 'Als jullie samenwonen, een kind hebben of een koopwoning delen zijn jullie mogelijk fiscale partners. Dit kan belastingvoordeel opleveren — jullie mogen bepaalde aftrekposten dan verdelen. Check dit bij de Belastingdienst of een belastingadviseur.',
  },
  {
    id: 'tip-pensioen-partner',
    categorie: 'algemeen',
    prioriteit: 'laag',
    conditie: (ctx) => !ctx.isSingleUser,
    titel: 'Ken je de pensioenregeling van je partner?',
    tekst: 'Als samenwoners zijn jullie niet automatisch elkaars begunstigde voor het pensioen. Meld je partner aan bij jullie pensioenfonds als nabestaande — anders krijgt die bij overlijden mogelijk niets.',
  },
  {
    id: 'tip-alles-ingevuld',
    categorie: 'algemeen',
    prioriteit: 'laag',
    conditie: (ctx) =>
      ctx.totalIncome > 0 &&
      (ctx.data.shared as SharedItem[]).length > 0 &&
      ctx.potten.length > 0,
    titel: (ctx) =>
      ctx.isSingleUser ? 'Je overzicht is compleet 🎉' : 'Jullie overzicht is compleet 🎉',
    tekst: (ctx) => {
      const heeftHebben = ctx.isSingleUser ? 'je hebt' : 'jullie hebben'
      const jeJullie = ctx.isSingleUser ? 'je' : 'jullie'
      const kuntKunnen = ctx.isSingleUser ? 'kunt' : 'kunnen'
      return `Goed bezig — ${heeftHebben} alle onderdelen ingevuld. Get Clear heeft nu een volledig beeld van ${jeJullie} financiën. Check de tips hierboven om te zien waar ${jeJullie} nog winst ${kuntKunnen} behalen.`
    },
  },
  {
    id: 'tip-onboarding-inkomsten',
    categorie: 'algemeen',
    prioriteit: 'hoog',
    conditie: (ctx) => ctx.totalIncome === 0,
    titel: (ctx) =>
      ctx.isSingleUser ? 'Begin met je inkomsten' : 'Begin met jullie inkomsten',
    tekst: (ctx) => {
      const jeJullie = ctx.isSingleUser ? 'je' : 'jullie'
      const kunt = ctx.isSingleUser ? 'kunt' : 'kunnen'
      return `Vul eerst ${jeJullie} maandelijkse inkomsten in. Dat is de basis van alles — daarna kan de app berekenen hoeveel ${jeJullie} ${kunt} uitgeven, sparen en wat er overblijft.`
    },
    actie: { label: 'Inkomsten invullen', pagina: 'inkomsten' },
  },
]

export function getRelevanteTips(data: InsightData, isSingleUser: boolean): Tip[] {
  const n1 = data.names?.user1 || 'Gebruiker 1'
  const n2 = data.names?.user2 || 'Gebruiker 2'

  const incomeUser1 = (data.user1?.income as IncomeItem[] || [])
  const incomeUser2 = (data.user2?.income as IncomeItem[] || [])
  const jI = incomeUser1.reduce((a, i) => a + (i.value || 0), 0)
  const dI = isSingleUser ? 0 : incomeUser2.reduce((a, i) => a + (i.value || 0), 0)
  const totalIncome = jI + dI

  const jIRatio = incomeUser1.filter((i) => !i.excludeFromRatio).reduce((a, i) => a + (i.value || 0), 0)
  const dIRatio = isSingleUser ? 0 : incomeUser2.filter((i) => !i.excludeFromRatio).reduce((a, i) => a + (i.value || 0), 0)
  const totalRatio = jIRatio + dIRatio
  const jRatio = totalRatio > 0 ? jIRatio / totalRatio : 0.5
  const dRatio = 1 - jRatio

  const sharedItems = (data.shared as SharedItem[] || [])

  function calcSplit(split: string, value: number, p1: number | undefined, p2: number | undefined): { u1: number; u2: number } {
    if (split === '5050') return { u1: value / 2, u2: value / 2 }
    if (split === 'user1') return { u1: value, u2: 0 }
    if (split === 'user2') return { u1: 0, u2: value }
    if (split === 'percent') return { u1: value * (p1 ?? 50) / 100, u2: value * (p2 ?? 50) / 100 }
    return { u1: value * jRatio, u2: value * dRatio }
  }

  const jSh = sharedItems.reduce((a, c) => a + calcSplit(c.split, c.value || 0, c.p1, c.p2).u1, 0)
  const dSh = sharedItems.reduce((a, c) => a + calcSplit(c.split, c.value || 0, c.p1, c.p2).u2, 0)

  const jPr = (data.user1?.private as { value: number }[] || []).reduce((a, i) => a + (i.value || 0), 0)
  const dPr = isSingleUser ? 0 : (data.user2?.private as { value: number }[] || []).reduce((a, i) => a + (i.value || 0), 0)

  const jSprivate = (data.user1?.savings?.private as SavItem[] || []).reduce((a, i) => a + (i.value || 0), 0)
  const dSprivate = isSingleUser ? 0 : (data.user2?.savings?.private as SavItem[] || []).reduce((a, i) => a + (i.value || 0), 0)

  const allSavSh = [
    ...(data.user1?.savings?.shared as SavItem[] || []),
    ...(isSingleUser ? [] : (data.user2?.savings?.shared as SavItem[] || [])),
  ]

  function splitSavItem(item: SavItem): { u1: number; u2: number } {
    const s = item.split || '5050'
    const v = item.value || 0
    if (s === 'user1') return { u1: v, u2: 0 }
    if (s === 'user2') return { u1: 0, u2: v }
    if (s === 'percent') return { u1: v * (item.p1 ?? 50) / 100, u2: v * (item.p2 ?? 50) / 100 }
    if (s === 'ratio') return { u1: v * jRatio, u2: v * dRatio }
    return { u1: v / 2, u2: v / 2 }
  }

  const jSsh = allSavSh.reduce((a, i) => a + splitSavItem(i).u1, 0)
  const dSsh = allSavSh.reduce((a, i) => a + splitSavItem(i).u2, 0)

  const subs = (data.abonnementen as Sub[] || [])
  const gezSubs = subs.filter((s) => s.person === 'gezamenlijk')

  function subSplitMonthly(s: Sub): { u1: number; u2: number } {
    const m = subMonthly(s)
    const sp = s.split || '5050'
    if (sp === 'user1') return { u1: m, u2: 0 }
    if (sp === 'user2') return { u1: 0, u2: m }
    if (sp === 'percent') return { u1: m * (s.p1 ?? 50) / 100, u2: m * (s.p2 ?? 50) / 100 }
    if (sp === 'ratio') return { u1: m * jRatio, u2: m * dRatio }
    return { u1: m / 2, u2: m / 2 }
  }

  const jSubGez = gezSubs.reduce((a, s) => a + subSplitMonthly(s).u1, 0)
  const dSubGez = gezSubs.reduce((a, s) => a + subSplitMonthly(s).u2, 0)

  const jTr = jSh + jSsh + jSubGez
  const dTr = dSh + dSsh + dSubGez
  const jR = jI - jTr - jPr - jSprivate
  const dR = isSingleUser ? 0 : dI - dTr - dPr - dSprivate

  const schulden = (data.schulden as Schuld[] || [])
  const potten = (data.spaarpotjes as Pot[] || [])

  const spaarbuffer = potten
    .filter((p) => /buffer|nood|reserve/i.test(p.label))
    .reduce((a, p) => a + (p.current || 0), 0)

  const totalSchulden = schulden.reduce((a, s) => a + (s.balance || 0), 0)

  const schuldenPayments = schulden
    .filter((s) => s.wie === 'samen' || s.wie === 'gezamenlijk')
    .reduce((a, s) => a + (s.payment || 0), 0)
  const gezamenlijkeLasten =
    sharedItems.reduce((a, s) => a + (s.value || 0), 0) + schuldenPayments

  const totaleSpaarbedragen =
    allSavSh.reduce((a, i) => a + (i.value || 0), 0) +
    (data.user1?.savings?.private as SavItem[] || []).reduce((a, i) => a + (i.value || 0), 0) +
    (isSingleUser ? 0 : (data.user2?.savings?.private as SavItem[] || []).reduce((a, i) => a + (i.value || 0), 0))

  const totaleAbonnementen = subs.reduce((a, s) => a + subMonthly(s), 0)

  const ctx: Ctx = {
    data,
    isSingleUser,
    n1,
    n2,
    jI,
    dI,
    totalIncome,
    jRatio,
    dRatio,
    jR,
    dR,
    gezamenlijkeLasten,
    spaarbuffer,
    totaleSpaarbedragen,
    totalSchulden,
    totaleAbonnementen,
    potten,
    schulden,
    subs,
  }

  const priorityOrder: Record<Tip['prioriteit'], number> = { hoog: 0, medium: 1, laag: 2 }

  return TIPS
    .filter((tip) => {
      try { return tip.conditie(ctx) } catch { return false }
    })
    .map((tip): Tip => ({
      id: tip.id,
      categorie: tip.categorie,
      prioriteit: tip.prioriteit,
      titel: typeof tip.titel === 'function' ? tip.titel(ctx) : tip.titel,
      tekst: typeof tip.tekst === 'function' ? tip.tekst(ctx) : tip.tekst,
      ...(tip.actie ? { actie: tip.actie } : {}),
    }))
    .sort((a, b) => priorityOrder[a.prioriteit] - priorityOrder[b.prioriteit])
}

