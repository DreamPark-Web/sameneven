---
description: 
alwaysApply: true
---

@AGENTS.md
# GetClear – Project Instructies

## Stack
- Next.js App Router, React 19, TypeScript
- Supabase (database + auth via Google OAuth)
- Vercel (deployment)

## Styling
- Uitsluitend inline styles en CSS variabelen (var(--bg), var(--s1), var(--text), var(--accent), etc.)
- Geen Tailwind classes gebruiken
- Geen nieuwe CSS klassen aanmaken — gebruik bestaande variabelen uit globals.css
- Alle kaarten in dezelfde rij moeten even hoog zijn via align-items: stretch

## Code stijl
- Geen console.logs laten staan
- Geen instructietekst of comments in code blocks
- TypeScript types altijd definiëren, geen any gebruiken

## Structuur
- Componenten in /components
- Pagina's in /app
- Supabase logica in /lib

## Wat je NOOIT zelf bouwt
- Authenticatie of auth logica — gebruik Supabase auth
- Encryptie of security functies
- Betalingslogica

## Werkwijze
- Bij kleine wijzigingen (1 functionaliteit): gerichte aanpassing, 
  alleen de relevante code
- Bij grote refactors of opfrisronden: volledige bestandsvervangingen
- Maak eerst een plan bij grote wijzigingen, pas daarna aan
- Wijzig nooit functionaliteit als alleen styling gevraagd wordt
- Wijzig nooit styling als alleen functionaliteit gevraagd wordt
