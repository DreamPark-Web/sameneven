'use client'

import { useEffect, useState } from 'react'

const LOADING_TEXTS = [
  "Centjes tellen...",
  "Pinpas zoeken...",
  "Spaarpot schudden...",
  "Rekeningen stapelen...",
  "Budget bijkleuren...",
  "Nullen toevoegen...",
  "Hypotheek checken...",
  "Abonnementen opzoeken...",
  "Financien polishen...",
  "Schulden verstoppen...",
  "Portemonnee opwarmen...",
  "Bankrekening kietelen...",
  "Muntjes rollen...",
  "Budgetje bijspijkeren...",
  "Rekenmachine opzoeken...",
  "Kasboek invullen...",
  "Geldstroom analyseren...",
  "Salarisbriefje bewonderen...",
  "Kosten besparen...",
  "Belastingdienst vermijden...",
  "Bonnetjes bewaren...",
  "Aflossing berekenen...",
  "Spaarvarken wegen...",
  "Creditcard afkoelen...",
  "Overboekinkje plannen...",
  "Eurootjes bijverdienen...",
  "Uitgaven verstoppen...",
  "Maand overleven...",
  "Vakantiebudget dromen...",
  "Financieel inzicht tanken...",
]

export default function LoadingScreen() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(Math.floor(Math.random() * LOADING_TEXTS.length))
    const id = setInterval(() => setIndex(i => (i + 1) % LOADING_TEXTS.length), 800)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: 64, height: 64, color: 'var(--accent)', animation: 'diamondPulse 1s ease-in-out infinite' }}
      >
        <polygon points="65,18 135,18 192,62 100,175 8,62" fill="none" />
        <polyline points="65,18 135,18 192,62 100,175 8,62 65,18" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
        <line x1="65" y1="18" x2="48" y2="66" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="135" y1="18" x2="152" y2="66" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="65" y1="18" x2="100" y2="66" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="135" y1="18" x2="100" y2="66" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <polyline points="8,62 48,66 100,66 152,66 192,62" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
        <line x1="48" y1="66" x2="100" y2="175" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="152" y1="66" x2="100" y2="175" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="100" y1="66" x2="100" y2="175" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="8" y1="118" x2="192" y2="118" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <div style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-body)' }}>
        {LOADING_TEXTS[index]}
      </div>
    </div>
  )
}
